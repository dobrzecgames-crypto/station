# Tune Gravity listening corpus

This directory is an empty structure for short, legally supplied monophonic vocal recordings used by the Tune Gravity QUALITY evaluation workflow.

## Rules

- Do not download random vocals or commit audio with uncertain licensing.
- Keep real recordings local unless their repository use is explicitly authorised.
- Copy `TUNE_GRAVITY_CORPUS_MANIFEST.example.json` to `TUNE_GRAVITY_CORPUS_MANIFEST.local.json` and fill in measured metadata.
- Use anonymous sample IDs in diagnostic and listening-test exports.
- Keep every test phrase at or below the 30-second TUNE Workspace limit.
- Record difficult time ranges and expected failure modes before listening to processed variants.

## Categories

- `low-male`
- `high-male`
- `female`
- `melodic-rap`
- `adlib`
- `sustained-note`
- `vibrato`
- `glissando`
- `consonants-breaths`
- `moderate-noise`
- `vocal-fry`

The repository ignores audio files in this directory by default. The example manifest and empty category placeholders are the only committed corpus content.
