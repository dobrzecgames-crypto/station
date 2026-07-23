import type { ReactNode } from 'react'

interface ProjectMenuProps {
  busy: boolean
  audioReady: boolean
  onSave: () => void
  onOpen: () => void
  children: ReactNode
}

export function ProjectMenu({ busy, audioReady, onSave, onOpen, children }: ProjectMenuProps) {
  return (
    <details className="project-menu">
      <summary>PROJECT</summary>
      <div className="project-menu-popover">
        <button className="mixer-toggle" type="button" disabled={busy} onClick={onSave}>SAVE PROJECT</button>
        <button className="mixer-toggle" type="button" disabled={!audioReady || busy} onClick={onOpen}>OPEN PROJECT</button>
        {children}
      </div>
    </details>
  )
}
