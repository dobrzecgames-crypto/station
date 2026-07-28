export type MainView = 'chop' | 'pad' | 'seq' | 'song' | 'mix' | 'pump' | 'project'

interface MainNavigationProps {
  view: MainView
  onViewChange: (view: MainView) => void
}

const views: ReadonlyArray<{ id: MainView; label: string }> = [
  { id: 'chop', label: 'CHOP' },
  { id: 'pad', label: 'PADS' },
  { id: 'seq', label: 'SEQ' },
  { id: 'song', label: 'SONG' },
  { id: 'mix', label: 'MIX' },
  { id: 'pump', label: 'PUMP' },
  { id: 'project', label: 'PROJECT' },
]

export function MainNavigation({ view, onViewChange }: MainNavigationProps) {
  return <nav className="main-navigation" aria-label="Workspaces">{views.map((item) => {
    const isActive = view === item.id
    const className = ['main-nav-button', isActive ? 'main-nav-button-active' : ''].filter(Boolean).join(' ')
    return <button className={className} data-workspace={item.id} type="button" key={item.id} onClick={() => onViewChange(item.id)}>{item.label}</button>
  })}</nav>
}
