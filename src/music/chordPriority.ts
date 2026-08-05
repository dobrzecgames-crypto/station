/** Last-pad-priority state kept outside React so pointer/key release races are
 * deterministic and directly testable. Releasing an older held pad never
 * returns it and never affects the token of the newer chord. */
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
