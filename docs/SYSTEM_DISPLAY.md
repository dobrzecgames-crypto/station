# The System Display

The strip in the transport that currently reads `120 BPM · 0% SWING`. This
document defines what it is, what may claim it, and the rules that hold when
several things want it at once.

Status: **sections 1–6 are built. Steps 1, 2 and 3 of section 8 are done** — the
panel is a slot, tempo is its default tenant, contexts claim and release it
through `SystemDisplayApi`, and the first adopter is live. The focus channel
(priority 3) is the one part of section 3 still unbuilt: today a context claims
on a discrete selection rather than while a control is held.

There are three adopters: the library's assign step, the transport's bank
actions (copy, clear, delete), and the pad's sample browser with its sound
controls. `SystemDisplayApi` also exposes `ownerId`, which the bank panel needs
— a context that re-claims whenever its data changes has to know when it has
been taken over, or it steals the display back from whoever replaced it on the
next change.

The pad browser is where a tenant first needed two screens, and it settled how
that works. It shipped with a `‹ 1 / 2 ›` pager above both — a row of chrome
whose only content was the news that a second screen existed, with no cue on
screen one about what screen two held. **A tenant navigates by its content, not
by a pager.** The way onto the sound screen is now the EDIT button on the row of
the sample actually loaded on the pad, and the way back is the `‹` that takes
the folder row's place, so each screen carries exactly one row of chrome.

EDIT appears only once a sample is on the pad. Volume, pitch, attack and release
belong to the pad, not to the library entry, so there is nothing to shape until
something is really in the project. When the loaded sample is not in the folder
being browsed — a different folder, or a chopped slice the library never had —
it gets a row under the list marked `ON PAD`, so its screen is never more than
one tap away.

The first adopter is **the library's assign step, not the FX slot** that
motivated the design. A deliberate swap: the library was the case actually
hurting — its pad grid sat open at the bottom of the workspace taking 42% of the
height to show sixteen disabled buttons, and it squeezed the sample list until
it scrolled. FX remains the better test of whether the idea generalises.

## 1. The idea

Station has one screen and many controls. That is the same problem a hardware
groovebox solves, and it solves it the same way: the display shows whatever you
last touched. It is not a status bar bolted to the top — it is the surface the
instrument speaks and listens through, and the only element in the interface
that emits light rather than reflecting it.

The problem it is meant to remove: to change a compressor's threshold you
currently open MIX, scroll to the bus, open the FX slot, and work in a panel far
from the transport. The parameter you are adjusting is nowhere near the PLAY
button you are using to audition it. On a phone that means scrolling away from
the thing you are listening to, every time.

## 2. Two halves

The display is a **line** and a **panel**, and this split already exists — the
tempo settings that drop out of it are the panel.

| Half | Height | Holds |
| --- | --- | --- |
| Line | one or two rows of mono text | The current message, readout, or focused value |
| Panel | one fixed height, whoever owns it | The full control set for whatever owns the display |

The line is always present. The panel opens on tap and is where the actual
editing happens. Both live inside the same glass, so opening the panel **grows
the screen** rather than spilling controls into the transport grid around it —
which is what the settings used to do, via `display: contents`.

**The panel is one size for every tenant**, set by `--display-panel-height` on
`.system-display`. It used to take its height from its content, so the same tap
in SEQ, PAD and MIX moved the workspace by three different amounts and the
display stopped reading as a fixed part of the machine. A screen does not resize
itself to fit what is on it: tenants with more rows than fit scroll inside the
glass, and tenants with fewer leave it unlit. Two rows of a step editor and six
of a compressor now open to the same rectangle.

A tenant whose `panel` is `null` — the resting MIX readout, the library's drop
prompt — renders **no chevron and no tap target while the panel is shut**. Both
used to render for it anyway, so tapping the display in MIX toggled state that
produced nothing: an affordance promising a screen that never arrived. While the
panel is open they render for any tenant, because an open panel must always have
a way shut, and because a line-only tenant taking over must not collapse the
display. It holds the height and shows dark glass.

The panel is a slot, and tempo is the tenant in it: LOOP SONG, METRONOME, BPM,
SWING. A tenant supplies the readout for the line and the controls for the
panel, and the display renders both without knowing what either means. **What
remains is to let contexts take the slot for themselves,** so tempo is the
default owner rather than the only one.

That framing matters because it means this is not a new component. It is a
generalisation of one that works.

### The parameter row

Every parameter in the panel uses one shape, `.display-param`: name on the left,
value on the right, control across the full width beneath them. It survives long
labels, it stacks, and it is what a compressor's five parameters will need.

```
┌─────────────────────────────────┐
│ THRESHOLD              -18.0 dB │
│ ──────────●───────────────────  │
└─────────────────────────────────┘
```

Anything added to the panel should use this row rather than inventing a layout,
so a delay and a compressor read as the same instrument.

### One trap, already hit

The line's tap target is an absolutely positioned button. While the display was
a single row, spanning it across the whole component was harmless. With a panel
inside, that same button sits **on top of every slider** and swallows the drag.
The surface must cover the line only. If the display ever grows a third region,
this is the first thing to re-check.

## 3. Channels

Four kinds of content compete for the line. They are listed in priority order —
higher always wins.

