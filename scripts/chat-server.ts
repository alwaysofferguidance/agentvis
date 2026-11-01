import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createCodexAdapter } from './chat-adapters/codex'
import { createPiAdapter } from './chat-adapters/pi'
import { createAgyAdapter } from './chat-adapters/agy'
import type { ChatAdapter } from './chat-adapters/types'

export type ChatRuntime = 'codex' | 'pi' | 'agy'
interface Conversation { runtime: ChatRuntime; sessionId?: string; busy: boolean; touched: number }
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/
export function createChatHandler(cwd: string, adapters: Record<ChatRuntime, ChatAdapter> = {
  codex: createCodexAdapter(), pi: createPiAdapter(), agy: createAgyAdapter(),
}) {
  const conversations = new Map<string, Conversation>()
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const json = (code: number, value: unknown) => { res.writeHead(code, {'Content-Type':'application/json'}); res.end(JSON.stringify(value)) }
    if (req.method !== 'POST') { json(405,{error:'Use POST to send a message.'}); return }
    if (!req.headers.origin || !LOCAL_ORIGIN.test(req.headers.origin)) { json(403,{error:'Chat is available from the local app only.'}); return }
    if (!req.headers['content-type']?.startsWith('application/json')) { json(415,{error:'Send JSON.'}); return }
    const chunks: Buffer[] = []; let bytes = 0
    try {
      for await (const chunk of req) {
        const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk); chunks.push(buffer); bytes+=buffer.length
        if (bytes > 32768) { json(413,{error:'Message is too large.'}); return }
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!body || !['codex','pi','agy'].includes(body.runtime) || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 16000) {
        json(400,{error:'Choose a runtime and enter a message (up to 16,000 characters).'}); return
      }
      if (body.conversationId !== undefined && (typeof body.conversationId !== 'string' || body.conversationId.length>100)) { json(400,{error:'Invalid conversation.'}); return }
      const id = body.conversationId || randomUUID()
      let conversation = conversations.get(id)
      if (body.conversationId && !conversation) { json(404,{error:'Conversation expired after a server restart. Start a new conversation.'}); return }
      if (conversation?.busy) { json(409,{error:'A reply is already running in this conversation.'}); return }
      if (conversation && conversation.runtime !== body.runtime) { json(409,{error:'Start a new conversation to switch runtimes.'}); return }
      if (!conversation) {
        for (const [key,value] of conversations) if (!value.busy && Date.now()-value.touched>86400000) conversations.delete(key)
        if (conversations.size >= 100) { json(429,{error:'Conversation limit reached. Restart the local relay to clear old conversations.'}); return }
        conversation = {runtime:body.runtime,busy:false,touched:Date.now()}; conversations.set(id,conversation)
      }
      conversation.busy = true
      const controller = new AbortController()
      const onClose = () => controller.abort()
      res.once('close',onClose)
      res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Accel-Buffering':'no'})
      res.flushHeaders()
      const send = (event: unknown) => {if(!res.destroyed) res.write(JSON.stringify(event)+'\n')}
      send({type:'start',conversationId:id,runtime:body.runtime})
      const heartbeat = setInterval(()=>send({type:'heartbeat'}),15000)
      try {
        await adapters[conversation.runtime].run({
          message: body.message, sessionId:conversation.sessionId, cwd, signal:controller.signal,
          onText: text => send({type:'text',text}),
          onReplace: text => send({type:'replace',text}),
          onSession: sessionId => {conversation!.sessionId=sessionId},
        })
        send({type:'done'})
      } catch(error) {
        if (!controller.signal.aborted) send({type:'error',error:error instanceof Error ? error.message.slice(0,2000) : 'The runtime could not reply.'})
      } finally {
        clearInterval(heartbeat); conversation.busy=false; conversation.touched=Date.now(); res.off('close',onClose); res.end()
      }
    } catch { if (!res.headersSent) json(400,{error:'Invalid request JSON.'}) }
  }
}
