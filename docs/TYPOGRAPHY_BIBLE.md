# Station Typography Bible

Status: **source of truth for typography architecture, font roles, hierarchy and font-selection rules in Station.**

**Family decision (accepted):** Inter is the one family for the entire physical machine — it carries both the MODULE and STATION roles. The System Display keeps a separate mono family. This was a human design decision, made after the Typography Lab pass; it is recorded here, not proposed. What remains open is weight/size/tracking tuning inside that decision, not the family count.

`COLOR_BIBLE.md` remains the source of truth for colour.  
`INTERFACE_BIBLE.md` remains the source of truth for physical interaction, material and motion.  
`SYSTEM_DISPLAY.md` remains the source of truth for System Display behaviour and ownership.

If an older typography rule in `DESIGN_SYSTEM.md`, `INTERFACE_BIBLE.md` or another document conflicts with this file, **this file wins for typography**.

---

## 1. Station is an instrument, not conventional app UI

Station should not be typographically designed as a normal mobile application.

The conceptual model is:

> **The phone screen becomes the surface of a virtual musical instrument. Inside that instrument sits a separate System Display.**

This creates two physical worlds:

1. **THE MACHINE** — chassis, keys, labels, parameters, sliders, pads and controls.
2. **THE INTERNAL COMPUTER** — the recessed System Display.

Typography must reinforce this distinction.

The System Display is allowed to look typographically different from the rest of Station because, conceptually, it is a screen mounted inside the instrument.

Do not attempt to make all typography look like one conventional app design system.

---

## 2. Two fonts: one for the machine, one for its computer

Station uses **two typefaces**.

One typeface is the entire physical Station instrument — chassis, keys, panel, controls, alike.

The other belongs exclusively to its internal computer.

The architecture is:

### A. MACHINE FACE — Inter

Inter is the single family for the whole physical instrument. It carries two roles, MODULE and STATION, that differ in **treatment** (weight, size, tracking, casing, how the text sits in its control) rather than in typeface. Section 3 below defines that relationship; sections 4-8 define what each role needs from Inter.

#### A1. MODULE role

Used only for the main physical workspace selector keys:

`LASER`  
`PADS`  
`SYNTH`  
`SEQ`  
`SONG`  
`WAVES`  
`MIX`

These keys are not ordinary navigation tabs.

Together they define the primary architecture of Station.

Each workspace is a major organ of the instrument and may contain enough functionality to resemble a small application on its own.

Changing workspace changes both the working surface and the available System Display context.

The MODULE role therefore has a privileged role and must not spread casually into the rest of the interface — not as a font choice (there is only one machine font now), but as a *treatment*: its weight/size/tracking/casing combination belongs to these seven keys and nowhere else.

#### A2. STATION role

The primary working typography of the physical machine.

Used for essentially all non-display interface typography outside the seven main module keys:

- section names,
- parameter groups,
- parameter labels,
- control labels,
- instrument names,
- synth browser text,
- mixer labels,
- FX names,
- project controls,
- transport annotations where they belong to the physical panel,
- explanatory copy,
- secondary navigation,
- buttons other than the main module selector keys.

This role provides continuity across the instrument.

It must work across several weights and sizes without becoming visually noisy.

### B. DISPLAY FACE

Used **only inside the System Display** and for content that conceptually belongs to its internal computer. A separate mono family from Inter — see section 9.

Examples:

`120 BPM`  
`BANK 08`  
`PAD 01`  
`-18.0 dB`  
`READY`  
`FILTER`  
`ATTACK 12 ms`

The Display Face may be substantially different from MODULE and STATION.

This difference is desirable.

It should reinforce the impression that the Display is an electronic subsystem mounted inside Station.

The DISPLAY FACE must not leak into ordinary panel labels merely because it looks technical.

---

## 3. MODULE and STATION are one font, two treatments

MODULE and STATION are both Inter. The distinction between them is no longer a font choice — it is everything *around* the font choice:

