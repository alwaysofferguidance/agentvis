import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcess } from 'node:child_process'
import { createAgyAdapter } from './agy'

function fakeAgy() {
  let command = ''
  let args: string[] = []
  let childRef: any
  const spawnProcess = ((exe: string, argv: string[]) => {
    command = exe
    args = argv
    const child: any = new EventEmitter()
    child.stdin = new PassThrough()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => true
    childRef = child
    queueMicrotask(() => {
      child.stdout.write(`${JSON.stringify({ event: 'init', conversation_id: 'agy-session-1' })}\n`)
      child.stdout.write(`${JSON.stringify({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: 'hello from agy' } })}\n`)
      child.stdout.write(`${JSON.stringify({ event: 'result', result: { conversation_id: 'agy-session-1', status: 'SUCCESS', response: 'hello from agy' } })}\n`)
      child.stdout.end()
      child.stderr.end()
      child.emit('close', 0, null)
    })
    return child
  }) as any
  return { spawnProcess, getCommand: () => command, getArgs: () => args, getChild: () => childRef }
}

const runOptions = (overrides: Partial<Parameters<ReturnType<typeof createAgyAdapter>['run']>[0]> = {}) => ({
  message: 'Say hello',
  cwd: process.cwd(),
  signal: new AbortController().signal,
  onText: (_text: string) => {},
  onSession: (_id: string) => {},
  ...overrides,
})

test('starts agy in plan mode, streams text, and reports its conversation id', async () => {
  const fake = fakeAgy()
  const adapter = createAgyAdapter({ executable: 'agy-test', spawnProcess: fake.spawnProcess })
  const text: string[] = []
  const sessions: string[] = []

  await adapter.run(runOptions({ onText: value => text.push(value), onSession: id => sessions.push(id) }))

  assert.equal(fake.getCommand(), 'agy-test')
  assert.deepEqual(fake.getArgs().slice(0, 6), ['--print=', '--output-format', 'stream-json', '--mode', 'plan', '--prompt'])
  assert.equal(fake.getArgs()[6], 'Say hello')
  assert.deepEqual(text, ['hello from agy'])
  assert.deepEqual(sessions, ['agy-session-1'])
})

test('resumes the supplied agy conversation id', async () => {
  const fake = fakeAgy()
  const adapter = createAgyAdapter({ executable: 'agy-test', spawnProcess: fake.spawnProcess })
  await adapter.run(runOptions({ sessionId: 'resume-456' }))
  assert.deepEqual(fake.getArgs().slice(-2), ['--conversation', 'resume-456'])
})

test('aborting an agy turn terminates its child process', async () => {
  const spawnProcess = (() => {
    const child: any = new EventEmitter()
    child.stdin = new PassThrough()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => true
    return child
  }) as any
  const adapter = createAgyAdapter({ executable: 'agy-test', spawnProcess })
  const controller = new AbortController()
  const run = adapter.run(runOptions({ signal: controller.signal }))
  await new Promise(resolve => setImmediate(resolve))
  controller.abort()
  await assert.rejects(run, { name: 'AbortError' })
})
