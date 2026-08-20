import type { PatternGroup } from '../patterns/patternTypes'
import type { AudioTrack } from '../tracks/tracksTypes'
import './groupMix.css'

export type MixScope = 'group' | 'track' | 'master'

interface MixTargetSelectorProps {
  groups: readonly PatternGroup[]
  selectedGroup: PatternGroup
  /** Audio tracks are real, independent mixer buses too (see
      tracks/tracksTypes.ts's AudioTrack docs) - this extends the existing
      target row rather than opening a parallel routing surface. */
  tracks: readonly AudioTrack[]
  selectedTrackId: string | null
  scope: MixScope
  onSelectGroup: (groupId: string) => void
  onSelectTrack: (trackId: string) => void
  onScopeChange: (scope: MixScope) => void
}

/** Chooses which bus the display is showing.
 *
 *  This is all that is left in the workspace of what used to be a collapsed
 *  `BUS & FX` disclosure holding the bus level, its mute/solo and both FX
 *  slots. Those are properties of the chosen bus, so they moved onto the
 *  display; choosing between buses is a move between places, so it stayed
 *  here - and stopped being hidden behind a triangle, which is what made the
 *  whole FX path feel like something you had to already know about. */
export function MixTargetSelector({ groups, selectedGroup, tracks, selectedTrackId, scope, onSelectGroup, onSelectTrack, onScopeChange }: MixTargetSelectorProps) {
  return <section className="mixer mix-routing-content" aria-label="Mix target">
    <div className="mixer-channel-heading">
      <p className="eyebrow">BUS &amp; FX</p>
    </div>
    <div className="mix-routing-targets" role="group" aria-label="Mix target">
      {groups.map((group, index) => {
        const isActive = scope === 'group' && group.id === selectedGroup.id
        return <button
          className={isActive ? 'mixer-toggle mixer-selector-active' : 'mixer-toggle'}
          key={group.id}
          type="button"
          aria-pressed={isActive}
          onClick={() => { onScopeChange('group'); onSelectGroup(group.id) }}
        >G{index + 1}</button>
      })}
      {tracks.map((track, index) => {
        const isActive = scope === 'track' && track.id === selectedTrackId
        return <button
          className={isActive ? 'mixer-toggle mixer-selector-active' : 'mixer-toggle'}
          key={track.id}
          type="button"
          aria-pressed={isActive}
          title={track.name}
          onClick={() => { onScopeChange('track'); onSelectTrack(track.id) }}
        >T{index + 1}</button>
      })}
      <button
        className={scope === 'master' ? 'mixer-toggle mixer-selector-active' : 'mixer-toggle'}
        type="button"
        aria-pressed={scope === 'master'}
        onClick={() => onScopeChange('master')}
      >MASTER</button>
    </div>
  </section>
}
