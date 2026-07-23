import type { SampleId } from './AudioEngine'

export interface GroupPadReference {
  patternGroupId: string
  padId: SampleId
}

export type ChannelId = string

export function createChannelId(reference: GroupPadReference): ChannelId {
  return `${reference.patternGroupId}:${reference.padId}`
}

export function sameGroupPadReference(left: GroupPadReference | null, right: GroupPadReference | null): boolean {
  return left?.patternGroupId === right?.patternGroupId && left?.padId === right?.padId
}
