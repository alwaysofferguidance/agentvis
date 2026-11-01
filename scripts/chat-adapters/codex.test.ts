import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcess } from 'node:child_process'
import { createCodexAdapter } from './codex'

function fakeSpawner(events: string[], result: { code: number | null; signal?: NodeJS.Signals | null } = { code: 0 }) {
  let command = ''
  let args: string[] = []
  let options: unknown
  let prompt = ''
  let childRef: any
  const spawnProcess = ((exe: string, argv: string[], spawnOptions: unknown) => {
    command = exe
    args = argv
    options = spawnOptions
    const child: any = new EventEmitter()
    child.stdin = new PassThrough()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => true
    child.stdin.on('data', (chunk: Buffer) => { prompt += chunk.toString() })
    childRef = child
    child.stdin.on('finish', () => {
      for (const event of events) child.stdout.write(`${event}\n`)
      child.stdout.end()
      child.stderr.end()
      queueMicrotask(() => child.emit('close', result.code, result.signal ?? null))
    })
    return child
  }) as any
  return {
    spawnProcess,
    getCommand: () => command,
    getArgs: () => args,
    getOptions: () => options,
    getPrompt: () => prompt,
    getChild: () => childRef,
  }
}

const runOptions = (overrides: Partial<Parameters<ReturnType<typeof createCodexAdapter>['run']>[0]> = {}) => ({
  message: 'Reply with exactly: ready',
  cwd: process.cwd(),
  signal: new AbortController().signal,
  onText: (_text: string) => {},
  onSession: (_id: string) => {},
  ...overrides,
})

test('starts a read-only Codex turn, streams its answer, and reports the session id', async () => {
  const fake = fakeSpawner([
    JSON.stringify({ type: 'thread.started', thread_id: 'thread-123' }),
    JSON.stringify({ type: 'item.completed', item: { id: 'item-1', type: 'agent_message', text: 'ready' } }),
    JSON.stringify({ type: 'turn.completed' }),
  ])
  const adapter = createCodexAdapter({ executable: 'codex-test.exe', spawnProcess: fake.spawnProcess })
  const text: string[] = []
  const sessions: string[] = []

  await adapter.run(runOptions({ onText: value => text.push(value), onSession: id => sessions.push(id) }))

  assert.equal(fake.getCommand(), 'codex-test.exe')
  assert.equal((fake.getOptions() as { shell: false }).shell, false)
  assert.equal(fake.getPrompt(), 'Reply with exactly: ready')
  assert.deepEqual(fake.getArgs().slice(0, 4), ['--sandbox', 'read-only', 'exec', '--json'])
  assert.deepEqual(text, ['ready'])
  assert.deepEqual(sessions, ['thread-123'])
})

test('resumes the supplied Codex session id and streams delta text once', async () => {
  const fake = fakeSpawner([
    JSON.stringify({ type: 'item.delta', item_id: 'item-2', delta: 'hello' }),
    JSON.stringify({ type: 'item.completed', item: { id: 'item-2', type: 'agent_message', text: 'hello' } }),
    JSON.stringify({ type: 'turn.completed' }),
  ])
  const adapter = createCodexAdapter({ executable: 'codex-test.exe', spawnProcess: fake.spawnProcess })
  const text: string[] = []

  await adapter.run(runOptions({ sessionId: 'thread-123', onText: value => text.push(value) }))

  assert.deepEqual(fake.getArgs().slice(0, 5), ['--sandbox', 'read-only', 'exec', 'resume', '--json'])
  assert.equal(fake.getArgs()[5], 'thread-123')
  assert.deepEqual(text, ['hello'])
})

test('reports the supplied session while resuming it', async () => {
  const fake = fakeSpawner([JSON.stringify({ type: 'turn.completed' })])
  const adapter = createCodexAdapter({ executable: 'codex-test.exe', spawnProcess: fake.spawnProcess })
  const sessions: string[] = []

  await adapter.run(runOptions({ sessionId: 'thread-123', onSession: id => sessions.push(id) }))

  assert.deepEqual(sessions, ['thread-123'])
})

test('rejects failed Codex exits without exposing raw process output', async () => {
  const fake = fakeSpawner([], { code: 1 })
  const adapter = createCodexAdapter({ executable: 'codex-test.exe', spawnProcess: fake.spawnProcess })

  await assert.rejects(adapter.run(runOptions()), /Codex CLI exited with code 1/)
})

test('surfaces structured Codex failures with credentials redacted', async () => {
  const fake = fakeSpawner([
    JSON.stringify({ type: 'turn.failed', error: { message: 'Request failed: Bearer secret-token-1234567890' } }),
  ])
  const adapter = createCodexAdapter({ executable: 'codex-test.exe', spawnProcess: fake.spawnProcess })

  await assert.rejects(adapter.run(runOptions()), /Request failed: Bearer \[redacted\]/)
})

test('aborting a running turn terminates the child process', async () => {
  const fake = fakeSpawner([])
  const child = fake.getChild
  const adapter = createCodexAdapter({ executable: 'codex-test.exe', spawnProcess: fake.spawnProcess })
  const controller = new AbortController()
  const run = adapter.run(runOptions({ signal: controller.signal }))
  const process = child() as ChildProcess
  let killed = false
  process.kill = (() => { killed = true; return true }) as any

  controller.abort()
  await assert.rejects(run, { name: 'AbortError' })
  assert.equal(killed, true)
})
