import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcess } from 'node:child_process'
import { createPiAdapter } from './pi'

function fakePi(respondToPrompt = true, deltas = ['hello', 'hello from pi'], finalText = 'hello from pi') {
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
    child.stdin.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        const record = JSON.parse(line)
        if (record.type === 'get_state') {
          child.stdout.write(`${JSON.stringify({ type: 'response', id: record.id, success: true, data: { sessionId: 'pi-session-1' } })}\n`)
        } else if (record.type === 'prompt' && respondToPrompt) {
          child.stdout.write(`${JSON.stringify({ type: 'response', id: record.id, success: true })}\n`)
          child.stdout.write(`${JSON.stringify({ type: 'message_start', message: { role: 'assistant' } })}\n`)
          for (const delta of deltas) child.stdout.write(`${JSON.stringify({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta } })}\n`)
          child.stdout.write(`${JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: finalText }] } })}\n`)
          child.stdout.write(`${JSON.stringify({ type: 'agent_settled' })}\n`)
        }
      }
    })
    child.stdin.on('end', () => {
      child.stdout.end()
      child.stderr.end()
      queueMicrotask(() => child.emit('close', 0, null))
    })
    childRef = child
    return child
  }) as any
  return { spawnProcess, getCommand: () => command, getArgs: () => args, getChild: () => childRef }
}

const runOptions = (overrides: Partial<Parameters<ReturnType<typeof createPiAdapter>['run']>[0]> = {}) => ({
  message: 'Say hello',
  cwd: process.cwd(),
  signal: new AbortController().signal,
  onText: (_text: string) => {},
  onSession: (_id: string) => {},
  ...overrides,
})

test('starts Pi without tools, streams text, and reports the session id', async () => {
  const fake = fakePi()
  const adapter = createPiAdapter({ executable: 'pi-test', spawnProcess: fake.spawnProcess })
  const text: string[] = []
  const replacements: string[] = []
  const sessions: string[] = []

  await adapter.run(runOptions({ onText: value => text.push(value), onReplace: value => replacements.push(value), onSession: id => sessions.push(id) }))

  assert.equal(fake.getCommand(), 'pi-test')
  assert.deepEqual(fake.getArgs(), ['--mode', 'rpc', '--no-tools'])
  assert.deepEqual(text, ['hello', 'hello from pi'])
  assert.deepEqual(replacements, ['hello from pi'])
  assert.deepEqual(sessions, ['pi-session-1'])
})

test('resumes the supplied Pi session id', async () => {
  const fake = fakePi()
  const adapter = createPiAdapter({ executable: 'pi-test', spawnProcess: fake.spawnProcess })
  await adapter.run(runOptions({ sessionId: 'resume-456' }))
  assert.deepEqual(fake.getArgs(), ['--mode', 'rpc', '--no-tools', '--session-id', 'resume-456'])
})

test('preserves repeated delta fragments and repairs cumulative provider snapshots from message_end', async () => {
  const fake = fakePi(true, ['ha', 'ha'], 'haha')
  const adapter = createPiAdapter({ executable: 'pi-test', spawnProcess: fake.spawnProcess })
  const text: string[] = []
  const replacements: string[] = []

  await adapter.run(runOptions({ onText: value => text.push(value), onReplace: value => replacements.push(value) }))

  assert.deepEqual(text, ['ha', 'ha'])
  assert.deepEqual(replacements, [])

  const snapshotFake = fakePi(true, ['short', 'short', 'short-check-93'], 'short-check-93')
  const snapshotAdapter = createPiAdapter({ executable: 'pi-test', spawnProcess: snapshotFake.spawnProcess })
  const snapshotText: string[] = []
  const snapshotReplacements: string[] = []
  await snapshotAdapter.run(runOptions({
    onText: value => snapshotText.push(value),
    onReplace: value => snapshotReplacements.push(value),
  }))

  assert.deepEqual(snapshotText, ['short', 'short', 'short-check-93'])
  assert.deepEqual(snapshotReplacements, ['short-check-93'])
})

test('aborting a Pi turn terminates its child process', async () => {
  const fake = fakePi(false)
  const adapter = createPiAdapter({ executable: 'pi-test', spawnProcess: fake.spawnProcess })
  const controller = new AbortController()
  const run = adapter.run(runOptions({ signal: controller.signal }))
  await new Promise(resolve => setImmediate(resolve))
  const child = fake.getChild() as ChildProcess
  let killed = false
  child.kill = (() => { killed = true; return true }) as any
  controller.abort()
  await assert.rejects(run, { name: 'AbortError' })
  assert.equal(killed, true)
})
