export interface CompressorConfig {
  enabled: boolean
  thresholdDb: number
  ratio: number
  attackSeconds: number
  releaseSeconds: number
}

export type DelayDivision = '1/2' | '1/4' | '1/8' | '1/16'

export interface DelayConfig {
  enabled: boolean
  sync: boolean
  division: DelayDivision
  timeSeconds: number
  feedback: number
  mix: number
}

export type EffectType = 'none' | 'compressor' | 'delay'

export interface EffectSlotState {
  id: string
  type: EffectType
  enabled: boolean
  compressor: CompressorConfig
  delay: DelayConfig
}

export interface EffectRackState {
  slots: [EffectSlotState, EffectSlotState]
}

export const availableEffects = [
  { type: 'none', label: 'NONE' },
  { type: 'compressor', label: 'COMPRESSOR' },
  { type: 'delay', label: 'DELAY' },
] as const

export const defaultCompressorConfig: CompressorConfig = {
  enabled: false,
  thresholdDb: -18,
  ratio: 4,
  attackSeconds: 0.01,
  releaseSeconds: 0.25,
}

export const defaultDelayConfig: DelayConfig = {
  enabled: false,
  sync: true,
  division: '1/4',
  timeSeconds: 0.25,
  feedback: 0.35,
  mix: 0.2,
}

const delayDivisionBeats: Record<DelayDivision, number> = {
  '1/2': 2,
  '1/4': 1,
  '1/8': 0.5,
  '1/16': 0.25,
}

export function createEffectSlotState(id: string, type: EffectType = 'none', enabled = false, compressor: CompressorConfig = defaultCompressorConfig, delay: DelayConfig = defaultDelayConfig): EffectSlotState {
  return {
    id,
    type,
    enabled,
    compressor: { ...compressor },
    delay: { ...delay },
  }
}

export function createEmptyEffectRack(scope: string): EffectRackState {
  return {
    slots: [
      createEffectSlotState(`${scope}:fx-slot-1`),
      createEffectSlotState(`${scope}:fx-slot-2`),
    ],
  }
}

export function createDefaultMasterEffectRack(): EffectRackState {
  return {
    slots: [
      createEffectSlotState('master:fx-slot-1', 'delay'),
      createEffectSlotState('master:fx-slot-2', 'compressor'),
    ],
  }
}

export function createMigratedMasterEffectRack(delay: unknown, compressor: unknown): EffectRackState {
  const normalizedDelay = normalizeDelayConfig(delay)
  const normalizedCompressor = normalizeCompressorConfig(compressor)
  return {
    slots: [
      createEffectSlotState('master:fx-slot-1', 'delay', normalizedDelay.enabled, normalizedCompressor, normalizedDelay),
      createEffectSlotState('master:fx-slot-2', 'compressor', normalizedCompressor.enabled, normalizedCompressor, normalizedDelay),
    ],
  }
}

export function cloneEffectRackState(rack: EffectRackState): EffectRackState {
  return { slots: rack.slots.map((slot) => ({ ...slot, compressor: { ...slot.compressor }, delay: { ...slot.delay } })) as EffectRackState['slots'] }
}

export function normalizeEffectRackState(value: unknown, scope: string, defaultRack: EffectRackState = createEmptyEffectRack(scope)): EffectRackState {
  const slots = (value as Partial<EffectRackState> | null | undefined)?.slots
  if (!Array.isArray(slots) || slots.length !== 2) return cloneEffectRackState(defaultRack)
  return {
    slots: [
      normalizeEffectSlotState(slots[0], `${scope}:fx-slot-1`, defaultRack.slots[0]),
      normalizeEffectSlotState(slots[1], `${scope}:fx-slot-2`, defaultRack.slots[1]),
    ],
  }
}

export function normalizeCompressorConfig(value: unknown): CompressorConfig {
  const config = value as Partial<CompressorConfig> | null | undefined
  return {
    enabled: typeof config?.enabled === 'boolean' ? config.enabled : defaultCompressorConfig.enabled,
    thresholdDb: toBoundedNumber(config?.thresholdDb, -60, 0, defaultCompressorConfig.thresholdDb),
    ratio: toBoundedNumber(config?.ratio, 1, 12, defaultCompressorConfig.ratio),
    attackSeconds: toBoundedNumber(config?.attackSeconds, 0.003, 0.1, defaultCompressorConfig.attackSeconds),
    releaseSeconds: toBoundedNumber(config?.releaseSeconds, 0.05, 1, defaultCompressorConfig.releaseSeconds),
  }
}

