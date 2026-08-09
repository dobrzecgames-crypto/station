import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { PatternGroup } from '../patterns/patternTypes'
import { useOutsideDismiss } from '../tracks/useOutsideDismiss'

interface BankSelectProps {
  groups: readonly PatternGroup[]
  selectedGroupId: string
  onSelect: (groupId: string) => void
  onRename: (groupId: string, name: string) => void
}

function customNameFor(group: PatternGroup): string {
  return /^Pattern\s+\d+$/i.test(group.name.trim()) ? '' : group.name.trim()
}

function labelFor(group: PatternGroup, index: number): string {
  const bankNumber = String(index + 1).padStart(2, '0')
  const customName = customNameFor(group)
  return customName ? `${bankNumber} · ${customName}` : `BANK ${bankNumber}`
}

export function BankSelect({ groups, selectedGroupId, onSelect, onRename }: BankSelectProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedIndex = groups.findIndex((group) => group.id === selectedGroupId)
  const selectedGroup = groups[selectedIndex]
  useOutsideDismiss(containerRef, open, () => { setOpen(false); setEditing(false) })

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const beginRename = () => {
    setDraftName(customNameFor(selectedGroup))
    setEditing(true)
  }

  const submitRename = (event: FormEvent) => {
    event.preventDefault()
    const name = draftName.trim()
    if (!name) return
    onRename(selectedGroup.id, name)
    setEditing(false)
    setOpen(false)
  }

  return <div className="bank-menu" ref={containerRef}>
    <button
      className="mixer-toggle bank-select-trigger"
      type="button"
      data-mechanism="selector"
      data-engaged={open}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={() => { setOpen((current) => !current); setEditing(false) }}
    >
      <span>{labelFor(selectedGroup, selectedIndex)}</span>
      <span className="bank-select-caret" aria-hidden="true">▾</span>
    </button>
    {open && <div className="bank-select-menu">
      {!editing ? <>
        <div role="listbox" aria-label="Banks">
          {groups.map((group, index) => <button
            className={group.id === selectedGroupId ? 'bank-select-option bank-select-option-active' : 'bank-select-option'}
            type="button"
            role="option"
            aria-selected={group.id === selectedGroupId}
            key={group.id}
            onClick={() => { onSelect(group.id); setOpen(false) }}
          >{labelFor(group, index)}</button>)}
        </div>
        <button className="bank-rename-action" type="button" onClick={beginRename}>RENAME CURRENT</button>
      </> : <form className="bank-rename-form" onSubmit={submitRename}>
        <label htmlFor="bank-rename-input">BANK {String(selectedIndex + 1).padStart(2, '0')} NAME</label>
        <input ref={inputRef} id="bank-rename-input" type="text" maxLength={24} value={draftName} onChange={(event) => setDraftName(event.target.value)} />
        <div>
          <button type="button" onClick={() => setEditing(false)}>CANCEL</button>
          <button type="submit" disabled={!draftName.trim()}>SAVE</button>
        </div>
      </form>}
    </div>}
  </div>
}
