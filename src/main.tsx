import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AudioEngine } from './audio/AudioEngine'
import './index.css'
// Must load after the component tree: Vinyl Dust is the final visual layer.
import './vinyl-dust.css'
// Viewport use and proportional sizing sit above every visual skin so the
// whole instrument shares one physical scale without page zooming.
import './global-scale.css'

const audioEngine = new AudioEngine()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App audioEngine={audioEngine} />
  </StrictMode>,
)

window.addEventListener('beforeunload', () => audioEngine.dispose(), { once: true })