export function normalizeDelayConfig(value: unknown): DelayConfig {
  const config = value as Partial<DelayConfig> | null | undefined
  const division = config?.division
  return {
    enabled: typeof config?.enabled === 'boolean' ? config.enabled : defaultDelayConfig.enabled,
    sync: typeof config?.sync === 'boolean' ? config.sync : defaultDelayConfig.sync,
    division: division === '1/2' || division === '1/4' || division === '1/8' || division === '1/16' ? division : defaultDelayConfig.division,
    timeSeconds: toBoundedNumber(config?.timeSeconds, 0.02, 1, defaultDelayConfig.timeSeconds),
    feedback: toBoundedNumber(config?.feedback, 0, 0.85, defaultDelayConfig.feedback),
    mix: toBoundedNumber(config?.mix, 0, 0.5, defaultDelayConfig.mix),
  }
}

export function getDelayTimeSeconds(config: DelayConfig, bpm: number): number {
  const safeBpm = toBoundedNumber(bpm, 60, 200, 120)
  const requestedTime = config.sync ? (60 / safeBpm) * delayDivisionBeats[config.division] : config.timeSeconds
  return toBoundedNumber(requestedTime, 0.02, 2, defaultDelayConfig.timeSeconds)
}

export function isEffectRackState(value: unknown, scope: string): value is EffectRackState {
  const slots = (value as Partial<EffectRackState> | null | undefined)?.slots
  return Array.isArray(slots) && slots.length === 2 && slots.every((slot, index) => {
    const value = slot as Partial<EffectSlotState> | null | undefined
    return value?.id === `${scope}:fx-slot-${index + 1}`
      && (value.type === 'none' || value.type === 'compressor' || value.type === 'delay')
      && typeof value.enabled === 'boolean'
      && isCompressorConfig(value.compressor)
      && isDelayConfig(value.delay)
  })
}

function normalizeEffectSlotState(value: unknown, id: string, fallback: EffectSlotState): EffectSlotState {
  const slot = value as Partial<EffectSlotState> | null | undefined
  const type = slot?.type === 'none' || slot?.type === 'compressor' || slot?.type === 'delay' ? slot.type : fallback.type
  return createEffectSlotState(
    id,
    type,
    typeof slot?.enabled === 'boolean' ? slot.enabled : fallback.enabled,
    normalizeCompressorConfig(slot?.compressor),
    normalizeDelayConfig(slot?.delay),
  )
}

function isCompressorConfig(value: unknown): value is CompressorConfig {
  const config = value as Partial<CompressorConfig> | null | undefined
  return typeof config?.enabled === 'boolean'
    && typeof config.thresholdDb === 'number' && Number.isFinite(config.thresholdDb) && config.thresholdDb >= -60 && config.thresholdDb <= 0
    && typeof config.ratio === 'number' && Number.isFinite(config.ratio) && config.ratio >= 1 && config.ratio <= 12
    && typeof config.attackSeconds === 'number' && Number.isFinite(config.attackSeconds) && config.attackSeconds >= 0.003 && config.attackSeconds <= 0.1
    && typeof config.releaseSeconds === 'number' && Number.isFinite(config.releaseSeconds) && config.releaseSeconds >= 0.05 && config.releaseSeconds <= 1
}

function isDelayConfig(value: unknown): value is DelayConfig {
  const config = value as Partial<DelayConfig> | null | undefined
  return typeof config?.enabled === 'boolean'
    && typeof config.sync === 'boolean'
    && (config.division === '1/2' || config.division === '1/4' || config.division === '1/8' || config.division === '1/16')
    && typeof config.timeSeconds === 'number' && Number.isFinite(config.timeSeconds) && config.timeSeconds >= 0.02 && config.timeSeconds <= 1
    && typeof config.feedback === 'number' && Number.isFinite(config.feedback) && config.feedback >= 0 && config.feedback <= 0.85
    && typeof config.mix === 'number' && Number.isFinite(config.mix) && config.mix >= 0 && config.mix <= 0.5
}

function toBoundedNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, value))
}
