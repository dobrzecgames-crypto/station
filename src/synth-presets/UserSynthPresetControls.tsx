import { useEffect, useRef, useState } from 'react'
import { StationConfirm } from '../shell/StationConfirm'
import { userSynthPresetRepository } from './UserSynthPresetRepository.ts'
import { applyUserSynthPreset, normalizeUserSynthPresetName } from './userSynthPresetCore.ts'
import type { UserSynthPreset, UserSynthPresetKind, UserSynthPresetPatchMap } from './userSynthPresetCore'
import './UserSynthPresetControls.css'

interface UserSynthPresetControlsProps<K extends UserSynthPresetKind> {
  kind: K
  instrumentLabel: string
  patch: UserSynthPresetPatchMap[K]
  onApply: (patch: UserSynthPresetPatchMap[K]) => void
}

interface PendingOverwrite { presetId: string; name: string }

export function UserSynthPresetControls<K extends UserSynthPresetKind>({ kind, instrumentLabel, patch, onApply }: UserSynthPresetControlsProps<K>) {
  const [presets, setPresets] = useState<UserSynthPreset<K>[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [pendingOverwrite, setPendingOverwrite] = useState<PendingOverwrite | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [notice, setNotice] = useState('')
  const selected = presets.find((preset) => preset.id === selectedId)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void userSynthPresetRepository.list(kind)
      .then((items) => {
        if (cancelled) return
        setPresets(items)
        setSelectedId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? '')
      })
      .catch((error) => { if (!cancelled) setNotice(toMessage(error)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [kind])

  const persist = async (name: string, replaceId?: string) => {
    setBusy(true)
    setNotice('')
    try {
      const saved = await userSynthPresetRepository.save(kind, name, patch, replaceId)
      const items = await userSynthPresetRepository.list(kind)
      setPresets(items)
      setSelectedId(saved.id)
      setNameDialogOpen(false)
      setPendingOverwrite(null)
      setNotice(`${saved.name} SAVED`)
    } catch (error) {
      setNotice(toMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const submitName = (value: string) => {
    try {
      const name = normalizeUserSynthPresetName(value)
      const existing = presets.find((preset) => preset.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)
      if (existing) {
        setNameDialogOpen(false)
        setPendingOverwrite({ presetId: existing.id, name })
        return
      }
      void persist(name)
    } catch (error) {
      setNotice(toMessage(error))
    }
  }

  const loadSelected = () => {
    if (!selected) return
    onApply(applyUserSynthPreset(patch, selected))
    setNotice(`${selected.name} LOADED`)
  }

  const deleteSelected = async () => {
    if (!selected) return
    setBusy(true)
    setNotice('')
    try {
      await userSynthPresetRepository.delete(selected.id)
      const items = await userSynthPresetRepository.list(kind)
      setPresets(items)
      setSelectedId(items[0]?.id ?? '')
      setDeletePending(false)
      setNotice(`${selected.name} DELETED`)
    } catch (error) {
      setNotice(toMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <section className="user-synth-presets" aria-label={`${instrumentLabel} user presets`}>
      <label className="user-synth-preset-picker">
        <span>USER PRESETS</span>
        <select value={selectedId} disabled={loading || busy || presets.length === 0} onChange={(event) => { setSelectedId(event.target.value); setNotice('') }}>
          {presets.length === 0 && <option value="">NO SAVED PRESETS</option>}
          {presets.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
        </select>
      </label>
      <div className="user-synth-preset-actions">
        <button type="button" disabled={busy} onClick={() => { setNotice(''); setNameDialogOpen(true) }}>SAVE</button>
        <button type="button" disabled={busy || !selected} onClick={loadSelected}>LOAD</button>
        <button className="user-synth-preset-delete" type="button" disabled={busy || !selected} onClick={() => setDeletePending(true)}>DELETE</button>
      </div>
      <p className={notice ? 'user-synth-preset-notice user-synth-preset-notice-active' : 'user-synth-preset-notice'} aria-live="polite">{notice || `${presets.length} SAVED`}</p>
    </section>

    {nameDialogOpen && <SynthPresetNameDialog
      instrumentLabel={instrumentLabel}
      initialValue={patch.name}
      busy={busy}
      onSubmit={submitName}
      onCancel={() => setNameDialogOpen(false)}
    />}
    {pendingOverwrite && <StationConfirm
      message={`Replace the saved ${instrumentLabel} preset ${pendingOverwrite.name} with the current sound?`}
      confirmLabel="REPLACE"
      onConfirm={() => { const pending = pendingOverwrite; setPendingOverwrite(null); void persist(pending.name, pending.presetId) }}
      onCancel={() => setPendingOverwrite(null)}
    />}
    {deletePending && selected && <StationConfirm
      message={`Delete the ${instrumentLabel} preset ${selected.name}?`}
      confirmLabel="DELETE"
      onConfirm={() => { setDeletePending(false); void deleteSelected() }}
      onCancel={() => setDeletePending(false)}
    />}
  </>
}

function SynthPresetNameDialog({ instrumentLabel, initialValue, busy, onSubmit, onCancel }: {
  instrumentLabel: string
  initialValue: string
  busy: boolean
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(initialValue)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog?.open) dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  return <dialog
    ref={dialogRef}
    className="synth-preset-name-dialog"
    aria-labelledby="synth-preset-name-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}
  >
    <form className="synth-preset-name-frame" onSubmit={(event) => { event.preventDefault(); if (!busy && name.trim()) onSubmit(name) }}>
      <p>STATION / {instrumentLabel} / USER PRESET</p>
      <h2 id="synth-preset-name-title">SAVE CURRENT SOUND</h2>
      <label>
        <span>PRESET NAME</span>
        <input autoFocus maxLength={40} value={name} disabled={busy} onChange={(event) => setName(event.target.value)} />
      </label>
      <div>
        <button type="button" disabled={busy} onClick={onCancel}>CANCEL</button>
        <button type="submit" disabled={busy || !name.trim()}>SAVE</button>
      </div>
    </form>
  </dialog>
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message.toUpperCase() : 'PRESET OPERATION FAILED'
}
