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
| Station identity / focus / currently running | `--focus-accent` | `#C86F50` |
| Pressed Station focus | `--focus-pressed` | `#9F4937` |
| Pattern identity / musical material | `--music-accent` | `#6E748A` |
| Pressed musical material | `--music-pressed` | `#50566A` |
| Active SEQ step / merged event | `--sequencer-accent` | `#718B72` |
| Pressed SEQ step | `--sequencer-pressed` | `#4D6351` |
| Active function / tool | `--control-active` | `#7891A3` |
| Pressed function / tool | `--control-active-pressed` | `#526878` |
| Inactive function / tool | `--control-inactive` | `--scene-control` |
| PLAY | `--transport-play` | `#819868` |
| Pressed PLAY | `--transport-play-pressed` | `#5C704A` |
| STOP / destructive | `--transport-stop` | `#AD675B` |
| Pressed STOP / destructive | `--transport-stop-pressed` | `#7E443D` |
| Loaded sample / stored material | `--loaded-accent` | `#B99A62` |
| Ready / display playback signal | `--signal-accent` | `#83BED2` |
| Strong display signal | `--signal-focus` | `#B5E0EB` |
| Recording / critical | `--status-recording` | `#CF5450` |
| Warning | `--status-warning` | `#D4A563` |

`--action-accent` and `--action-pressed` remain compatibility aliases for the
focus pair. New component styling must choose the narrowest semantic role
instead of treating either alias as a universal active colour.

## Pattern identity

Each Pattern Group owns one faded pigment from `--pattern-group-1` through
`--pattern-group-8`. Variants A-D derive four nearby shades from that group
token: A is lightest, B is the base pigment, C is slightly shaded and D is the
deepest. The transport's A-D selector, SONG lane label and SONG clip must use
the same derived colour. Orange may outline the selected/current or playing
pattern, but it must not replace that pattern's identity colour.

## Workspace identity

CHOP is plum, PADS gold, SYNTH moss green, STRINGS dusty blue, SEQ lavender,
SONG dusty rose and MIX petrol. These
colours belong to the top navigation, headings and small scope labels only.
They do not recolour buttons, pads, sequencer steps or panels. Active sequencer
steps and merged events use the fixed forest-green `--sequencer-accent`; SEQ
lavender continues to identify the workspace key only. PROJECT is a
System Display tenant rather than a workspace and therefore uses the display's
smoke-blue light.

## Light and material

The chassis is the darkest enclosing material: controls and cards are mounted
inside it rather than floating directly on the page. Smoke-blue light remains
reserved for the System Display and ON/READY signal. Orange marks keyboard
focus, selected high-priority objects and the currently playing sequencer step.
PLAY is muted olive green; STOP and destructive actions are dusty brick red;
REC retains the brighter fixed recording red. Controls remain matte with a
narrow rim, a restrained lower shadow and a short pressed depth; navigation,
pads and CTAs do not emit decorative glow.
