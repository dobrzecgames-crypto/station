# Pattern Group Banks — Architecture Decision and Implementation Brief

## Status

**Approved direction.**

This document defines the next major architectural step for Station.

The feature is intentionally split from Group Bus Mixer and Group Effects. The first implementation scope is **Pattern Group Banks only**.

## Product context

Station is a desktop-browser sampler groovebox.

Station is not a full DAW.

The current product already includes:

- one browser-based audio engine built on Web Audio API;
- 16-pad sequencing;
- Pattern Groups with variants A–D;
- Pattern Playlist and PATTERN / SONG modes;
- local project persistence;
- Project Key and Scale Map;
- Basic Pump;
- CHOP and non-destructive sample regions.

The next requirement is that different Pattern Groups may use different sounds on the same pad positions without affecting one another.

## Core product rule

A Pattern Group is not only a collection of pattern variants.

From now on, the intended product model is:

> **Pattern Group = Pattern Variants A–D + one private 16-pad bank + one future Group Bus**

The Group Bus is part of the target architecture, but it is **not implemented in the first task**.

## Why this change is necessary

The current shared-bank model means that all Pattern Groups use the same 16 pad configurations.

That creates the following limitation:

- Pattern Group 1 may trigger PAD 01;
- Pattern Group 2 may also trigger PAD 01;
- both currently resolve to the same pad configuration and therefore the same current sample;
- replacing or editing PAD 01 changes the sound for every Pattern Group.

This is not sufficient for the intended Playlist workflow.

The target behavior is:

- Pattern Group 1 / PAD 01 may be a kick;
- Pattern Group 2 / PAD 01 may be a bass sample;
- Pattern Group 3 / PAD 01 may be a vocal chop;
- all three Pattern Groups may play in parallel in SONG mode;
- editing PAD 01 in Pattern Group 1 must not modify PAD 01 in Pattern Group 2 or 3.

## Architectural model

### Pattern Group

Each Pattern Group owns:

- stable Pattern Group ID;
- label or display index;
- variants A–D;
- exactly one private 16-pad bank;
- future Group Bus settings.

Variants A–D share the bank of their Pattern Group.

They differ only in sequencer data:

- step activation;
- velocity;
- SHIFT.

They do not own separate pad banks.

### Pad Bank

Each Pattern Group bank contains exactly 16 pad configurations.

Each pad configuration owns its own:

- pad slot index;
- optional SampleAsset reference;
- filename and duration metadata;
- playback region;
- pitch;
- volume;
- mute;
- solo;
- CHOP-derived or Scale Map-derived configuration where applicable.

A pad bank must remain serializable.

It must not contain:

- AudioBuffer;
- AudioNode;
- active voice objects;
- waveform rendering objects;
- scheduler state;
- UI pressed state.

### Shared SampleAssets

Banks may reference the same SampleAsset without duplicating the underlying WAV or AudioBuffer.

Example:

```text
Group 1 / PAD 01
assetId: kick-123
pitch: 0

Group 2 / PAD 01
assetId: kick-123
pitch: -5
```

The audio asset is shared.

The pad configurations are independent.

Changing Group 2 pitch must not affect Group 1.

### Runtime channel identity

The current fixed channel identity based only on `pad-01` through `pad-16` is insufficient once multiple banks can play simultaneously.

Runtime identity must distinguish:

- Pattern Group;
- pad slot.

A suitable conceptual identity is:

```text
groupId + padId
```

For example:

```text
pattern-group-1:pad-01
pattern-group-2:pad-01
```

The exact TypeScript representation may differ, but collisions between the same pad number in different groups are not allowed.

### Audio routing target

The future routing model is:

```text
Voice
→ Pad Channel
→ Pad Pump
→ Group Bus
→ Group Effects
→ Master
```

For the Pattern Group Banks task, it is acceptable to stop at:

```text
Voice
→ Group-specific Pad Channel
→ existing downstream routing
→ Master
```

Do not add Group Effects in the first task.

Do not add a full plugin or arbitrary routing system.

## Pattern and Playlist behavior

A Pattern Clip points to:

- Pattern Group ID;
- variant A–D;
- start slot.

When the Playlist schedules a clip, it must resolve:

1. the Pattern Group;
2. the selected variant;
3. the Pattern Group's private bank;
4. the pad configuration from that bank;
5. the shared SampleAsset referenced by that pad.

Parallel Pattern Clips may therefore trigger:

- the same pad slot number;
- with different samples;
- with different regions;
- with different pitch;
- with different volume;
- from different Pattern Groups.

All such triggers must remain independent.

## Editing behavior

The currently selected Pattern Group determines which bank is edited in:

- PAD;
- SAMPLE;
- CHOP, where applicable;
- MIX pad-level controls;
- Scale Map.

Editing PAD 01 while Pattern Group 2 is selected modifies only:

```text
Pattern Group 2 → Bank → PAD 01
```

It must not modify PAD 01 in any other Pattern Group.

Switching variants A–D does not switch banks.

Switching Pattern Groups does switch banks.

## Creating Pattern Groups

### New empty Pattern Group

Creates:

- Pattern Group with variant A;
- empty variants B–D;
- a new empty 16-pad bank;
- future default Group Bus settings.

### Duplicate Pattern Group

