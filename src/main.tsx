import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AudioEngine } from './audio/AudioEngine'
import './index.css'

const audioEngine = new AudioEngine()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App audioEngine={audioEngine} />
  </StrictMode>,
)

window.addEventListener('beforeunload', () => audioEngine.dispose(), { once: true })
