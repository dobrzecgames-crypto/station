import { patternVariantNames } from '../patterns/patternTypes'
import type { PatternGroup, PatternVariantName } from '../patterns/patternTypes'
import type { DisplayTenant } from './SystemDisplay'

interface BankPanelProps {
  bankNumber: number
  group: PatternGroup
  variant: PatternVariantName
  canDelete: boolean
  onDuplicate: (target: PatternVariantName) => void
  onClear: () => void
  onDelete: () => void
}

/** Everything you can do to a bank and the pattern inside it, one tap from the
 *  selector that names them. These used to live at the bottom of the PROJECT
 *  tab, four screens away from the arrows you were already looking at - the
 *  code called that a holding spot and it was right. */
export function bankTenant(props: BankPanelProps): DisplayTenant {
  return {
    id: 'bank-manage',
    label: 'Bank and pattern',
    readout: `BANK ${props.bankNumber} · PATTERN ${props.variant}`,
    panel: <BankPanel {...props} />,
  }
}

function BankPanel({ bankNumber, group, variant, canDelete, onDuplicate, onClear, onDelete }: BankPanelProps) {
  const targets = patternVariantNames.filter((name) => name !== variant)
  return <>
    <div className="display-param">
      <span className="display-param-label">COPY {variant} TO</span>
      <div className="display-actions">
        {targets.map((target) => (
          /* A target that already holds a pattern is marked, not blocked: the
             handler asks before it overwrites, and hiding the option would send
             you back to guessing which letters are free. */
          <button key={target} className="display-action" type="button" onClick={() => onDuplicate(target)}>
            {target}{group.variants[target] ? '*' : ''}
          </button>
        ))}
      </div>
    </div>
    <div className="display-param">
      <span className="display-param-label">PATTERN {variant}</span>
      <div className="display-actions"><button className="display-action" type="button" onClick={onClear}>CLEAR</button></div>
    </div>
    <div className="display-param">
      <span className="display-param-label">BANK {bankNumber}</span>
      <div className="display-actions">
        <button className="display-action display-action-danger" type="button" disabled={!canDelete} onClick={onDelete}>DELETE</button>
      </div>
    </div>
  </>
}
