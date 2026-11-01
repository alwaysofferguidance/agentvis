import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getTypeToOpenText, shouldIgnoreShortcut } from '../web/lib/keyboard-shortcuts'
const key = (extra = {}) => ({ defaultPrevented: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false, key: 'f', target: null, ...extra })
test('browser shortcuts and consumed/repeated events do not trigger app actions', () => {
 for (const extra of [{ctrlKey:true}, {metaKey:true}, {altKey:true}, {repeat:true}, {defaultPrevented:true}]) assert.equal(shouldIgnoreShortcut(key(extra)), true)
})
test('plain shortcuts remain enabled', () => assert.equal(shouldIgnoreShortcut(key()), false))
test('type-to-open captures printable keys but leaves modifiers, IME, and consumed events alone', () => {
 const base = { defaultPrevented: false, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, key: 'f', target: null }
 assert.equal(getTypeToOpenText(base), 'f')
 for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }, { defaultPrevented: true }, { key: 'ArrowLeft' }, { key: ' ' }]) {
   assert.equal(getTypeToOpenText({ ...base, ...extra }), null)
 }
 assert.equal(getTypeToOpenText({ ...base, key: 'Dead' }), '')
 assert.equal(getTypeToOpenText({ ...base, key: 'Process' }), '')
})
test('type-to-open yields to editable and interactive targets', () => {
 const base = { defaultPrevented: false, ctrlKey: false, metaKey: false, altKey: false, key: 'f', target: null }
 const target = (matches: string) => ({ closest: (selector: string) => selector.split(', ').includes(matches) ? {} : null })
 for (const selector of ['input', 'textarea', 'select', 'button', '[contenteditable]:not([contenteditable="false"])', '[role="dialog"]', '[role="menu"]', '[data-no-type-to-open]']) {
   assert.equal(getTypeToOpenText({ ...base, target: target(selector) as unknown as EventTarget }), null, selector)
 }
})
