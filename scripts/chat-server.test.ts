import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createChatHandler } from './chat-server'
import type { ChatAdapter } from './chat-adapters/types'

async function server(adapter: ChatAdapter, run:(url:string)=>Promise<void>) {
 const handle=createChatHandler(process.cwd(),{codex:adapter,pi:adapter,agy:adapter})
 const http=createServer((req,res)=>{void handle(req,res)})
 await new Promise<void>(resolve=>http.listen(0,'127.0.0.1',resolve))
 const address=http.address(); if(!address || typeof address==='string') throw Error('No port')
 try {await run(`http://127.0.0.1:${address.port}/chat`)} finally {await new Promise<void>(resolve=>http.close(()=>resolve()))}
}
const post=(url:string,body:unknown,origin='http://localhost:3000')=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Origin':origin},body:JSON.stringify(body)})
const noRun:ChatAdapter={run:async()=>{throw Error('Must not launch')}}
test('chat rejects remote origins and malformed prompts before launching a runtime',async()=>{
 await server(noRun,async url=>{
  assert.equal((await post(url,{runtime:'codex',message:'hello'},'https://example.com')).status,403)
  assert.equal((await post(url,{runtime:'unknown',message:'hello'})).status,400)
  assert.equal((await post(url,{runtime:'pi',message:' '})).status,400)
  assert.equal((await post(url,{runtime:'pi',message:'x'.repeat(33000)})).status,413)
 })
})
test('chat streams text, maintains runtime session continuity, and prevents runtime mixing',async()=>{
 const sessions:(string|undefined)[]=[]
 const adapter:ChatAdapter={run:async o=>{sessions.push(o.sessionId);o.onSession('native-session');o.onText('Hello ');o.onText('??')}}
 await server(adapter,async url=>{
  const response=await post(url,{runtime:'pi',message:'hi'})
  const events=(await response.text()).trim().split('\n').map(s=>JSON.parse(s))
  assert.deepEqual(events.filter(e=>e.type==='text').map(e=>e.text),['Hello ','??'])
  const conversationId=events[0].conversationId
  assert.equal(events.at(-1).type,'done')
  await (await post(url,{runtime:'pi',message:'followup',conversationId})).text()
  assert.deepEqual(sessions,[undefined,'native-session'])
  assert.equal((await post(url,{runtime:'agy',message:'wrong runtime',conversationId})).status,409)
  assert.equal((await post(url,{runtime:'pi',message:'expired',conversationId:'missing'})).status,404)
 })
})
test('provider failure is streamed as an error, not a successful reply',async()=>{
 await server({run:async()=>{throw Error('Authentication required')}},async url=>{
  const result=await (await post(url,{runtime:'codex',message:'hi'})).text()
  assert.match(result,/Authentication required/)
  assert.doesNotMatch(result,/["']type["']:["']done["']/)
 })
})

test('chat rejects concurrent turns and cancels the runtime when its client disconnects',async()=>{
 let didAbort=false
 const adapter:ChatAdapter={run:async o=>new Promise<void>((resolve,reject)=>{o.onSession('running');o.signal.addEventListener('abort',()=>{didAbort=true;reject(new Error('aborted'))},{once:true})})}
 await server(adapter,async url=>{
  const controller=new AbortController()
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Origin':'http://localhost:3000'},body:JSON.stringify({runtime:'codex',message:'start'}),signal:controller.signal})
  const reader=response.body!.getReader();const first=await reader.read()
  const start=JSON.parse(new TextDecoder().decode(first.value).trim())
  assert.equal((await post(url,{runtime:'codex',message:'second',conversationId:start.conversationId})).status,409)
  controller.abort()
  for(let i=0;i<30&&!didAbort;i++)await new Promise(resolve=>setTimeout(resolve,10))
  assert.equal(didAbort,true)
 })
})
