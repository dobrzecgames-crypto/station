# Station Interface Bible

Status: **source of truth for physical interaction, material, motion and typography direction**.

This document does not replace `COLOR_BIBLE.md`. `COLOR_BIBLE.md` remains the source of truth for palette and colour semantics. `SYSTEM_DISPLAY.md` remains the source of truth for display ownership/content behaviour. This document defines how Station should *feel* when touched and how its visual language avoids generic app/AI styling.

If an older visual rule in `DESIGN_SYSTEM.md` conflicts with this document, use this document for interaction/material/type decisions and `COLOR_BIBLE.md` for colour decisions.

---

## 1. Core identity

Station is not a website dressed like hardware and it is not a historical replica of one existing sampler.

The internal design sentence is:

> **1980s hardware in 2050, seen through the faded colour sensibility of the 1970s.**

This sentence has three separate jobs:

- **1980s = form and tactility.** Physical keys, cassette-radio selectors, rubber pads, printed labels, compact instrument logic, obvious mechanical state.
- **2050 = capability and execution.** Modern precision, responsive touch, high-resolution graphics, intelligent interaction and no artificial recreation of old technological limitations.
- **1970s = colour/material sensibility.** Already defined by Vinyl Dust: faded pigment, warm/cool restraint, no neon-future cliché.

Do not turn this into synthwave nostalgia, VHS decoration, fake CRT damage, cyberpunk, an MPC clone or a museum replica.

The goal is a future instrument whose design language appears to have evolved continuously from physical electronic equipment instead of converging on generic app UI.

---

## 2. The anti-generic rule

A Station screen should still be recognisable as Station if the logo is removed.

Avoid the common visual shortcuts that make AI-generated or component-library interfaces converge on the same look:

- one generic button treatment for every action,
- pill buttons as a default shape,
- large decorative glow,
- `transform: scale(...)` as the standard pressed state,
- `transition: all`,
- slow 200–300 ms easing on normal instrument actions,
- hover as the primary communication channel,
- active state communicated only by a bright fill,
- uppercase + large letter spacing on every label,
- generic SaaS typography,
- cards inside cards inside cards,
- gradients used to manufacture personality,
- identical radius/depth treatment for controls that should feel like different materials,
- intentionally bad/pixelated graphics merely to look old.

The interface may be clean and precise. "De-AI" does **not** mean adding dirt, random asymmetry or fake technological defects. It means making deliberate product-specific decisions instead of using fashionable defaults.

---

## 3. One instrument, several physical families

There is no generic `button` in the conceptual model. Every interactive surface belongs to a physical family.

### 3.1 SELECTOR KEY

Use for mutually exclusive instrument modes, especially the main workspace row such as LASER / PADS / SYNTH / SEQ / MIX and equivalent destinations.

Mental model: **mechanically interlocked cassette-radio keys**.

Rules:

- exactly one member of a selector group is down when the group requires a current mode;
- pressing another key depresses the new key and releases the previous one;
- pressing the already selected key does not switch the mode off;
- selected state is primarily communicated by physical depth/light, not only colour;
- the selected key remains visually lower than its neighbours;
- the release/depress exchange should feel nearly simultaneous;
- do not use a web-tab underline as the primary state;
- do not use scale shrink as the physical metaphor.

Colour still follows Vinyl Dust semantics and workspace identity, but colour is secondary to the mechanical state.

### 3.2 LATCH / TOGGLE

Use for persistent binary functions such as REVERSE, MUTE or other true on/off states.

Rules:

- first press leaves the control mechanically engaged;
- second press releases it;
- engaged state must remain understandable without requiring decorative glow;
- do not style a latch identically to a mutually exclusive selector if the context would become ambiguous.

### 3.3 MOMENTARY ACTION

Use for actions that happen now and do not represent an ongoing mode: FIRE, clear/duplicate-style actions where applicable, trigger-like actions.

Rules:

- press -> action -> release;
- it must never remain visually latched after completion unless the underlying product state truly persists;
- response is fast and firm;
- FIRE may be slightly more tactile than an ordinary utility action because it is a performance-like trigger.

### 3.4 PERFORMANCE PAD

Pads are **not buttons**. They are a separate material and interaction family.

Mental model: modern soft-touch rubber performance surface.

Rules:

- matte, slightly soft visual material;
- resting pad has shallow physical volume;
- direct touch produces compression, not a generic web-button shrink;
- pressed state may combine very small vertical compression, inner shadow/light inversion and tiny deformation;
- release is fast with a subtle elastic return, never a visible cartoon bounce;
- `pressed`, `playing` and `selected-for-editing` are three different states and must never be represented by the same physical effect;
- physical depression is reserved for actual pointer/touch/key press, not for the entire duration of sample playback;
- sample-loaded state follows Vinyl Dust semantics and must not turn the pad into a glowing tile.

