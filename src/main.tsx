import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AudioEngine } from './audio/AudioEngine'
import { padDefinitions } from './pads/padBank'
import './index.css'

const audioEngine = new AudioEngine(padDefinitions.map((pad) => pad.id))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App audioEngine={audioEngine} />
  </StrictMode>,
)

window.addEventListener('beforeunload', () => audioEngine.dispose(), { once: true })
