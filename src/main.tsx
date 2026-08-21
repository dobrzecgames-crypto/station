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

/* `beforeunload` is cancellable, and Station itself asks the user to cancel it
   whenever a project is dirty (see App's unsaved-changes warning). Disposing
   here therefore destroyed the AudioContext, every decoded sample and every
   runtime WAV blob of a page that then stayed alive - and the save the warning
   had just asked for could never complete again. `pagehide` with
   `persisted === false` is the event that means this document really is being
   discarded; a bfcache-persisted hide may still come back and must keep its
   runtime. */
window.addEventListener('pagehide', (event) => { if (!event.persisted) audioEngine.dispose() })
