# Station — Pattern / Song and Pattern Naming UX Decision

## Status

- Type: product and UI/UX decision
- Scope: interface hierarchy and pattern identification
- Out of scope: DSP, audio routing, sequencer timing and new DAW features

## Decision

Station should present `PATTERN` and `SONG` as the two clear arrangement modes:

- `PATTERN` opens the step grid used to decide when pads play.
- `SONG` opens the playlist used to arrange existing patterns.

Selecting the Pattern workspace should select Pattern playback. Selecting the Song workspace should select Song playback. In other workspaces such as PADS, CHOP and MIX, the user may still switch the playback mode from the compact global transport.

The current technical name `SEQ` should be presented to the user as `PATTERN`.

## Pattern identity

Every pattern must have:

- an automatically assigned number;
- an optional user-defined name.

Examples:

```text
01 · PERKA 1
02 · PERKA 2
03 · SAMPLE 1
04 · SAMPLE 2
05 · SAMPLE 3
06 · BAS
07 · SYNTH
```

The number is the stable technical identifier and ordering aid. The name is the main human-readable label.

A missing name must not block work. An unnamed pattern is displayed as:

```text
PATTERN 03
```

## Pattern workspace

The current pattern should be clearly displayed and easy to browse:

```text
<  03 · SAMPLE 1  >
```

The user must be able to move smoothly between patterns using:

- previous and next controls;
- a horizontally scrollable pattern strip;
- touch swipe on mobile;
- mouse wheel or trackpad where appropriate on desktop.

Suggested compact strip:

```text
01 PERKA 1 | 02 PERKA 2 | 03 SAMPLE 1 | 04 SAMPLE 2 | 05 BAS
```

The selected pattern must remain visually obvious.

Pattern actions should include:

- New Pattern;
- Duplicate;
- Rename;
- Clear;
- Delete.

These actions should not compete visually with the step grid and may live in a compact pattern menu.

## Song playlist

The playlist must display pattern names so the user can identify material without guessing from numbers.

Preferred clip presentation:

```text
03
SAMPLE 1
```

On narrow screens the number may be reduced to a small badge, but the name should remain the dominant label whenever space permits.

Examples of readable playlist content:

```text
PERKA 1 | SAMPLE 1 | BAS | PERKA 2
```

The existing pattern and playlist data model should remain unchanged unless implementation proves a minimal schema addition is necessary for storing the optional name.

## Acceptance criteria

- The main navigation uses `PATTERN`, not `SEQ`.
- Opening PATTERN shows the step grid and selects Pattern playback.
- Opening SONG shows the playlist and selects Song playback.
- Every pattern has an automatic number.
- Every pattern may have an optional editable name.
- Pattern names are visible in the playlist.
- An unnamed pattern falls back to `PATTERN NN`.
- The user can browse patterns without opening a separate management screen.
- Pattern naming does not change DSP, routing or timing.
- No new DAW-style timeline or automation system is introduced.
