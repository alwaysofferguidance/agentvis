import assert from 'node:assert/strict'
import { test } from 'node:test'

interface FakeWindow {
  parent: { postMessage: (message: unknown, targetOrigin?: string) => void }
  addEventListener: (type: string, listener: (event: MessageEvent) => void) => void
  removeEventListener: (type: string, listener: (event: MessageEvent) => void) => void
  dispatch: (data: unknown) => void
}

test('new status subscribers receive the latest connection status', async () => {
  let messageListener: ((event: MessageEvent) => void) | undefined
  const fakeWindow: FakeWindow = {
    parent: { postMessage: () => {} },
    addEventListener: (_type, listener) => { messageListener = listener },
    removeEventListener: () => {},
    dispatch: (data) => messageListener?.({ data } as MessageEvent),
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow })

  const { vscodeBridge } = await import('../web/lib/vscode-bridge')
  assert.ok(vscodeBridge)
  fakeWindow.dispatch({ type: 'connection-status', status: 'watching', source: 'Claude abc123' })

  const received: Array<[string, string]> = []
  vscodeBridge.onStatus((status, source) => received.push([status, source]))

  assert.deepEqual(received, [['watching', 'Claude abc123']])
  vscodeBridge.dispose()
})
test('saved event count excludes pending events even after switching clears the queue', async () => {
  const { getAppliedSessionEventCount, getPendingSessionEventCount } = await import('../web/lib/vscode-bridge')
  const buffered = [
    { sessionId: 'a' },
    { sessionId: 'a' },
    { sessionId: 'a' },
    { sessionId: 'b' },
  ]
  const pending = [{ sessionId: 'a' }, { sessionId: 'b' }]

  const deferredA = getPendingSessionEventCount(pending, 'a')
  const deferredB = getPendingSessionEventCount(pending, 'b')
  const clearedPending: Array<{ sessionId?: string }> = []

  assert.equal(getAppliedSessionEventCount(buffered, clearedPending, 'a', deferredA), 2)
  assert.equal(getAppliedSessionEventCount(buffered, clearedPending, 'b', deferredB), 0)
})
