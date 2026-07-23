# Station Smart Pump

## Product role

Pump is one of Station's primary musical differentiators. It replaces compressor-style setup with a direct musical action:

1. mark one or more ghost sidechain sources,
2. enable Pump on a target,
3. set depth,
4. choose a musical length,
5. choose the return character.

The first implementation is called **Basic Pump**. Automatic kick analysis is a later system called **Smart Kick Analysis**.

## Basic Pump MVP

### Source

- One or more user-selected pads may act as ghost trigger sources.
- A ghost trigger follows the marked pad's performance or sequencer step, including its step shift.
- The ghost trigger calls the Pump envelope directly; it does not route the source sample through its channel, group, master path or FX racks.
- All Pump timing uses the same AudioContext clock as sample playback.

### Targets

- Pump is enabled per target track.
- Any target track may respond to the same set of ghost sources, including a marked source pad when deliberately selected as a target.

### Processing

- Full-band volume shaping only.
- No compressor threshold, ratio, knee or detector routing.
- The source does not need to be analyzed in the MVP.

### Controls

#### DEPTH

Defines the maximum gain reduction.

The user-facing control should be musical and simple. Internal gain values must be clamped to safe ranges.

#### LENGTH

Defines the time from the trigger to full gain recovery.

MVP values should be tempo-relative, for example:

- 1/16,
- 1/8,
- 1/4,
- 1/2,
- 1 beat.

The exact initial set should be chosen through listening tests rather than maximizing options.

#### SHAPE

Three profiles share the same start and end points but distribute the return differently over time.

- **SNAP** — recovery happens earlier and feels tight or springy.
- **SMOOTH** — balanced, natural recovery and the default profile.
- **SWELL** — remains reduced longer, then rises more strongly near the end.

Shape and length are separate parameters. Selecting SNAP must not silently shorten the formal envelope length.

## Trigger behavior

A trigger should:

1. begin a very short click-safe transition toward the selected duck depth,
2. follow the selected return curve,
3. reach unity gain at the end of LENGTH.

The transition must feel immediate without introducing discontinuity clicks.

## Retrigger behavior

When another kick arrives before the previous envelope ends:

- do not stack uncontrolled gain reductions,
- do not create a discontinuity,
- begin the new envelope from a defined current or safely transitioned gain state,
- keep behavior deterministic at fast kick patterns.

The exact retrigger rule requires prototype listening tests. The MVP may use a restart-from-current-value strategy if it remains click-free and musically predictable.

## Basic Pump acceptance tests

Use at least:

- sustained bass,
- pad or chord sample,
- long texture,
- short percussion loop,
- four-on-the-floor kick,
- irregular kick pattern.

Basic Pump succeeds when:

- each profile is audibly distinct,
- DEPTH behaves predictably,
- musical lengths remain synchronized,
- rapid retriggers do not click or collapse the target level,
- the result remains useful without compressor terminology.

## Smart Kick Analysis — post-MVP

Automatic analysis should happen when a sample is imported or changed, not on every trigger.

Future analysis may estimate:

- transient start,
- body duration,
- low-frequency tail,
- practical audible end,
- recommended Pump length.

The analysis should not treat the full WAV file duration as kick length. It should ignore trailing silence and give particular weight to low-frequency energy, approximately in the 20-200 Hz region.

Potential stored metadata:

- analysis algorithm version,
- transient duration,
- body duration,
- sub-tail duration,
- estimated audible end,
- confidence value,
- recommended Pump length.

Future user modes may include:

- 1/2 x detected kick,
- 1 x detected kick,
- 2 x detected kick,
- manual tempo-relative length.

## Deferred Pump features

- LOW mode,
- SPLIT mode,
- separate low/high return times,
- independent Pump pattern,
- envelope overlap mode,
- automatic adaptation to the next kick interval,
- transient and beat detection,
- machine-learning analysis.

These features are not allowed to complicate the Basic Pump architecture until the core behavior has passed listening and timing tests.
