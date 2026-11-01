import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTimelineEvents } from '../web/lib/timeline-events'
import type { ConversationMessage } from '../web/hooks/simulation/types'
const message = (id: string, timestamp: number, type: ConversationMessage['type'] = 'assistant'): ConversationMessage => ({id,timestamp,type,content:id})
test('timeline uses only the active snapshot after a session switch or backward seek', () => {
 const first = new Map([['agent', [message('old',10), message('later',20)]]])
 assert.equal(buildTimelineEvents(first).length,2)
 const switched = buildTimelineEvents(new Map([['agent',[message('new',1)]]]))
 assert.deepEqual(switched.map(e=>e.label),['new'])
 assert.deepEqual(buildTimelineEvents(new Map()).map(e=>e.label),[])
})
test('capped conversations replace dropped entries, keep unique agent ids, and sort time', () => {
 const result = buildTimelineEvents(new Map([['a',[message('same',4,'thinking')]],['b',[message('same',2,'tool_result')]]]))
 assert.deepEqual(result.map(e=>e.timestamp),[2,4])
 assert.equal(new Set(result.map(e=>e.id)).size,2)
 assert.deepEqual(result.map(e=>e.type),['tool_result','thinking'])
})
