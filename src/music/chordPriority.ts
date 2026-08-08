/** Last-pad priority makes one SMART CHORDS bank behave as one monophonic
 * chord instrument. Releasing an older pad never cuts the newer chord. */
export class ChordPriority {
  private serial = 0
  private active: { padId: string; token: string } | null = null

  press(scopeId: string, padId: string): { token: string; previousToken?: string } {
    const previousToken = this.active?.token
    const token = `chord:${scopeId}:${++this.serial}:${padId}`
    this.active = { padId, token }
    return { token, previousToken }
  }

  release(padId: string): string | undefined {
    if (this.active?.padId !== padId) return undefined
    const token = this.active.token
    this.active = null
    return token
  }

  clear(): string | undefined {
    const token = this.active?.token
    this.active = null
    return token
  }
}
