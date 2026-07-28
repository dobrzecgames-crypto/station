# Vinyl Dust — Color Bible

This document defines the fixed visual roles for Station. A colour communicates a
role, not the currently open workspace.

## Scene (always fixed)

| Role | Token | Value |
| --- | --- | --- |
| Void | `--scene-void` | `#0B0C14` |
| Sky shadow | `--scene-sky` | `#201B2B` |
| Chassis | `--scene-chassis` | `#101019` |
| Panel | `--scene-panel` | `#181720` |
| Card | `--scene-card` | `#221E22` |
| Control surface | `--scene-control` | `#2B2527` |
| Recess | `--scene-recess` | `#090A10` |
| Hairline | `--scene-line` | `#443B3D` |
| Strong rim | `--scene-line-strong` | `#67554E` |

Text is ivory `#EEE4D6` with muted text `#C8BCAE`; pure white is not a UI colour.

## Function (always fixed)

| Meaning | Token | Value |
| --- | --- | --- |
| Primary action / selection | `--action-accent` | `#C86F50` |
| Pressed action | `--action-pressed` | `#9F4937` |
| Loaded sample / stored material | `--loaded-accent` | `#B99A62` |
| Ready, focus, playback signal | `--signal-accent` | `#83BED2` |
| Strong focus | `--signal-focus` | `#B5E0EB` |
| Recording / critical | `--status-recording` | `#CF5450` |
| Warning | `--status-warning` | `#D4A563` |

## Workspace identity

CHOP is plum, PADS gold, SEQ lavender, SONG dusty rose and MIX petrol. These
colours belong to the top navigation, headings and small scope labels only.
They do not recolour buttons, pads, sequencer steps or panels. PROJECT is a
System Display tenant rather than a workspace and therefore uses the display's
smoke-blue light.

## Light and material

The chassis is the darkest enclosing material: controls and cards are mounted
inside it rather than floating directly on the page. Blue light is reserved for the System Display, ON/READY lamp, keyboard focus and
the thin marker for the currently playing sequencer step. REC is the only red
light. Controls remain matte with a narrow rim, a restrained lower shadow and a
short pressed depth; navigation, pads and CTAs do not emit decorative glow.
