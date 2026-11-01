"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

type Runtime = 'codex' | 'pi' | 'agy'
type Message = { role: 'user' | 'assistant'; content: string }
type Thread = { id?: string; messages: Message[] }
const labels: Record<Runtime,string> = { codex: 'Codex', pi: 'Pi', agy: 'Antigravity' }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((event: {results: ArrayLike<ArrayLike<{transcript:string}>>}) => void) | null
  onerror: ((event: {error:string}) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void; abort(): void
}

export interface ConversationPanelHandle { openWithText: (text: string) => void }

export const ConversationPanel = forwardRef<ConversationPanelHandle, {visible:boolean;onClose:()=>void}>(function ConversationPanel({visible,onClose}, ref) {
  const [runtime,setRuntime] = useState<Runtime>('codex')
  const [threads,setThreads] = useState<Record<Runtime,Thread>>({codex:{messages:[]},pi:{messages:[]},agy:{messages:[]}})
  const [draft,setDraft] = useState('')
  const [hydrated,setHydrated] = useState(false)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [listening,setListening] = useState(false)
  const [voiceAvailable,setVoiceAvailable] = useState(false)
  const [readReplies,setReadReplies] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const recognition = useRef<Recognition | null>(null)
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const dialog = useRef<HTMLElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const thread = threads[runtime]
  useImperativeHandle(ref, () => ({
    openWithText: (text: string) => {
      if (text) setDraft(current => (current + text).slice(0, 16000))
      requestAnimationFrame(() => {
        const field = input.current
        if (!field) return
        field.focus()
        field.setSelectionRange(field.value.length, field.value.length)
      })
    },
  }), [])
  useEffect(() => {
    try {
      const saved=JSON.parse(sessionStorage.getItem('agent-flow-conversations-v1') || 'null')
      if(saved && saved.threads) {
        const restored={} as Record<Runtime,Thread>
        for(const key of ['codex','pi','agy'] as Runtime[]) {
          const t=saved.threads[key]
          restored[key]={id:typeof t?.id==='string'?t.id:undefined,messages:Array.isArray(t?.messages)?t.messages.filter((m:Message)=>m && (m.role==='user'||m.role==='assistant') && typeof m.content==='string').slice(-150):[]}
        }
        setThreads(restored)
        if(['codex','pi','agy'].includes(saved.runtime))setRuntime(saved.runtime)
      }
    } catch { /* Storage can be disabled or contain an older format. */ }
    setHydrated(true)
  },[])
  useEffect(() => {
    if(!hydrated)return
    const timer=setTimeout(()=>{try{sessionStorage.setItem('agent-flow-conversations-v1',JSON.stringify({runtime,threads}))}catch{/* Chat still works when browser storage is full. */}},250)
    return ()=>clearTimeout(timer)
  },[threads,runtime,hydrated])
  useEffect(() => {
    const w = window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition}
    setVoiceAvailable(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
    return () => {controller.current?.abort(); recognition.current?.abort()}
  },[])
  useEffect(() => { const el=log.current; if(el) el.scrollTop=el.scrollHeight },[thread.messages,visible])
  useEffect(() => {if(!visible) recognition.current?.stop()},[visible])
  useEffect(() => {
    if (!visible) return
    const active = document.activeElement
    returnFocus.current = active instanceof HTMLElement ? active : null
    const frame = requestAnimationFrame(() => input.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      if (returnFocus.current?.isConnected) returnFocus.current.focus()
      returnFocus.current = null
    }
  }, [visible])
  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = dialog.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    )
    if (!focusable?.length) {
      event.preventDefault()
      dialog.current?.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
      event.preventDefault()
      first.focus()
    }
  }
  const update = (fn:(thread:Thread)=>Thread) => setThreads(prev=>({...prev,[runtime]:fn(prev[runtime])}))
  const stop = () => { controller.current?.abort(); recognition.current?.stop(); window.speechSynthesis?.cancel() }
  const dictate = () => {
    if(listening) {recognition.current?.stop(); return}
    const w = window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition}
    const Constructor=w.SpeechRecognition || w.webkitSpeechRecognition
    if(!Constructor) return
    const rec=new Constructor(); recognition.current=rec
    rec.lang=navigator.language || 'en-US'; rec.continuous=false; rec.interimResults=false
    rec.onresult=event=>{const text=Array.from(event.results).map(r=>r[0]?.transcript || '').join(' '); setDraft(prev=>(prev+' '+text).trim().slice(0,16000))}
    rec.onerror=event=>{setError(event.error==='not-allowed'?'Microphone permission was denied. Allow microphone access in your browser.':`Dictation stopped: ${event.error}`);setListening(false)}
    rec.onend=()=>setListening(false)
    setError(''); try {rec.start();setListening(true)} catch {setError('Could not start microphone dictation.')}
  }
  const send = async () => {
    const message=draft.trim(); if(!message || busy || listening) return
    const abort=new AbortController(); controller.current=abort
    setBusy(true);setError('');setDraft('')
    update(t=>({...t,messages:[...t.messages,{role:'user',content:message},{role:'assistant',content:''}]}))
    let answer=''; let completed=false
    try {
      const port=process.env.NEXT_PUBLIC_RELAY_PORT
      const url=port?`http://127.0.0.1:${port}/chat`:'/chat'
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runtime,message,conversationId:thread.id}),signal:abort.signal})
      if(!response.ok) {const body=await response.json().catch(()=>({})); throw new Error(body.error || `Chat request failed (${response.status}).`)}
      if(!response.body) throw new Error('The runtime did not return a response stream.')
      const reader=response.body.getReader();const decoder=new TextDecoder();let pending=''
      const consume=(line:string)=>{
        if(!line.trim()) return
        const event=JSON.parse(line)
        if(event.type==='start') update(t=>({...t,id:event.conversationId}))
        if((event.type==='text'||event.type==='replace') && typeof event.text==='string') {
          answer=event.type==='replace'?event.text:answer+event.text
          update(t=>({...t,messages:t.messages.map((m,i)=>i===t.messages.length-1?{...m,content:answer}:m)}))
        }
        if(event.type==='error') throw new Error(event.error || 'The runtime failed to reply.')
        if(event.type==='done') completed=true
      }
      while(true) {const {done,value}=await reader.read();pending+=decoder.decode(value,{stream:!done});let newline:number;while((newline=pending.indexOf('\n'))>=0){const line=pending.slice(0,newline);pending=pending.slice(newline+1);consume(line)}if(done)break}
      if(pending.trim())consume(pending)
      if(!completed)throw new Error('The connection ended before the reply completed.')
      if(!answer.trim())throw new Error('The runtime completed without a text reply.')
      if(readReplies && 'speechSynthesis' in window){window.speechSynthesis.cancel();window.speechSynthesis.speak(new SpeechSynthesisUtterance(answer.slice(0,10000)))}
    } catch(err) {
      if(abort.signal.aborted) setError('Stopped. You can send another message.')
      else setError(err instanceof Error?err.message:'Could not connect to the local runtime.')
      update(t=>({...t,messages:t.messages.filter((m,i)=>i!==t.messages.length-1 || m.content.length>0)}))
      // Preserve an unsent prompt after connection/provider errors.
      if(!answer && !abort.signal.aborted) setDraft(current=>current ? `${message}\n${current}`.slice(0,16000) : message)
    } finally {setBusy(false);controller.current=null}
  }
  if(!visible) return null
  return <>
    <div className="conversation-backdrop" aria-hidden="true" onClick={onClose}/>
    <section ref={dialog} className="conversation-panel" aria-labelledby="conversation-title" role="dialog" aria-modal="true" tabIndex={-1} onKeyDown={handleDialogKeyDown}>
    <header className="conversation-header">
      <h2 id="conversation-title" className="sr-only">Agent conversation</h2>
      <label className="sr-only" htmlFor="conversation-runtime">Agent</label>
      <select id="conversation-runtime" aria-label="Conversation runtime" value={runtime} disabled={busy||listening} onChange={e=>{setRuntime(e.target.value as Runtime);setError('');setDraft('')}}><option value="codex">Codex</option><option value="pi">Pi</option><option value="agy">Antigravity</option></select>
      <button disabled={busy||listening||thread.messages.length===0} onClick={()=>{update(()=>({messages:[]}));setError('');setDraft('')}} aria-label="New conversation" title="New conversation">New</button>
      <button onClick={onClose} aria-label="Close conversation" title="Close conversation">&times;</button>
    </header>
    <div ref={log} className="conversation-messages" role="log" aria-label="Conversation messages">
      {thread.messages.map((message,i)=><article key={i} className={`conversation-message ${message.role}`}><span>{message.role==='user'?'You':labels[runtime]}</span><p>{message.content || (busy?'Thinking...':'')}</p></article>)}
    </div>
    {error && <div className="conversation-error" role="alert">{error}</div>}
    <form className="conversation-composer" onSubmit={e=>{e.preventDefault();void send()}}>
      <label className="sr-only" htmlFor="conversation-message">Message {labels[runtime]}</label>
      <textarea ref={input} id="conversation-message" aria-label="Message" placeholder={`Message ${labels[runtime]}...`} value={draft} maxLength={16000} rows={1} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();return}if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}}}/>
      <div className="conversation-actions"><button type="button" onClick={dictate} disabled={!voiceAvailable||busy} aria-label={listening?'Stop dictation':'Dictate message'} aria-pressed={listening} title={voiceAvailable?'Microphone dictation':'Dictation is unavailable in this browser'}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>{listening?'Listening':'Dictate'}</button><label className="conversation-read"><input type="checkbox" checked={readReplies} onChange={e=>{setReadReplies(e.target.checked);if(!e.target.checked)window.speechSynthesis?.cancel()}}/>Read replies</label>{busy?<button type="button" className="conversation-send" onClick={stop}>Stop</button>:<button type="submit" className="conversation-send" disabled={!draft.trim()||listening}>Send</button>}</div>
    </form>
    </section>
  </>
})