If duplication is supported in the current or later UI, it should copy:

- variants;
- pad bank configurations;
- future Group Bus settings.

It must not duplicate WAV bytes or decoded AudioBuffers.

The duplicated bank should reference the same SampleAsset IDs but contain independent pad configuration objects.

## CHOP behavior

CHOP must operate on the currently selected Pattern Group bank.

A CHOP source and its live mapping belong to that group's bank context.

Requirements:

- mapped pads are written only into the selected group's bank;
- `chopSessionId` ownership must not collide across groups;
- replacing a CHOP source in one group must not alter pads or source state in another group;
- shared assets remain deduplicated;
- asset cleanup must consider references from every bank and every active CHOP source.

A global single CHOP Session is no longer sufficient if switching groups must preserve independent CHOP work.

The implementation must inspect the current model and choose the smallest safe migration path. It must not silently discard existing CHOP state.

## Scale Map behavior

Scale Map operates on the selected Pattern Group bank.

Mapping a sample to Project Scale:

- starts from the selected pad of the selected bank;
- fills only that bank;
- shares one SampleAsset within that bank;
- does not modify any other bank;
- uses the global Project Key as the mapping preference;
- writes normal independent pad configurations.

## Mixer behavior

The first Pattern Group Banks task should preserve pad-level volume, mute and solo independently per bank.

The intended later mixer design is:

### Group Mixer

Shows one group channel per Pattern Group plus Master.

Each Group Channel will later own:

- group volume;
- group mute;
- group solo;
- group effects.

### Pad Mixer

Shows 16 pad channels for the currently selected Pattern Group bank.

Do not implement Group Bus Mixer or Group Effects in the Pattern Group Banks task unless explicitly approved in a separate task.

## Pump behavior

Pump identity must no longer rely only on `pad-01`.

A Pump source or target must identify the specific group and pad.

Conceptually:

```text
Pattern Group 1 / PAD 01
```

must be different from:

```text
Pattern Group 2 / PAD 01
```

The first banks implementation must preserve existing Pump behavior without cross-triggering same-numbered pads in other groups.

Do not add Group Pump targeting yet.

Future Group Pump may allow one group's kick to pump another Group Bus, but that is outside this task.

## Persistence

Project persistence must save:

- all Pattern Groups;
- variants A–D;
- one private 16-pad bank per Pattern Group;
- all pad settings per bank;
- shared asset references;
- independent CHOP state per relevant group, if the product preserves it;
- Pump references using group-aware identity;
- selected Pattern Group and variant;
- Playlist clips.

Persistence must not duplicate asset blobs per bank.

Asset garbage collection must inspect references from:

- every pad in every bank;
- every preserved CHOP source;
- any other current asset owner.

Older projects with one global bank must migrate safely.

Recommended migration:

- existing global bank becomes the bank of Pattern Group 1;
- other existing Pattern Groups receive deliberate banks according to documented migration rules;
- no data may be silently lost;
- if migration cannot preserve semantics automatically, fail clearly rather than guess.

The exact migration rule must be based on the actual schema currently in the repository.

## Constraints

The task must preserve:

- maximum eight Pattern Groups;
- variants A–D only;
- 16 pads per bank;
- 16 steps per variant;
- shared SampleAssets;
- browser-first architecture;
- Web Audio timing authority;
- local persistence;
- Playlist parallel playback.

Do not add:

- unlimited banks unrelated to Pattern Groups;
- arbitrary pad routing;
- plugin hosting;
- full DAW mixer;
- audio clips;
- automation clips;
- per-group BPM;
- per-group swing;
- piano roll;
- timestretch;
- MIDI;
- Group Effects;
- Group Compressor;
- Group Pump;
- multiple master buses.

## Implementation order

### Stage 1 — Pattern Group Banks

Implement only:

- one private bank per Pattern Group;
- group-aware pad identity;
- independent editing;
- parallel playback with different sounds on the same pad index;
- persistence and migration;
- CHOP / Scale Map integration;
- preservation of pad-level mixer and Pump semantics.

### Stage 2 — Group Bus Mixer

Separate approved task:

- one Group Bus per Pattern Group;
- group volume;
- group mute;
- group solo;
- Pad Mixer for selected bank;
- Group Mixer plus Master.

### Stage 3 — Group Effects

Separate approved task:

- first simple compressor per Group Bus;
- later optional filter or saturation;
- no arbitrary plugin chain.

## Acceptance criteria for Stage 1

1. Pattern Group 1 / PAD 01 and Pattern Group 2 / PAD 01 may hold different samples.
2. Editing either pad does not affect the other.
3. Both may play simultaneously in SONG mode.
4. The same shared SampleAsset may be referenced by multiple banks without duplication.
5. Variants A–D of one Pattern Group share one bank.
6. Switching variants does not change the bank.
7. Switching Pattern Groups changes the active bank.
8. Scale Map modifies only the active bank.
9. CHOP mapping modifies only the active bank.
10. Pump source and targets do not collide between same-numbered pads in different groups.
11. SAVE / OPEN restores all banks and references.
12. Existing persisted projects migrate without silent data loss.
13. `pnpm typecheck`, `pnpm build` and `git diff --check` pass.
14. Manual browser test confirms parallel playback of different samples assigned to the same pad number in different groups.
