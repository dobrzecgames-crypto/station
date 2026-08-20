import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { applicationErrorLog, formatApplicationErrorReport } from '../diagnostics/ApplicationErrorLog'

interface ApplicationErrorBoundaryProps {
  readonly children: ReactNode
}

interface ApplicationErrorBoundaryState {
  readonly error: Error | null
  readonly componentStack: string
  readonly copyStatus: 'idle' | 'copied' | 'failed'
}

export class ApplicationErrorBoundary extends Component<ApplicationErrorBoundaryProps, ApplicationErrorBoundaryState> {
  state: ApplicationErrorBoundaryState = {
    error: null,
    componentStack: '',
    copyStatus: 'idle',
  }

  static getDerivedStateFromError(error: Error): Partial<ApplicationErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    applicationErrorLog.record('react', error)
    this.setState({ componentStack: info.componentStack ?? '' })
  }

  private getDiagnosticReport(): string {
    return formatApplicationErrorReport(applicationErrorLog.getEntries(), this.state.componentStack)
  }

  private copyDiagnostics = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(this.getDiagnosticReport())
      this.setState({ copyStatus: 'copied' })
    } catch {
      this.setState({ copyStatus: 'failed' })
    }
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    const copyLabel = this.state.copyStatus === 'copied' ? 'COPIED' : 'COPY DETAILS'
    return (
      <main className="application-error-screen">
        <section className="application-error-panel" aria-labelledby="application-error-title">
          <p className="application-error-eyebrow">STATION RECOVERY</p>
          <h1 id="application-error-title">Station encountered a fatal interface error.</h1>
          <p>
            Your last successfully saved project remains in this browser&apos;s local storage. Changes that were
            still marked DIRTY or SAVING may not have been saved.
          </p>
          <div className="application-error-actions">
            <button type="button" className="application-error-button" onClick={() => window.location.reload()}>
              RELOAD STATION
            </button>
            <button type="button" className="application-error-button" onClick={this.copyDiagnostics}>
              {copyLabel}
            </button>
          </div>
          <p className="application-error-copy-status" aria-live="polite">
            {this.state.copyStatus === 'failed'
              ? 'Clipboard access failed. Open the details below and copy them manually.'
              : this.state.copyStatus === 'copied'
                ? 'Diagnostic details copied.'
                : 'Diagnostics stay on this device unless you choose to copy them.'}
          </p>
          <details className="application-error-details">
            <summary>VIEW DIAGNOSTIC DETAILS</summary>
            <pre>{this.getDiagnosticReport()}</pre>
          </details>
        </section>
      </main>
    )
  }
}
