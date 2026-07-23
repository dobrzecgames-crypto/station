export type MainView = 'chop' | 'pad' | 'seq' | 'sample' | 'mix'

interface MainNavigationProps {
  view: MainView
  onViewChange: (view: MainView) => void
}

const views: MainView[] = ['chop', 'pad', 'seq', 'sample', 'mix']

export function MainNavigation({ view, onViewChange }: MainNavigationProps) {
  return <nav className="main-navigation" aria-label="Main views">{views.map((item) => <button className={view === item ? 'main-nav-button main-nav-button-active' : 'main-nav-button'} type="button" key={item} onClick={() => onViewChange(item)}>{item.toUpperCase()}</button>)}</nav>
}
