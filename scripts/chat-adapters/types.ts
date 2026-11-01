export interface ChatRunOptions {
  message: string
  sessionId?: string
  cwd: string
  signal: AbortSignal
  onText: (text: string) => void
  onReplace?: (text: string) => void
  onSession: (id: string) => void
}
export interface ChatAdapter { run(options: ChatRunOptions): Promise<void> }
