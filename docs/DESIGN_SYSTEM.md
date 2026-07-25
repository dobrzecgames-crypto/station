# Station Design System — "Lab Interface"

Extracted from the `STATION LAB INTERFACE / COLOR CODED MODULES` reference sheet.
This is the source of truth for colour, shape and type. Implementation lives in
`src/index.css` (tokens) and `src/App.css` (application).

## 1. The core idea

Station is one instrument built from six modules. The chassis is identical
everywhere — same greys, same shapes, same spacing. **Only the accent changes per
module.** You should be able to tell which workspace you are in from a glance at
the colour, without reading a single label.

Two colour systems run side by side and must never be confused:

| System | Changes per module? | Used for |
| --- | --- | --- |
| **Module accent** | Yes | Active tab, active buttons, headings, focus ring, selection, meter fill |
| **Status** | No | Audio lamp, ready/loaded marks, warnings, recording, errors |

A green "READY" mark means ready in every module. If status colours drifted with
the accent, the user would have to re-learn the code six times.

## 2. Global surface ramp

Darkest to lightest. Every panel in the app is built from these five values.

| Token | Value | Role |
| --- | --- | --- |
| `--station-bg` | `#0D1112` | Page backdrop, behind everything |
| `--station-panel` | `#14191A` | Module panel body |
| `--station-card` | `#1A2021` | Cards and wells inside a panel |
| `--station-raised` | `#212829` | Buttons, inputs, anything you touch |
| `--station-line` | `#323B3C` | Borders, dividers, grid rules |

## 3. Text

| Token | Value | Role |
| --- | --- | --- |
| `--station-text` | `#E3E5DC` | Primary copy, values, labels |
| `--station-text-muted` | `#BF9997` | Secondary labels, units, hints |
| `--station-text-disabled` | `#555E5D` | Disabled controls, empty-state text |

> **One value to confirm:** `--station-text-muted` is the only token read from
> small type in the reference image rather than from an unambiguous swatch. It is
> transcribed as `#BF9997` (a warm grey). If the intent was a neutral mid-grey,
> `#8F9997` sits more evenly between primary and disabled on the ramp. Confirm
> before this token spreads further.

## 4. Module accents

| Module | Token | Value | Reads as |
| --- | --- | --- | --- |
| LIBRARY | `--accent-library` | `#6FA8A3` | Teal |
| CHOP | `--accent-chop` | `#C69A62` | Amber / tan |
| PADS | `--accent-pads` | `#B6C879` | Yellow-green |
| SEQ | `--accent-seq` | `#8F86B8` | Violet |
| SONG | `--accent-song` | `#B77878` | Dusty red |
| MIX | `--accent-mix` | `#6E91A6` | Steel blue |
| PROJECT | `--accent-project` | `#8A9490` | Slate |

PROJECT does not appear on the reference sheet — it is a settings surface, not a
performance module. It gets a desaturated slate so it reads as system chrome
rather than a seventh instrument.

The active accent is exposed as `--station-accent`, switched by a `data-view`
attribute on the shell. Components reference `var(--station-accent)` and never a
module colour directly, so adding or re-tinting a module is a one-line change.

For translucent accent fills, `--station-accent-rgb` carries the same colour as
space-separated channels, for use as `rgb(var(--station-accent-rgb) / 20%)`.

## 5. Status colours

Fixed across every module.

| Token | Value | Meaning |
| --- | --- | --- |
| `--status-active` | `#B5C776` | Audio on, sample loaded, slot ready |
| `--status-inactive` | `#555E5D` | Off, unlit, no signal |
| `--status-warning` | `#C69A62` | Starting up, bypassed, needs attention |
| `--status-recording` | `#B77878` | Recording, destructive action |

`--status-warning` and `--status-recording` share values with the CHOP and SONG
accents. That is intentional in the reference sheet — the palette is deliberately
small — but they are separate tokens because they answer different questions.
Never substitute one for the other.

## 6. Typography

| Role | Family | Weight |
| --- | --- | --- |
| Headings, module titles, transport | Rajdhani | SemiBold |
| Body copy, labels, buttons | Inter | Regular |
| Numeric data, times, BPM, dB, step counts | IBM Plex Mono | Regular |

The mono face is not decoration — it is what makes columns of numbers line up and
stop jittering as values change. Anything that is a *measurement* is mono.

Not yet implemented: the app currently ships system faces (Segoe UI Variable,
Bahnschrift). Adopting these three requires self-hosting the web fonts.

## 7. Shape

- **Radius:** small and consistent — 4px on controls, 6px on panels. Nothing
  pill-shaped except status chips.
- **Borders:** 1px hairlines in `--station-line`. Structure comes from the border
  and the surface step, not from shadow.
- **Module header:** a two-digit index, a slash, then the name — `01 / LIBRARY` —
  in the module accent. The index makes the set feel like one rack.
- **Density:** tight. Labels are small, uppercase, letter-spaced; values are
  large and mono. Label above, value below.

## 8. Open question: depth

The reference sheet is **flat**. Controls are hairline rectangles that fill with
the accent when active; sliders are thin tracks with a small handle; there are no
gradients, bevels or drop shadows.

The app currently carries a skeuomorphic hardware treatment in the other
direction — a raised power switch with a carved bezel, gradient key faces, and
console faders with grooved caps riding a printed scale. Adopting the reference
sheet wholesale means removing that work.

This is a real fork in the road and is deliberately left undecided here. See the
implementation notes in `DECISIONS.md` once it is settled.
