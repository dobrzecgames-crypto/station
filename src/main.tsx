import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AudioEngine } from './audio/AudioEngine'
import { installGlobalErrorHandlers } from './diagnostics/ApplicationErrorLog'
import { ApplicationErrorBoundary } from './shell/ApplicationErrorBoundary'
import './index.css'
// Must load after the component tree: Vinyl Dust is the final visual layer.
import './vinyl-dust.css'
// Viewport use and proportional sizing sit above every visual skin so the
// whole instrument shares one physical scale without page zooming.
import './global-scale.css'
// Control size tiers, card geometry and label roles. Last, because the older
// passes in App.css set the same properties repeatedly and this layer is the
// one that decides them from function rather than from cascade order.
import './layout-tiers.css'
import './shell/applicationErrorBoundary.css'
import './diagnostics/internalDiagnostics.css'

const audioEngine = new AudioEngine()
installGlobalErrorHandlers(window)

function StationRoot() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('stationCrash') === 'render') {
    throw new Error('Intentional Station render crash for recovery-screen verification.')
  }
  return <App audioEngine={audioEngine} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApplicationErrorBoundary>
      <StationRoot />
    </ApplicationErrorBoundary>
  </StrictMode>,
)

window.addEventListener('beforeunload', () => audioEngine.dispose(), { once: true })