The user should feel that the performance pads are made from a different material than the navigation keys.

### 3.5 CONTINUOUS CONTROL

Sliders/faders/knobs are controls with resistance and precision, not Material UI widgets.

Rules:

- visual movement follows the user's control immediately;
- do not add smoothing that makes musical control feel delayed;
- touch interpretation may be intelligent, but the visual response must remain direct;
- fader caps/handles should read as physical objects riding a track;
- decorative rings, neon arcs and generic VST knob clichés are not the default;
- final geometry/touch sensitivity is tuned in the real Station UI, not guessed solely from a design document.

---

## 4. Material model

Station uses a small set of believable material behaviours rather than one universal flat component language.

### Chassis / panel

- structural, matte and restrained;
- provides the mounting plane for controls;
- does not need fake scratches, noise or photoreal texture;
- depth comes from a coherent light model and surface hierarchy.

### Hard control plastic

Used for selector keys, toggles and momentary buttons.

- harder edge than rubber pads;
- shallow top highlight / lower shadow when raised;
- pressed state inverts/reduces the highlight and moves the perceived face inward/down;
- avoid glossy plastic and exaggerated bevels.

### Rubber

Used primarily for performance pads.

- softer edge transition;
- more diffuse highlight than hard controls;
- accepts subtle deformation on press;
- never glassy.

### Display glass

The System Display is the deliberate exception to the reflective control surfaces: **it emits light**.

Preserve the existing principle in `SYSTEM_DISPLAY.md`: the display is recessed into the instrument and is the surface through which Station speaks and listens.

---

## 5. Motion language

Instrument controls must react faster than ordinary app UI.

General direction, to be tuned by eye and touch in the real application:

- hard-key press: roughly 40–70 ms;
- hard-key release: roughly 60–100 ms;
- rubber-pad release/compression cycle: roughly 80–130 ms;
- ordinary workspace changes: visually immediate;
- no ornamental spring animation on normal controls.

These are tuning ranges, not immutable constants. The test is perceptual: the user should feel mechanics, not notice animation.

Rules:

- no `transition: all`;
- animate only properties that support the physical model;
- avoid layout movement that shifts neighbouring controls under the user's finger;
- hover may provide a very subtle desktop affordance but must never carry essential state;
- touch/pressed states take priority over hover styling.

---

## 6. State grammar

A major source of generic or confusing UI is using the same visual treatment for unrelated states.

Keep these concepts separate:

- **pressed** = the user is physically holding/activating a control now;
- **latched** = a binary control remains on;
- **selected** = this is the current member of a selector group or the object currently being edited;
- **playing** = audio/event is currently active;
- **loaded/stored** = musical material exists here;
- **ready/focus/recording/warning/error** = status semantics defined by `COLOR_BIBLE.md`.

Do not make all of the above mean "filled with accent colour".

Geometry/depth may communicate physical state. Colour communicates the semantic roles from Vinyl Dust.

---

## 7. Typography architecture

Station has **two primary typographic worlds**, not one universal UI font.

### 7.1 PANEL FACE

Used for physical-panel text: navigation keys, button labels, printed control names and ordinary instrument markings.

Direction:

- non-digital;
- feels suitable for printing/engraving on an electronic instrument;
- distinctive enough that Station does not resemble a generic web product;
- compact and legible at small sizes;
- not an obvious sci-fi/techno display font;
- not a fashionable SaaS default;
- tracking should be intentional and generally restrained;
- uppercase is allowed where appropriate, but must not be applied to every piece of text merely as decoration.

**Inter is not the target panel identity and is scheduled for replacement.**

The final face must be selected by visual comparison in Station. Coding agents must not autonomously choose a final replacement font just because it is available on Google Fonts.

### 7.2 DISPLAY FACE

Used inside the System Display and for content that visually belongs to Station's internal computer.

Direction:

- digital / device-like / computer-like;
- can feel related to instrumentation or an imagined machine terminal;
- should not become a stereotypical pixel font, Matrix terminal or faux-broken CRT;
- modern high-resolution rendering is allowed and preferred;
- character comes from the type design and layout, not artificial degradation.

**Rajdhani is scheduled for replacement.** Its current suitability is not a reason to keep a generic futuristic UI identity.

### 7.3 Numeric face

Measurements need stable widths/tabular behaviour. The current IBM Plex Mono solves a functional problem, but it is not automatically protected from replacement.

When the typography pass happens, evaluate whether measurements should:

