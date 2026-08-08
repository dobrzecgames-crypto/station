# Codex Task — Interface Phase 1: Physical Selector Foundation

## Role

You are implementing one narrowly scoped visual/interaction task in the Station repository.

Station is a browser-first sampler groovebox designed as an instrument, not a generic web app. Do not redesign product features.

## Read before editing

- `README.md`
- `AGENTS.md`
- `docs/COLOR_BIBLE.md`
- `docs/INTERFACE_BIBLE.md`
- `docs/INTERFACE_ROLLOUT.md`
- `docs/SYSTEM_DISPLAY.md` only for awareness; do not redesign it in this task
- inspect the current `src/index.css`, `src/lab-interface.css`, `src/App.css` and the component that renders the main workspace navigation
- inspect recent commits before editing

## Task title

Physical main navigation selector keys

## Goal

Change the main Station workspace navigation so it no longer reads as generic web tabs/buttons. It should behave visually like a mechanically interlocked row of cassette-radio selector keys: one key remains physically depressed for the current workspace; selecting another depresses the new key and releases the previous one. Preserve all existing navigation logic, workspace identities and Vinyl Dust colour semantics.

This is the first proof of the new Station physical language. Do not spread the rest of the redesign across the app yet.

## Existing implementation to challenge

The current Lab Interface CSS already gives `.main-nav-button` a shallow face and pressed inner shadow, but the active state is primarily a filled workspace accent with decorative bloom. That still reads too much like an active app tab/button.

The new state hierarchy must be:

1. physical depth/light communicates **engaged vs released**;
2. Vinyl Dust colour communicates workspace/semantic identity;
3. colour alone must not be required to understand which key is mechanically engaged.

## Allowed scope

- main workspace navigation markup only if a small semantic/state adjustment is genuinely required;
- `src/lab-interface.css` and existing shared CSS variables/tokens relevant to the selector key;
- small additions to `src/index.css` only if reusable physical-state variables are needed;
- reduced-motion handling for the newly introduced motion;
- tests directly needed to preserve existing navigation behaviour.

## Out of scope

- changing the Vinyl Dust palette or workspace accent values;
- pads;
- sliders/faders/knobs;
- System Display appearance or behaviour;
- changing Inter, Rajdhani or IBM Plex Mono in this task;
- choosing new fonts;
- restyling every button in Station;
- feature logic changes;
- reorganising navigation destinations;
- broad CSS cleanup or architecture refactor;
- adding dependencies;
- decorative 3D/skeuomorphic effects.

## Interaction model

Treat the main navigation as one **SELECTOR** group as defined in `INTERFACE_BIBLE.md`.

Required behaviour:

- one current workspace key is always visually engaged;
- engaged key remains shallowly depressed after pointer/touch release;
- tapping/clicking another key makes the new key engage and the old key release;
- tapping the already selected key must not visually toggle it off;
- actual pointer-down on an unselected key may briefly show the physical press before navigation state settles;
- no `scale(...)` press effect;
- no layout shift that moves neighbouring keys or changes the navigation row height;
- no essential state communicated by hover;
- keep keyboard navigation and `:focus-visible` usable;
- pointer/touch cancellation must not leave a false pressed state.

## Visual direction

Use **shallow physical depth**, not heavy skeuomorphism.

Released key:

- slightly raised hard-control face;
- restrained top-edge catch and lower seating shadow/rim;
- matte, not glossy.

Physically held key:

- top catch collapses/inverts;
- face reads as moving inward/down a very small amount;
- inner shadow/recess may carry the press;
- keep the motion very fast.

Engaged/selected key:

- remains at the depressed depth after release;
- should still read as engaged in greyscale;
- workspace accent may remain present, but remove/reduce decorative bloom if it fights the mechanical reading;
- do not turn the key into a glowing tile.

Suggested timing range from the Bible:

- press around 40–70 ms;
- release around 60–100 ms.

Tune by eye in the real UI rather than treating one exact millisecond value as sacred.

## Technical constraints

- preserve current React/navigation behaviour;
- CSS/visual state should follow existing selected workspace state rather than duplicating product state;
- avoid introducing JS timers for purely visual press/release animation;
- do not use `transition: all`;
- animate only the properties needed for the physical model;
- respect `prefers-reduced-motion`;
- preserve touch-first operation and desktop mouse/keyboard use;
- preserve current app dimensions/layout.

## Acceptance criteria

The task is complete only when:

1. The active workspace key appears mechanically depressed after release.
2. Switching workspaces reads as one key engaging while the previous key releases.
3. The selected key is still identifiable if the screen is viewed in greyscale.
4. Workspace accent semantics from Vinyl Dust are preserved.
5. There is no decorative neon/bloom requirement for active state.
6. There is no generic scale-down click animation.
7. Hover is optional feedback only and not required to understand state.
8. Keyboard focus remains clearly visible.
9. No navigation behaviour or workspace routing changes.
10. No unrelated controls are restyled.
11. Build/typecheck/tests pass to the extent they exist.

## Manual verification

Check at minimum:

- switch repeatedly through every main workspace with mouse;
- click the already active workspace;
- press and drag/cancel off a key if pointer behaviour supports it;
- tab through navigation with keyboard and activate with keyboard;
- visually inspect normal, held and engaged states;
- temporarily inspect in greyscale/desaturated view to confirm physical state remains legible;
- test reduced-motion preference if practical;
- verify the navigation row does not jump or change height.

If real touch hardware is not available, say so explicitly; do not claim a touch test that was not performed.

## Stop condition

**Stop after Phase 1.**

Do not continue to pads, fonts, sliders or the display. The purpose of this task is to get one physical family correct and let Damian approve the feel before it becomes a system-wide pattern.

## Required final report

Return:

1. concise summary of what changed;
2. exact changed-file list;
3. any reusable physical-state tokens/classes introduced;
4. commands/tests run and exact results;
5. manual checks performed;
6. manual checks still required by Damian;
7. any conflict found between old `DESIGN_SYSTEM.md` rules and the new Interface Bible;
8. risks/browser/touch concerns;
9. explicit confirmation that no out-of-scope Phase 2+ work was performed.
