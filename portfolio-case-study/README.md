# Station Portfolio Case Study

Pierwszy lokalny prototyp strony portfolio. Jest niezależny od aplikacji Station i korzysta wyłącznie z istniejących materiałów w `portfolio-assets/evolution/`.

Zakres prototypu:

- hero projektu;
- od jednego przycisku WAV do instrumentu;
- Library + Pad;
- Chop;
- Seq;
- Song;
- Mix;
- System Display;
- Current Build (finał, telefon / tablet / desktop).

Uruchomienie:

```bash
pnpm exec vite portfolio-case-study
```

Walidacja:

```bash
pnpm exec tsc -p portfolio-case-study/tsconfig.json
pnpm exec vite build portfolio-case-study
```
