import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ChatAdapter, ChatRunOptions } from './types'
import { findCliOnPath, isWindowsBatchShim, windowsShimError } from './windows-launcher'

type SpawnProcess = (command: string, args: string[], options: {
  cwd: string
  stdio: ['pipe', 'pipe', 'pipe']
  windowsHide: boolean
}) => ChildProcess

export interface PiAdapterOptions {
  /** Explicit Pi launcher path, useful for managed installations and isolated tests. */
  executable?: string
  /** Process boundary override for tests; production uses node:child_process.spawn. */
  spawnProcess?: SpawnProcess
}

interface PiCommand {
  executable: string
  prefixArgs: string[]
}

function piCommand(executableOverride?: string): PiCommand {
  if (executableOverride) {
    if (isWindowsBatchShim(executableOverride)) throw windowsShimError('Pi CLI', executableOverride, 'PI_CLI_PATH')
    if (executableOverride.toLowerCase().endsWith('.js')) return { executable: process.execPath, prefixArgs: [executableOverride] }
    if (executableOverride.toLowerCase().endsWith('.ps1')) {
      return {
        executable: process.env.PI_POWERSHELL_EXE || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh'),
        prefixArgs: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', executableOverride],
      }
    }
    return { executable: executableOverride, prefixArgs: [] }
  }

  if (process.env.PI_CLI_PATH) return piCommand(process.env.PI_CLI_PATH)

  if (process.platform === 'win32') {
    const managedDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), '.pi', 'agent')
    const launcher = join(managedDir, 'bin', 'pi-launcher.js')
    if (existsSync(launcher)) return { executable: process.execPath, prefixArgs: [launcher] }
    const pathLauncher = findCliOnPath('pi')
    if (pathLauncher.executable) return piCommand(pathLauncher.executable)
    if (pathLauncher.unsupportedShim) throw windowsShimError('Pi CLI', pathLauncher.unsupportedShim, 'PI_CLI_PATH')
  } else {
    const pathLauncher = findCliOnPath('pi')
    if (pathLauncher.executable) return piCommand(pathLauncher.executable)
  }

  throw new Error('Pi CLI was not found. Set PI_CLI_PATH to its installed launcher.')
}

function abortError(): Error {
  const error = new Error('Pi request was aborted')
  error.name = 'AbortError'
  return error
}

function writeRecord(child: ChildProcess, record: Record<string, unknown>): void {
  child.stdin?.write(`${JSON.stringify(record)}\n`)
}

export function createPiAdapter(adapterOptions: PiAdapterOptions = {}): ChatAdapter {
  const spawnProcess = adapterOptions.spawnProcess || (spawn as unknown as SpawnProcess)

  return {
    run(options: ChatRunOptions): Promise<void> {
      if (options.signal.aborted) return Promise.reject(abortError())

      let command: PiCommand
      try { command = piCommand(adapterOptions.executable) } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error('Pi CLI was not found'))
      }
      const args = [...command.prefixArgs, '--mode', 'rpc', '--no-tools']
      if (options.sessionId) args.push('--session-id', options.sessionId)

      return new Promise<void>((resolve, reject) => {
        let child: ChildProcess
        try {
          child = spawnProcess(command.executable, args, {
            cwd: options.cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
          })
        } catch {
          reject(new Error('Unable to start Pi CLI process'))
          return
        }

        let settled = false
        let promptAccepted = false
        let turnSettled = false
        let emittedText = false
        let currentAssistantText = ''
        let buffer = ''
        const stateRequestId = 'agentvis-state'
        const promptRequestId = 'agentvis-prompt'

        const finish = (error?: Error) => {
          if (settled) return
          settled = true
          options.signal.removeEventListener('abort', onAbort)
          if (error) reject(error)
          else resolve()
        }

        const onAbort = () => {
          try { writeRecord(child, { type: 'abort' }) } catch { /* process may already be closing */ }
          child.kill()
          finish(abortError())
        }

        const processRecord = (line: string) => {
          if (!line.trim() || settled) return
          let event: any
          try { event = JSON.parse(line) } catch { return }

          if (event?.type === 'response' && event.id === stateRequestId) {
            if (!event.success) {
              finish(new Error(`Pi could not open the session: ${String(event.error || 'unknown error')}`))
              child.kill()
              return
            }
            const sessionId = event.data?.sessionId
            if (typeof sessionId === 'string') options.onSession(sessionId)
            writeRecord(child, { id: promptRequestId, type: 'prompt', message: options.message })
            return
          }

          if (event?.type === 'response' && event.id === promptRequestId) {
            if (!event.success) {
              finish(new Error(`Pi rejected the prompt: ${String(event.error || 'unknown error')}`))
              child.kill()
            } else {
              promptAccepted = true
            }
            return
          }

          if (event?.type === 'message_start' && event.message?.role === 'assistant') {
            currentAssistantText = ''
            return
          }

          if (event?.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
            const delta = event.assistantMessageEvent.delta
            if (typeof delta === 'string' && delta) {
              currentAssistantText += delta
              emittedText = true
              options.onText(delta)
            }
            return
          }

          if (event?.type === 'message_end' && event.message?.role === 'assistant') {
            if (event.message.stopReason === 'error') {
              finish(new Error(`Pi response failed: ${String(event.message.errorMessage || 'provider error')}`))
              child.kill()
              return
            }
            const content = event.message.content
            const finalText = typeof content === 'string'
              ? content
              : Array.isArray(content)
                ? content.filter((part: any) => part?.type === 'text' && typeof part.text === 'string').map((part: any) => part.text).join('')
                : ''
            if (finalText && finalText !== currentAssistantText) {
              if (options.onReplace) options.onReplace(finalText)
              else if (!currentAssistantText) options.onText(finalText)
            }
            if (finalText) emittedText = true
            currentAssistantText = finalText || currentAssistantText
            return
          }

          if (event?.type === 'agent_settled' && promptAccepted) {
            turnSettled = true
            child.stdin?.end()
          }
        }

        options.signal.addEventListener('abort', onAbort, { once: true })
        child.stdout?.setEncoding('utf8')
        child.stderr?.on('data', () => {})
        child.stdout?.on('data', (chunk: string) => {
          buffer += chunk
          let newline = buffer.indexOf('\n')
          while (newline >= 0) {
            processRecord(buffer.slice(0, newline))
            buffer = buffer.slice(newline + 1)
            newline = buffer.indexOf('\n')
          }
        })
        child.on('error', () => finish(new Error('Unable to start Pi CLI process')))
        child.on('close', (code: number | null) => {
          if (buffer.trim()) processRecord(buffer)
          if (settled) return
          if (code === 0 && turnSettled && emittedText) finish()
          else if (code === 0 && turnSettled) finish(new Error('Pi completed without a text response'))
          else finish(new Error(`Pi CLI exited before the response completed (code ${code ?? 'unknown'})`))
        })
        child.stdin?.on('error', () => finish(new Error('Unable to send the prompt to Pi CLI')))
        writeRecord(child, { id: stateRequestId, type: 'get_state' })
      })
    },
  }
}
