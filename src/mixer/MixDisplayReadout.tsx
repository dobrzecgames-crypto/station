import { useEffect, useMemo } from 'react'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'

const displayId = 'mix-readout'

/** Keeps the display line in the MIX context without opening a second panel. */
export function MixDisplayReadout() {
  const { claim, release, ownerId } = useSystemDisplay()
  const tenant = useMemo<DisplayTenant>(() => ({
    id: displayId,
    label: 'Mix overview',
    readout: 'MIX / CHANNELS / BUS & FX',
    panel: null,
  }), [])

  useEffect(() => {
    if (ownerId === null || ownerId === displayId) claim(tenant)
  }, [claim, ownerId, tenant])

  useEffect(() => () => release(displayId), [release])

  return null
}
