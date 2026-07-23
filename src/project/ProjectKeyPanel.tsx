import { noteNames, scaleDefinitions, scaleIds } from '../music/scales'
import type { ProjectKey } from '../music/scales'

interface ProjectKeyPanelProps {
  projectKey: ProjectKey
  disabled: boolean
  onChange: (projectKey: ProjectKey) => void
}

export function ProjectKeyPanel({ projectKey, disabled, onChange }: ProjectKeyPanelProps) {
  return <section className="project-key-panel" aria-labelledby="project-key-title">
    <p className="eyebrow" id="project-key-title">PROJECT KEY</p>
    <div className="project-key-controls">
      <label>ROOT
        <select value={projectKey.root} disabled={disabled} onChange={(event) => onChange({ ...projectKey, root: event.target.value as ProjectKey['root'] })}>
          {noteNames.map((note) => <option key={note} value={note}>{note}</option>)}
        </select>
      </label>
      <label>SCALE
        <select value={projectKey.scale} disabled={disabled} onChange={(event) => onChange({ ...projectKey, scale: event.target.value as ProjectKey['scale'] })}>
          {scaleIds.map((scaleId) => <option key={scaleId} value={scaleId}>{scaleDefinitions[scaleId].label}</option>)}
        </select>
      </label>
    </div>
  </section>
}
