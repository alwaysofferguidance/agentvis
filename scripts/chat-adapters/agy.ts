import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ChatAdapter, ChatRunOptions } from './types'
import { findCliOnPath, isWindowsBatchShim, windowsShimError } from './windows-launcher'

type SpawnProcess = (command: string, args: string[], options: {
  cwd: string
  stdio: ['pipe', 'pipe', 'pipe']
  windowsHide: boolean
}) => ChildProcess

export interface AgyAdapterOptions {
  /** Explicit agy CLI path, useful for managed installations and isolated tests. */
  executable?: string
  /** Process boundary override for tests; production uses node:child_process.spawn. */
  spawnProcess?: SpawnProcess
}

function nativeCliPath(executableOverride?: string): string {
  const explicitPath = executableOverride || process.env.AGY_CLI_PATH
  if (explicitPath) {
    if (isWindowsBatchShim(explicitPath)) throw windowsShimError('Antigravity CLI', explicitPath, 'AGY_CLI_PATH')
    return explicitPath
  }

  const pathCommand = findCliOnPath('agy')
  if (pathCommand.executable) return pathCommand.executable

  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const installed = join(process.env.LOCALAPPDATA, 'agy', 'bin', 'agy.exe')
    if (existsSync(installed)) return installed
  }
  if (pathCommand.unsupportedShim) throw windowsShimError('Antigravity CLI', pathCommand.unsupportedShim, 'AGY_CLI_PATH')
  throw new Error('Antigravity CLI was not found. Set AGY_CLI_PATH to its installed executable.')
}

function abortError(): Error {
  const error = new Error('Antigravity request was aborted')
  error.name = 'AbortError'
  return error
}

function emitRecord(line: string, options: ChatRunOptions, state: {
  conversationId?: string
  emittedText: boolean
  response?: string
  resultSeen: boolean
  resultError?: string
}): void {
  if (!line.trim()) return
  let event: any
  try { event = JSON.parse(line) } catch { return }

  if (event?.event === 'init' && typeof event.conversation_id === 'string') {
    if (state.conversationId !== event.conversation_id) {
      state.conversationId = event.conversation_id
      options.onSession(event.conversation_id)
    }
    return
  }

  if (event?.event === 'step_update' && event.step_update?.step_type === 'agent_response') {
    const delta = event.step_update.text_delta
    if (typeof delta === 'string' && delta) {
      state.emittedText = true
      options.onText(delta)
    }
    return
  }

  if (event?.event === 'result' && event.result) {
    const result = event.result
    state.resultSeen = true
    if (typeof result.conversation_id === 'string') {
      if (state.conversationId !== result.conversation_id) {
        state.conversationId = result.conversation_id
        options.onSession(result.conversation_id)
      }
    }
    if (typeof result.response === 'string') state.response = result.response
    if (result.status !== 'SUCCESS') {
      state.resultError = typeof result.error === 'string' && result.error
        ? result.error
        : `status ${String(result.status || 'unknown')}`
    }
  }
}

export function createAgyAdapter(adapterOptions: AgyAdapterOptions = {}): ChatAdapter {
  const spawnProcess = adapterOptions.spawnProcess || (spawn as unknown as SpawnProcess)

  return {
    run(options: ChatRunOptions): Promise<void> {
      if (options.signal.aborted) return Promise.reject(abortError())

      let executable: string
      try { executable = nativeCliPath(adapterOptions.executable) } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error('Antigravity CLI was not found'))
      }
      // `--print=` selects headless mode while --prompt keeps the message in a
      // separate argv element; spawn uses shell:false so prompt text is never interpolated.
      const args = ['--print=', '--output-format', 'stream-json', '--mode', 'plan', '--prompt', options.message]
      if (options.sessionId) args.push('--conversation', options.sessionId)

      return new Promise<void>((resolve, reject) => {
        let child: ChildProcess
        try {
          child = spawnProcess(executable, args, {
            cwd: options.cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
          })
        } catch {
          reject(new Error('Unable to start Antigravity CLI process'))
          return
        }

        let settled = false
        let buffer = ''
        const state = { emittedText: false, resultSeen: false } as {
          conversationId?: string
          emittedText: boolean
          response?: string
          resultSeen: boolean
          resultError?: string
        }

        const finish = (error?: Error) => {
          if (settled) return
          settled = true
          options.signal.removeEventListener('abort', onAbort)
          if (error) reject(error)
          else resolve()
        }
        const onAbort = () => {
          child.kill()
          finish(abortError())
        }

        options.signal.addEventListener('abort', onAbort, { once: true })
        child.stdout?.setEncoding('utf8')
        child.stderr?.on('data', () => {})
        child.stdout?.on('data', (chunk: string) => {
          buffer += chunk
          let newline = buffer.indexOf('\n')
          while (newline >= 0) {
            emitRecord(buffer.slice(0, newline), options, state)
            buffer = buffer.slice(newline + 1)
            newline = buffer.indexOf('\n')
          }
        })
        child.on('error', () => finish(new Error('Unable to start Antigravity CLI process')))
        child.on('close', (code: number | null) => {
          if (buffer.trim()) emitRecord(buffer, options, state)
          if (settled) return
          if (code !== 0) {
            finish(new Error(`Antigravity CLI exited with code ${code ?? 'unknown'}`))
            return
          }
          if (state.resultError) {
            finish(new Error(`Antigravity response failed: ${state.resultError}`))
            return
          }
          if (!state.resultSeen) {
            finish(new Error('Antigravity CLI exited without a final result'))
            return
          }
          if (!state.emittedText && state.response) options.onText(state.response)
          if (!state.emittedText && !state.response) {
            finish(new Error('Antigravity completed without a text response'))
            return
          }
          finish()
        })
        child.stdin?.end()
      })
    },
  }
}