| Priority | Channel | Lifetime | Source today |
| --- | --- | --- | --- |
| 1 | **Error** | 2 s, then releases | `errorMessage` |
| 2 | **Confirmation** | 4 s, then releases | `projectMessage` |
| 3 | **Focus** *(proposed)* | While a control is held or focused | — |
| 4 | **Readout** | Always, as the floor | `bpm` / `swing` |

Errors outrank everything on purpose while they are visible. They release after
two seconds so a minor blocked action does not leave the instrument looking
failed indefinitely.

## 4. Tone

Tone is carried by one custom property, `--display-light`, which drives the
backlight, the character bloom, and the text colour together. Values come from
the fixed status palette in `docs/DESIGN_SYSTEM.md` and **never** from the
module accent — a failure must look identical in SEQ and in MIX.

Everything inside the glass draws from that one property, at different
strengths: a parameter name is the light at 55%, its value at full with bloom,
an unavailable row at 25%, the hairline between rows at 8%, a slider's track at
22% and its cap at full. Nothing in here takes a grey from the app palette or a
cap from the module accent, which is what makes the whole readout change tone
together instead of the message line changing alone.

| Tone | Light | Bloom |
| --- | --- | --- |
| idle | `226 232 220` | 20% |
| status | `181 199 118` | 38% |
| error | `183 120 120` | 38% |

## 5. Ownership contract *(proposed)*

One owner at a time. A context claims the display, renders into the panel, and
releases when it goes away.

```ts
interface DisplayContext {
  /** Stable identity. Claiming with the same id twice is a no-op. */
  id: string
  /** Shown on the line when this context owns the display, e.g. "COMP · THRESHOLD". */
  label: string
  /** Pre-formatted for the line. The display never formats values itself. */
  readout: string
  /** Rendered into the panel while this context is the owner. */
  panel: ReactNode
}

interface SystemDisplayApi {
  claim(context: DisplayContext): void
  /** Releases only if `id` is still the current owner - prevents a late
      release from a stale context stealing the display from a newer one. */
  release(id: string): void
}
```

The release-by-id guard is not optional. Without it, a context unmounting
asynchronously after a newer one has claimed will blank a display that is no
longer its own.

## 6. Rules

These are the constraints that make the difference between a display and a
place where text goes.

1. **The display never formats.** Owners supply `readout` already formatted,
   with units. The display cannot know that `0.01` is `10 ms` and not `1%`.
2. **The floor is never empty.** With no owner and no message, the readout
   channel shows tempo. A dark strip in the transport is dead weight.
3. **Errors are not suppressible.** A claim changes the panel and may change the
   line, but an error takes the line back immediately.
4. **One source of truth.** If a value is editable both in place and on the
   display, both edit the same state. The display holds no copy.
5. **Focus does not announce.** The line is a live region for messages. A value
   changing as a slider is dragged must not be announced — a screen reader
   would read every intermediate value. Focus readouts render with
   `aria-live="off"`; only message channels are `status` / `alert`.
6. **Claims are cheap.** A claim on every pointermove during a drag would
   re-render the transport on every frame. Claim on interaction start, update
   the readout through a ref or a throttled path, release on end.

## 7. What this does not solve

Honest limits, so they are decided rather than discovered:

- **A phone screen still only fits so much.** A compressor has five parameters.
  Putting them in the panel does not make them smaller — it moves them next to
  the transport, which is the actual win, but the panel will scroll for the
  larger effects.
- **You lose sight of what you are editing.** Editing an FX slot from the
  transport means the slot itself may be off screen. If a meter or a waveform is
  part of understanding the parameter, moving the control away from it hurts.
  Effects with visual feedback may belong in place.
- **Discoverability.** Nothing tells the user the display now holds the
  compressor. The panel opening on a tap is the only cue, and it is weak.
- **Two ways to do one thing** is a cost, not a feature. If a parameter is
  editable in the panel, decide whether the in-place control stays. Keeping both
  doubles the surface to test and to keep consistent.

## 8. Suggested order of work

Each step is useful on its own and can be stopped after.

1. ~~Turn the panel into a slot with tempo as the default owner.~~ **Done.** No
   behaviour change — this is the refactor that makes the rest possible.
2. ~~Add the claim/release API.~~ **Done** — see `shell/systemDisplayContext.tsx`.
   The focus channel at priority 3 is still open: nothing yet claims *while a
   control is held*, only on a discrete selection.
3. ~~Adopt it in one place only.~~ **Done, in the library rather than the FX
   slot** — see the note at the top. Use it for a while before spreading it.
4. Decide, from that experience, whether in-place controls stay or go.

Resist doing 1 through 4 in one pass. Step 3 is where the design is proven or
disproven, and the answer changes what step 4 should be.

## 9. Open questions

- Does a focused parameter replace the readout on the line, or sit beside it?
- ~~Does the panel stay open when focus moves between contexts, or re-collapse?~~
  **Settled: it stays open. Open is the user's state and nothing else writes
  it.** The first answer was that the panel follows the owner, and the code that
  came out of it forced the panel shut on every change of owner — justified as
  keeping a context from moving the workspace under the pointer. That reasoning
  was half right: shutting the panel moves the workspace exactly as far as
  opening it would, and it fires on something the user did not ask for. Changing
  tabs with the panel open now leaves the display exactly as tall as it was, so
  the navigation under a thumb does not slide out from under it. `claim` and
  `release` no longer touch the open state at all, which is also why they hold a
  stable identity across renders.
- Should the display be reachable by keyboard as a landmark, so the parameter
  set can be operated without hunting for the control?
