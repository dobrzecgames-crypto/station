export type MainView = 'library' | 'chop' | 'pad' | 'seq' | 'song' | 'mix' | 'project'

interface MainNavigationProps {
  view: MainView
  onViewChange: (view: MainView) => void
}

const views: ReadonlyArray<{ id: MainView; label: string }> = [
  { id: 'library', label: 'LIBRARY' },
  { id: 'chop', label: 'CHOP' },
  { id: 'pad', label: 'PADS' },
  { id: 'seq', label: 'SEQ' },
  { id: 'song', label: 'SONG' },
  { id: 'mix', label: 'MIX' },
  { id: 'project', label: 'PROJECT' },
]

export function MainNavigation({ view, onViewChange }: MainNavigationProps) {
  return <nav className="main-navigation" aria-label="Workspaces">{views.map((item) => {
    const isActive = view === item.id
    const isProject = item.id === 'project'
    const className = [isProject ? 'main-nav-button main-nav-button-project' : 'main-nav-button', isActive ? 'main-nav-button-active' : ''].filter(Boolean).join(' ')
    return <button className={className} type="button" key={item.id} onClick={() => onViewChange(item.id)}>{item.label}</button>
  })}</nav>
}
