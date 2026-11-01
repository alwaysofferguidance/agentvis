import { createRoot } from 'react-dom/client'
import { AgentVisualizer } from './components/agent-visualizer'
import './app/globals.css'
import './app/observatory.css'
import './app/panel-density.css'
import './app/neutral-ui.css'
import './app/workbench.css'

// Standalone CLI entry — no VS Code API, connects to relay via SSE
const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')
const root = createRoot(rootElement)
root.render(<AgentVisualizer />)
