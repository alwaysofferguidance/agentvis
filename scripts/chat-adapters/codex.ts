import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import type { ChatAdapter, ChatRunOptions } from './types'

type SpawnProcess = (command: string, args: string[], options: {
  cwd: string
  stdio: ['pipe', 'pipe', 'pipe']
  windowsHide: boolean
  shell: false
}) => ChildProcess

export interface CodexAdapterOptions {
  /** Explicit native CLI path, useful for managed installations and isolated tests. */
  executable?: string
  /** Process boundary override for tests; production uses node:child_process.spawn. */
  spawnProcess?: SpawnProcess
}

function nativeCliPath(): string {
  if (process.env.CODEX_CLI_PATH) return process.env.CODEX_CLI_PATH

  if (process.platform === 'win32') {
    const npmRoot = join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules')
    const packageArch = process.arch === 'arm64' ? 'arm64' : 'x64'
    const triple = process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc'
    const candidate = join(
      npmRoot,
      '@openai', 'codex', 'node_modules', '@openai', `codex-win32-${packageArch}`,
      'vendor', triple, 'bin', 'codex.exe',
    )
    if (existsSync(candidate)) return candidate
  }

  const executableName = process.platform === 'win32' ? 'codex.exe' : 'codex'
  for (const directory of (process.env.PATH || '').split(delimiter)) {
    const candidate = join(directory, executableName)
    if (existsSync(candidate)) return candidate
  }

  throw new Error('Codex CLI native executable was not found. Set CODEX_CLI_PATH to its path.')
}

function abortError(): Error {
  const error = new Error('Codex request was aborted')
  error.name = 'AbortError'
  return error
}

function safeDiagnostic(value: string): string {
  return value
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/(\bBearer\s+)[^\s"'<>]+/gi, '$1[redacted]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{16,})\b/g, '[redacted]')
    .replace(/([?&][^=\s&]+=)[^\s&]+/g, '$1[redacted]')
    .trim()
    .slice(0, 500)
}

function emitEvent(
  line: string,
  options: ChatRunOptions,
  streamedItems: Set<string>,
  reportSession: (id: string) => void,
  recordFailure: (message: string) => void,
): void {
  if (!line.trim()) return
  let event: any
  try {
    event = JSON.parse(line)
  } catch {
    return
  }

  if (event?.type === 'thread.started' && typeof event.thread_id === 'string') {
    reportSession(event.thread_id)
    return
  }

  if (event?.type === 'turn.failed' || event?.type === 'error') {
    const message = typeof event.message === 'string'
      ? event.message
      : typeof event.error?.message === 'string' ? event.error.message : ''
    if (message) recordFailure(message)
  }

  if (event?.type === 'item.delta' && typeof event.item_id === 'string' && typeof event.delta === 'string') {
    streamedItems.add(event.item_id)
    options.onText(event.delta)
    return
  }

  if (event?.type === 'item.completed' && event.item?.type === 'agent_message' && typeof event.item.text === 'string') {
    const itemId = typeof event.item.id === 'string' ? event.item.id : undefined
    if (!itemId || !streamedItems.has(itemId)) options.onText(event.item.text)
  }
}

export function createCodexAdapter(adapterOptions: CodexAdapterOptions = {}): ChatAdapter {
  const spawnProcess = adapterOptions.spawnProcess || (spawn as unknown as SpawnProcess)

  return {
    run(options: ChatRunOptions): Promise<void> {
      if (options.signal.aborted) return Promise.reject(abortError())

      const args = ['--sandbox', 'read-only', 'exec']
      if (options.sessionId) args.push('resume', '--json', options.sessionId, '-')
      else args.push('--json', '-')
      let executable: string
      try {
        executable = adapterOptions.executable || nativeCliPath()
      } catch (error) {
        return Promise.reject(error)
      }

      return new Promise<void>((resolve, reject) => {
        let child: ChildProcess
        try {
          child = spawnProcess(executable, args, {
            cwd: options.cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            shell: false,
          })
        } catch (error) {
          reject(error)
          return
        }

        let settled = false
        let outputBuffer = ''
        let stderrBuffer = ''
        let failureDetail = ''
        let reportedSessionId: string | undefined
        const streamedItems = new Set<string>()
        const reportSession = (id: string) => {
          if (reportedSessionId === id) return
          reportedSessionId = id
          options.onSession(id)
        }
        const recordFailure = (message: string) => {
          failureDetail = safeDiagnostic(message) || failureDetail
        }
        const settle = (error?: Error) => {
          if (settled) return
          settled = true
          options.signal.removeEventListener('abort', onAbort)
          if (error) reject(error)
          else resolve()
        }
        const onAbort = () => {
          child.kill()
          settle(abortError())
        }

        if (options.sessionId) reportSession(options.sessionId)
        options.signal.addEventListener('abort', onAbort, { once: true })
        child.stdout?.setEncoding('utf8')
        child.stdout?.on('data', (chunk: string) => {
          outputBuffer += chunk
          let newline = outputBuffer.indexOf('\n')
          while (newline >= 0) {
            emitEvent(outputBuffer.slice(0, newline), options, streamedItems, reportSession, recordFailure)
            outputBuffer = outputBuffer.slice(newline + 1)
            newline = outputBuffer.indexOf('\n')
          }
        })
        child.on('error', () => settle(new Error('Unable to start Codex CLI process')))
        child.on('close', (code: number | null) => {
          if (outputBuffer.trim()) emitEvent(outputBuffer, options, streamedItems, reportSession, recordFailure)
          if (failureDetail) settle(new Error(failureDetail))
          else if (code === 0) settle()
          else {
            const diagnostic = safeDiagnostic(stderrBuffer)
            settle(new Error(diagnostic || `Codex CLI exited with code ${code ?? 'unknown'}`))
          }
        })

        child.stderr?.setEncoding('utf8')
        child.stderr?.on('data', (chunk: string) => {
          // Always drain stderr to prevent a full pipe from blocking the child.
          if (stderrBuffer.length < 8192) stderrBuffer += chunk.slice(0, 8192 - stderrBuffer.length)
        })
        child.stdin?.on('error', () => settle(new Error('Unable to send the prompt to Codex CLI')))
        child.stdin?.end(options.message)
      })
    },
  }
}
