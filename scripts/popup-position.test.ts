import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampPopupPosition } from '../web/lib/clamp-popup-position'
test('oversized popup remains anchored inside a small viewport', () => {
 Object.assign(globalThis, {window:{innerWidth:320,innerHeight:220}})
 const point = clampPopupPosition({x:310,y:210},380,400)
 assert.ok(point.left>=8)
 assert.ok(point.top>=8)
 Reflect.deleteProperty(globalThis,'window')
})