- weight,
- size,
- tracking,
- casing,
- how the text is embedded in its control (a key's engraved legend vs. a panel label sitting flat),
- hierarchy/position.

A useful relationship, unchanged in spirit from the earlier two-font version of this document:

> MODULE = strong character  
> STATION = controlled character

MODULE may sit heavier and tighter because it appears in only seven permanent labels. STATION must carry a large amount of information and therefore needs greater restraint - lighter weights, calmer tracking, more levels of hierarchy (section 6).

Contrast between the two should still look intentional and legible at a glance, even though it is now built from the same typeface's own range rather than from two different families.

---

## 4. MODULE role — physical key lettering

Mental model:

> lettering embedded, moulded, engraved or heat-marked into a hard plastic key.

References may include physical selector keys, cassette-radio controls, Walkman-era electronics, industrial control panels and elevator buttons from the late twentieth century.

This is a conceptual reference, not a request for historical imitation.

### Desired properties

- uppercase works extremely well;
- strong silhouette;
- compact enough for narrow mobile keys;
- clearly readable at small size;
- may be slightly condensed;
- medium-heavy or bold construction is acceptable;
- distinctive without becoming decorative;
- should survive low contrast and shallow physical depth;
- should feel plausible as lettering placed on a manufactured object.

### Weight

MODULE labels may be substantially heavier than ordinary Station labels.

A visual equivalent around medium-bold / bold is acceptable when the chosen font supports it.

Exact numeric CSS weight is **not decided by this document**.

The final weight must be chosen by testing the actual key.

### Key rule

The heavy weight is justified by the object's physical role.

Do not copy this heavy treatment to parameter labels.

### Letter treatment

Avoid:

- huge artificial tracking,
- wide `L A S E R` lettering,
- futuristic stencil clichés,
- fake seven-segment lettering,
- sci-fi techno fonts,
- glow,
- outline lettering,
- chrome effects.

A very restrained inset/engraved text treatment may be used when the physical selector-key design supports it.

The lettering should appear to belong to the key material rather than float above it as web text.

---

## 5. STATION role — the working language of the instrument

The Station role carries almost everything else.

It needs character, but its primary job is clarity.

The target is **not**:

- corporate cleanliness,
- fintech UI,
- generic SaaS,
- sterile office software,
- trendy portfolio typography,
- futuristic dashboard typography.

The desired character is closer to:

- graphic,
- editorial,
- functional,
- slightly industrial,
- musical,
- compact,
- deliberate.

It may contain subtle unusual details that become recognisable with repeated use.

It should not advertise itself as a "special font".

A useful target is:

> **90% useful, 10% strange.**

---

## 6. Hierarchy inside the Station Face

Do not create hierarchy by introducing more fonts.

Use the same STATION FACE with changes in:

- size,
- weight,
- spacing,
- contrast,
- position,
- grouping.

The exact pixel values are not frozen until they are tested in the real interface.

The semantic hierarchy is more important than arbitrary numbers.

### LEVEL A — SECTION / GROUP

Examples:

`PARAMETERS`  
`FILTER`  
`ENVELOPE`  
`CHANNELS`  
`BUS & FX`

Purpose:

Identify a group of controls.

Characteristics:

- stronger than parameter labels;
- usually medium or semibold;
- may be slightly larger;
- should read as a panel marking rather than a web-page heading.

Do not turn section labels into large banners.

### LEVEL B — CONTROL / PARAMETER

Examples:

`TUNE`  
`DECAY`  
`ATTACK`  
`MASS`  
`PAN`  
`LEVEL`

Purpose:

Identify an individual control.

Characteristics:

- lighter than section headings;
- compact;
- highly legible;
- usually regular or medium;
- must remain readable around dense groups of sliders and controls.

These labels must **not** be unnecessarily bold.

Dense musical interfaces become muddy very quickly when every control label is heavy.

### LEVEL C — IDENTITY

Examples:

`MONOGORG`  
`MONOPOLY`  
`STRINGS`

Purpose:

Name an instrument or important object.

Characteristics:

- larger than parameter labels;
- may use medium/semibold weight;
- should have more presence without becoming marketing typography.

Instrument names belong to the Station Face unless a future explicitly approved identity system says otherwise.

### LEVEL D — READING TEXT

Examples:

short descriptions, explanations and helper copy.

Characteristics:

- regular weight;
- normal human sentence casing;
- comfortable line-height;
- minimal tracking.

Reading text must not look like terminal output or equipment engraving.

---

## 7. Weight communicates function

Weight is not decoration.

A practical hierarchy:

**heavy**  
reserved mainly for MODULE keys and rare high-priority physical labels.

**medium / semibold**  
section headings, important identities, major control groups.

**regular / medium**  
parameter names and ordinary control labels.

**regular**  
descriptive text.

Do not make all-uppercase text automatically bold.

Do not use bold merely to compensate for poor spacing or weak contrast.

---

## 8. Casing communicates physical role

Uppercase is appropriate where text behaves like a marking on equipment:

`LASER`  
`PADS`  
`TUNE`  
`FILTER`

Sentence case is preferred for language spoken to the user:

`Choose an instrument`

and ordinary descriptive text.

Do not uppercase every string in Station to manufacture a retro or technical feeling.

---

## 9. DISPLAY FACE — the internal computer

The System Display has permission to use a visibly different typographic language.

It may feel:

- computational,
- instrument-like,
- data-oriented,
- slightly unfamiliar,
- precise.

It must not become:

- Matrix,
- hacker terminal,
- fake DOS,
- pixel-art display,
- broken CRT simulation,
- generic "futuristic HUD".

Station imagines future capability through physical electronic-instrument logic.

The display may therefore feel like a computer from an alternate evolution of musical hardware rather than a nostalgic reconstruction of an old screen.

---

## 10. Numbers are critical

Station contains large amounts of numerical information.

Any Display Face candidate must be evaluated especially carefully on:

`0123456789`

and real Station strings:

`120 BPM`  
`0% SWING`  
`BANK 08`  
`PAT A`  
`1.00`  
`-18.0 dB`  
`12 ms`

Preferred properties:

- strong distinction between `0`, `O`;
- strong distinction between `1`, `I`, `l`;
- tabular numerals where alignment matters;
- stable widths during live value changes;
- excellent readability at small mobile sizes.

A separate fourth numeric typeface should **not** be introduced unless a concrete functional problem cannot be solved by the chosen Display Face.

Three fonts are already the intended ceiling.

---

## 11. Anti-AI / anti-template font rule

Station must deliberately avoid typefaces selected because they are obvious answers to prompts such as:

- "futuristic music UI font",
- "tech dashboard font",
- "modern startup font",
- "cyberpunk font",
- "AI app font".

A typeface is not rejected simply because it is popular.

However, if its cultural association strongly makes Station resemble generic AI-generated interfaces, SaaS products, restaurants, Instagram branding or ready-made design templates, that association is a valid reason to reject it.

Known obvious directions to avoid include the overused "tech/future" family of solutions represented by fonts such as:

- Rajdhani,
- Orbitron,
- Audiowide,
- Oxanium,
- Chakra Petch,

and fashionable neutral defaults should also be treated with caution when they erase Station's identity.

Do not solve this by choosing an obscure font merely because it is obscure.

Originality without usability is not the goal.

---

## 12. Historical inspiration without retro cosplay

Station takes inspiration from the past without pretending to be an old machine.

The broader visual idea is:

> **past design logic, contemporary execution, a small leak of imagined future.**

Useful historical sources include:

- consumer electronics,
- samplers,
- cassette players,
- studio equipment,
- industrial controls,
- elevator controls,
- printed technical labels,
- record sleeves and graphic design.

The purpose of these references is to learn:

- hierarchy,
- restraint,
- proportion,
- physical logic,
- graphic rhythm,
- material differentiation.

Do not imitate:

- fake ageing,
- fake scratches,
- VHS damage,
- CRT scanlines,
- vintage filters,
- arbitrary distressed typography.

Retro is a source of design logic, not a texture pack.

---

## 13. Colour and typography

Typography must respect Vinyl Dust.

Station is dark without being simply black and grey.

Low-luminance navy, plum and related muted surfaces provide colour without visual noise.

Typography should not compensate for dark surfaces through excessive weight, white text or glow.

Pure white is not required for legibility.

Hierarchy should come from controlled contrast and weight.

Accent colour must not be used to make every heading "interesting".

---

## 14. Font selection process

Coding agents must **never autonomously select final Station fonts**.

Font selection is a human-reviewed design task. **This is how the MACHINE FACE decision was actually made**: a temporary Typography Lab was built inside real Station (`src/dev/TypographyLab.tsx`, dev-only - excluded from every production build), MODULE/STATION/DISPLAY were compared live against the specimen below with local system fonts as a technical test set, and Inter was chosen for the whole machine from that comparison — not picked by an agent from a catalogue. The Lab is still present as of this writing; removing it is a separate, later decision, not implied by the family decision itself. The same comparison process applies to any future DISPLAY FACE reconsideration.

Do not browse a font catalogue and decide from marketing specimens.

Candidates must be tested with real Station content.

Minimum specimen:

`STATION`

`LASER`  
`PADS`  
`SYNTH`  
`SEQ`  
`SONG`  
`WAVES`  
`MIX`

`PARAMETERS`  
`FILTER`  
`DECAY`  
`TUNE`  
`MASS`

`MONOGORG`  
`MONOPOLY`  
`STRINGS`

`Choose an instrument`

`120 BPM · 0% SWING`  
`BANK 08 · PAT A`  
`PAD 01`  
`-18.0 dB`  
`0123456789`

Polish diacritics must also be checked:

`Ą Ć Ę Ł Ń Ó Ś Ź Ż`  
`ą ć ę ł ń ó ś ź ż`

Candidates should ideally be loaded into a temporary **Typography Lab inside the real Station interface** so the designer can switch fonts live without imagining how a catalogue specimen would translate to the instrument.

Evaluate on the actual phone/browser size.

---

## 15. Candidate evaluation

Judge candidates on:

### CHARACTER
Does it have its own voice without becoming novelty typography?

### SMALL-SIZE LEGIBILITY
Does it remain readable on a phone?

### DENSITY
Can Station fit the required information without feeling cramped?

### NUMBERS
Are numeric values excellent?

### WEIGHT RANGE
Does the family provide useful regular/medium/semibold behaviour?

### COMPATIBILITY
Now that MODULE and STATION share one family, this criterion is about the *treatment* relationship, not typeface choice: does MODULE's weight/size/tracking read as clearly its own thing next to STATION's, while still feeling like the same machine? (Applies as-is to any future DISPLAY FACE candidate against MACHINE FACE, where the families genuinely do differ.)

### CULTURAL ASSOCIATION
Does the result immediately resemble generic AI/tech/SaaS design?

### LONGEVITY
Will it still feel like Station after current font trends change?

---

## 16. Rules for agents

Unless a typography task explicitly says otherwise:

1. Do not introduce a new font family. (Inter for the machine and the existing mono for the Display are the accepted set - see the family decision at the top of this document.)
2. Do not replace either accepted family autonomously.
3. Do not use a trendy Google Font as a temporary improvement.
4. Do not spread the MODULE role's weight/size/tracking treatment beyond the seven main selector keys.
5. Do not use the DISPLAY FACE (or its mono family) outside the System Display.
6. Do not make dense parameter labels bold merely to create hierarchy.
7. Use STATION role weights and sizes to express section -> parameter -> identity -> reading-text hierarchy.
8. Do not increase letter-spacing mechanically on uppercase labels.
9. Do not turn typography into decorative retro imitation.
10. When a typography decision is ambiguous, preserve the existing implementation and report it for human design review.

---

## 17. Acceptance test

The final typography succeeds when:

- the seven workspace keys feel like a unique physical control family;
- the main Station interface remains legible even in dense parameter screens;
- section headings have more authority than individual parameter labels;
- individual parameter labels remain light enough not to create visual mud;
- instrument names have identity without looking like marketing cards;
- the System Display visibly belongs to a different computational layer;
- the Display Face remains contained inside the display;
- numbers are stable and easy to read;
- the two-font system feels like **one font belonging to the whole machine, plus one font belonging to its internal computer** - not one undifferentiated typographic surface;
- no font looks chosen because it was the obvious result of an AI "futuristic interface" prompt;
- removing the Station logo still leaves a recognisable typographic character.