1. use the Display Face with tabular numerals,
2. use a dedicated numeric/mono companion,
3. retain a mono family only where alignment genuinely requires it.

Do not retain a third face merely because it already exists.

### Typography rule for agents

Until the human design pass chooses the final fonts:

- do not introduce additional font families;
- do not substitute another fashionable web font as a temporary "upgrade";
- do not rewrite the typography system outside an explicitly approved typography task.

---

## 8. System Display direction

Colour/light behaviour and ownership are already defined elsewhere and should be preserved.

The display should feel like Station's internal computer, but Station lives in the future. Therefore:

- no forced low-resolution simulation;
- no fake scanline/VHS/CRT damage unless explicitly approved as a subtle functional effect;
- high-resolution waveforms and modern visualisation are allowed;
- information layout may borrow the directness of instrumentation: labels, values, lines, compact indicators;
- avoid putting generic cards/pills/dashboard chrome *inside* the display;
- the final display typeface should make the screen recognisable without requiring decorative effects.

---

## 9. Colour relationship

Do not redesign the palette in an interaction task.

`COLOR_BIBLE.md` owns:

- scene/chassis/panel colours,
- action/pressed accents,
- loaded material,
- signal/focus,
- recording/warning/error,
- workspace identity.

Interaction work must use those semantic tokens rather than inventing new per-component colours.

The physical model must still work in greyscale. If a control communicates its entire state only through colour, the interaction design is incomplete.

---

## 10. Geometry and depth

Do not return to heavy skeuomorphism.

The target is **shallow physical depth**:

- enough to tell touchable hard plastic from panel;
- enough to tell a depressed selector from a released neighbour;
- enough to make a rubber pad compress;
- not enough to look like a 2010 skeuomorphic website or a 3D render.

Existing 4 px / 6 px radii may be retained where they work, but radius is no longer a universal identity rule. Different material families may use subtly different edge treatment when justified.

Any new shadow/highlight must belong to one coherent light model. Do not stack unrelated bevel, shadow and glow treatments.

---

## 11. Accessibility and input

Physical feeling must not break usability.

- preserve keyboard focus and visible focus indication;
- keep touch targets practical;
- do not depend on hover;
- do not remove semantic button/ARIA behaviour for visual reasons;
- `prefers-reduced-motion` should remove non-essential elastic/transition effects without hiding state;
- pointer/touch cancellation must return momentary controls and pads to their resting visual state;
- visual pressed state must follow real interaction state, not get stuck after interrupted touch.

---

## 12. Implementation rules for coding agents

For any UI task:

1. Read `COLOR_BIBLE.md`, this file, and the relevant feature/system document before changing CSS/components.
2. Classify every touched control as SELECTOR, LATCH, MOMENTARY, PAD or CONTINUOUS CONTROL.
3. Do not invent a sixth interaction metaphor because a local component is awkward.
4. Reuse semantic CSS variables/tokens rather than hard-coding new colours.
5. Keep physical state separate from semantic colour state.
6. Make the smallest coherent change; do not restyle unrelated screens.
7. Do not choose new final fonts without explicit approval.
8. Test with mouse and touch/pointer semantics where relevant.
9. Verify that state remains understandable without hover.
10. Report any conflict between current CSS and this Bible instead of silently reconciling it in a new ad-hoc style.

---

## 13. Implementation order

Do not redesign the whole application in one pass.

Recommended order:

1. **Foundation tokens/classes** for physical state and reduced motion.
2. **Main selector row** — prove the cassette-radio interlock feeling.
3. **Performance pads** — prove the rubber material and pressed/playing/selected separation.
4. **Momentary and latch controls** — map existing controls to the correct family.
5. **Continuous controls** — fader/slider/knob geometry and touch feeling.
6. **Typography selection** — human-reviewed Panel Face + Display Face, then implementation.
7. **Display typography/layout refinement** without changing its ownership contract.
8. **Consistency audit** across all workspaces.

Each stage should be accepted visually and by touch before the next stage spreads the language across the app.

---

## 14. Acceptance test for the final language

The interface language succeeds when:

- the active main mode looks mechanically engaged even in greyscale;
- changing modes visually resembles one interlocked key releasing while another engages;
- a performance pad feels softer than a navigation key;
- a playing pad is distinguishable from a physically held pad;
- momentary actions never look accidentally latched;
- the display reads as the instrument's internal computer, not as another web card;
- no essential state depends on hover;
- the UI remains fast enough for musical use;
- removing the Station logo does not make the interface look like a generic AI-generated music dashboard;
- Vinyl Dust remains intact rather than being replaced with a new decorative colour system.
