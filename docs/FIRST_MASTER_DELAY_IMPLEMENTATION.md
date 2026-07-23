# Station — pierwszy prosty delay zsynchronizowany z BPM

## Status dokumentu

- Typ: specyfikacja implementacyjna dla Codexa
- Zakres: pierwszy działający delay w Station
- Platforma: przeglądarka desktopowa, Chrome i Edge na Windows
- Warstwa audio: Web Audio API
- Założenie: master compressor jest już zaimplementowany
- Priorytet: muzyczne działanie, prostota, bezpieczny feedback i brak regresji

## 1. Cel

Dodać jeden prosty globalny delay na masterze. Ma mieć synchronizację z BPM, ręczny czas, feedback i mix. Nie może zmieniać timingu sekwencera ani rozbudowywać Station w pełny DAW.

Pierwsza wersja obsługuje:

- ENABLED,
- SYNC,
- DIVISION: `1/2`, `1/4`, `1/8`, `1/16`,
- ręczny TIME,
- FEEDBACK,
- MIX.

Poza zakresem:

- ping-pong,
- dotted i triplet,
- filtry,
- modulacja,
- tape character,
- saturacja,
- reverse/freeze,
- delay per pad,
- delay per Pattern Group,
- sendy,
- presety,
- automatyzacja na timeline.

## 2. Routing

Docelowy tor:

```text
pad voice
-> channel gain
-> Pump gain
-> Pattern Group bus
-> master delay input
   -> dry gain --------------------\
   -> delay -> feedback -> wet gain +-> master compressor
                                    -> master gain
                                    -> destination
```

Preview próbek również ma trafiać do `masterDelayInput`.

Delay znajduje się przed kompresorem, aby kompresor kontrolował także powtórki. Pump pozostaje przed delay.

## 3. Parametry

| Parametr | Zakres | Domyślnie |
|---|---:|---:|
| ENABLED | on/off | off |
| SYNC | on/off | on |
| DIVISION | 1/2, 1/4, 1/8, 1/16 | 1/4 |
| TIME | 20–1000 ms | 250 ms |
| FEEDBACK | 0–85% | 35% |
| MIX | 0–50% | 20% |

Przy wyłączonym SYNC aktywny jest ręczny TIME. Przy włączonym SYNC czas jest wyliczany z BPM i DIVISION.

## 4. Synchronizacja z BPM

BPM Station oznacza ćwierćnutę.

```ts
const delayDivisionBeats = {
  '1/2': 2,
  '1/4': 1,
  '1/8': 0.5,
  '1/16': 0.25,
} as const

const delaySeconds = (60 / bpm) * delayDivisionBeats[division]
```

Przy 120 BPM:

```text
1/2  = 1000 ms
1/4  = 500 ms
1/8  = 250 ms
1/16 = 125 ms
```

Zmiana BPM lub DIVISION podczas playbacku ma aktualizować `delayTime` z krótkim smoothingiem. Gdy SYNC jest wyłączony, zmiana BPM nie wpływa na ręczny TIME.

## 5. Model stanu

```ts
export type DelayDivision = '1/2' | '1/4' | '1/8' | '1/16'

export interface MasterDelayConfig {
  enabled: boolean
  sync: boolean
  division: DelayDivision
  timeSeconds: number
  feedback: number
  mix: number
}

export const defaultMasterDelayConfig: MasterDelayConfig = {
  enabled: false,
  sync: true,
  division: '1/4',
  timeSeconds: 0.25,
  feedback: 0.35,
  mix: 0.2,
}
```

Web Audio node'y nie mogą trafiać do React state ani persistence.

## 6. Runtime nodes w AudioEngine

Dodać:

```ts
private masterDelayInput: GainNode | undefined
private masterDelayNode: DelayNode | undefined
private masterDelayDryGain: GainNode | undefined
private masterDelayWetGain: GainNode | undefined
private masterDelayFeedbackGain: GainNode | undefined
private masterDelayConfig: MasterDelayConfig = {
  ...defaultMasterDelayConfig,
}
```

DelayNode utworzyć z zapasem:

```ts
context.createDelay(2)
```

Czas końcowy clampować do zakresu 0.02–2.0 s.

Jeżeli AudioEngine nie zna BPM, dodać `setBpm(bpm)`. Jeżeli już istnieje źródło prawdy dla BPM, wykorzystać je zamiast tworzyć drugie.

## 7. Topologia node'ów

```ts
masterDelayInput.connect(masterDelayDryGain)
masterDelayInput.connect(masterDelayNode)

masterDelayNode.connect(masterDelayWetGain)
masterDelayNode.connect(masterDelayFeedbackGain)
masterDelayFeedbackGain.connect(masterDelayNode)

masterDelayDryGain.connect(masterCompressor)
masterDelayWetGain.connect(masterCompressor)

masterCompressor.connect(masterGain)
masterGain.connect(context.destination)
```

Wymagania:

- feedback wraca wyłącznie przez `masterDelayFeedbackGain`;
- wet zawsze przechodzi przez `masterDelayWetGain`;
- dry i wet sumują się przed kompresorem;
- group busy i preview nie mogą zachować starego bezpośredniego połączenia z kompresorem;
- node'ów nie wolno tworzyć przy każdej zmianie parametrów.

## 8. MIX i bypass

Pierwsza wersja działa jak prosty master send:

```ts
dryGain = 1
wetGain = mix
```

Zakres MIX:

```text
0.0–0.5
```

Przy `enabled === false`:

```ts
dryGain = 1
wetGain = 0
feedbackGain = 0
```

Nie przepinać grafu przy bypassie. Wyłączenie ma wygasić wet i feedback krótkim rampem. Nie implementować teraz zachowania „ogon gra dalej po bypassie”.

## 9. Feedback i bezpieczeństwo

Feedback musi być ograniczony do:

```text
0.0–0.85
```

Nigdy nie dopuszczać `1.0` ani wartości większej. Walidować UI i dane wczytywane z projektu. `NaN`, `Infinity` i błędne typy zastępować wartością domyślną.

## 10. Publiczne API

Dodać:

```ts
setMasterDelayConfig(config: MasterDelayConfig): void
```

Metoda ma:

1. normalizować config,
2. zapisać bezpieczną kopię,
3. obliczyć czas z BPM lub manual TIME,
4. zastosować wet gain, feedback gain i delay time,
5. nie tworzyć nowych node'ów.

Pomocnicze metody:

```ts
private normalizeMasterDelayConfig(config: MasterDelayConfig): MasterDelayConfig
private getMasterDelayTimeSeconds(config: MasterDelayConfig, bpm: number): number
private applyMasterDelayConfig(immediately?: boolean): void
```

## 11. Smoothing

Sugerowane rampy:

| Parametr | Czas |
|---|---:|
| wet gain | 20 ms |
| feedback | 20 ms |
| delay time | 30 ms |
| bypass | 20 ms |

Przykład:

```ts
private rampAudioParam(
  parameter: AudioParam,
  target: number,
  durationSeconds: number,
): void {
  if (!this.context) return
  const now = this.context.currentTime
  parameter.cancelScheduledValues(now)
  parameter.setValueAtTime(parameter.value, now)
  parameter.linearRampToValueAtTime(target, now + durationSeconds)
}
```

Nie używać rampy wykładniczej dla parametrów mogących osiągać zero.

## 12. React i UI

React przechowuje tylko `MasterDelayConfig` i przekazuje go do AudioEngine.

Sekcja ma znaleźć się w widoku miksera przy MASTER, najlepiej przed sekcją kompresora:

```text
MASTER DELAY

[ ENABLED ]
SYNC       ON
DIVISION   1/4
TIME       500 ms
FEEDBACK   35%
MIX        20%
```

Gdy SYNC jest ON:

- DIVISION jest aktywne,
- TIME pokazuje wartość obliczoną i jest read-only/disabled.

Gdy SYNC jest OFF:

- ręczny TIME jest aktywny,
- DIVISION jest nieaktywne.

Preferowana kontrolka DIVISION:

```text
[ 1/2 ] [ 1/4 ] [ 1/8 ] [ 1/16 ]
```

Nie budować osobnego ekranu efektów ani racka.

## 13. Persistence

Dodać:

```ts
masterDelay: MasterDelayConfig
```

do `ProjectState`.

Przed zmianą sprawdzić faktyczny aktualny schema version po implementacji kompresora. Zwiększyć go o jeden. Nie zakładać numeru wyłącznie z dokumentacji.

Migracja ma:

- wspierać wszystkie obecnie obsługiwane starsze schematy,
- dla braku pola użyć `defaultMasterDelayConfig`,
- otwierać stare projekty z delay wyłączonym,
- nie zmieniać banków, padów, assetów, Pattern Groups, Playlist, Pumpa, Project Key, CHOP ani ustawień kompresora.

## 14. Dispose

W `dispose()` odłączyć i wyzerować referencje:

- `masterDelayInput`,
- `masterDelayNode`,
- `masterDelayDryGain`,
- `masterDelayWetGain`,
- `masterDelayFeedbackGain`.

Szczególnie usunąć pętlę:

```text
delayNode -> feedbackGain -> delayNode
```

Ponowny START AUDIO nie może tworzyć:

- podwójnego dry,
- dwóch pętli feedback,
- podwójnego echa,
- bezpośredniego obejścia kompresora.

## 15. Testy manualne

### Neutralny bypass

Delay OFF: brak echa, brak zmiany poziomu dry, brak klików.

### Podstawowe echo

```text
enabled: true
sync: true
division: 1/4
feedback: 35%
mix: 25%
```

Echo ma pojawiać się co beat i stopniowo zanikać.

### Podziały

Przy 120 BPM sprawdzić 1000/500/250/125 ms dla `1/2`, `1/4`, `1/8`, `1/16`.

### Zmiana BPM

Zmienić 120 -> 90 -> 140 podczas playbacku. Delay ma się przeliczyć bez crasha i zerwania transportu. Krótki łagodny pitch sweep jest akceptowalny; gwałtowne kliknięcie nie.

### Ręczny TIME

SYNC OFF, sprawdzić 80, 250, 500 i 1000 ms. BPM nie może zmieniać manualnego czasu.

### Feedback

Sprawdzić 0%, 35%, 60%, 85%. Przy 0% ma być jedno echo. 85% nie może narastać ani przekraczać limitu.

### Wszystkie źródła

Sprawdzić pady, sekwencer, Pattern Clips, Pattern Group busy, Pump, preview, mute/solo, kompresor, master volume i master mute.

### SAVE / OPEN

Ustawienia muszą wrócić po zapisaniu i otwarciu. Stare projekty mają delay OFF.

### Dispose

Po ponownym uruchomieniu nie może być starego ogona, podwójnego sygnału ani podwójnego echa.

## 16. Walidacja techniczna

Uruchomić:

```bash
pnpm typecheck
pnpm build
```

Jeżeli repo ma testy, dodać testy czystych funkcji obliczania czasu i normalizacji.

Minimalne przypadki:

```text
120 BPM + 1/4 = 0.5 s
120 BPM + 1/8 = 0.25 s
90 BPM + 1/4 ≈ 0.6667 s
feedback > 0.85 -> 0.85
mix > 0.5 -> 0.5
NaN -> default
```

## 17. Kryteria akceptacji

- [ ] jeden globalny DelayNode,
- [ ] bezpieczna pętla feedback,
- [ ] feedback maksymalnie 0.85,
- [ ] MIX maksymalnie 0.5,
- [ ] neutralny bypass,
- [ ] SYNC i manual TIME,
- [ ] podziały 1/2, 1/4, 1/8, 1/16,
- [ ] aktualizacja po zmianie BPM,
- [ ] preview przechodzi przez delay,
- [ ] delay jest przed kompresorem,
- [ ] Pump pozostaje przed delay,
- [ ] persistence i migracja działają,
- [ ] dispose usuwa pętlę feedback,
- [ ] typecheck i build przechodzą,
- [ ] brak funkcji spoza zakresu,
- [ ] brak szerokiego refactoru.

## 18. Zadanie dla Codexa

```text
Zaimplementuj pierwszy prosty master delay w Station zgodnie z dokumentem:

docs/FIRST_MASTER_DELAY_IMPLEMENTATION.md

Najpierw sprawdź faktyczny aktualny kod po implementacji master compressora. Nie zakładaj numeru schema ani routingu wyłącznie na podstawie starszych dokumentów.

Najważniejsze wymagania:

1. Jeden natywny Web Audio DelayNode.
2. Globalny efekt master.
3. Routing: Pattern Group busy i preview -> master delay dry/wet -> master compressor -> master gain -> destination.
4. Pump pozostaje przed delay.
5. Dodaj enabled, sync, division, manual time, feedback i mix.
6. Division: 1/2, 1/4, 1/8, 1/16.
7. Czas sync: delaySeconds = (60 / bpm) * divisionBeats.
8. Zmiana BPM i division aktualizuje delayTime z krótkim smoothingiem.
9. Przy sync OFF BPM nie wpływa na manual TIME.
10. Feedback maksymalnie 0.85.
11. Mix maksymalnie 0.5.
12. Bypass: dryGain=1, wetGain=0, feedbackGain=0.
13. Nie przepinaj grafu przy bypassie.
14. Runtime nodes wyłącznie w AudioEngine.
15. Preview musi przechodzić przez delay.
16. Delay przed master compressorem.
17. Dodaj config do persistence i zwiększ faktyczny schema version o jeden.
18. Stare projekty otwierają się z delay OFF.
19. Dispose musi usunąć całą pętlę feedback.
20. Nie dodawaj ping-pong, dotted, triplet, filtrów, modulacji, tape character, saturacji, per-pad/per-group delay, sendów, presetów ani racka efektów.
21. Nie wykonuj szerokiego refactoru.
22. Uruchom pnpm typecheck i pnpm build.

Na końcu przedstaw listę zmienionych plików, końcowy routing, sposób obliczania czasu, bypass, zabezpieczenie feedbacku, persistence/migrację, wyniki testów i znane ograniczenia.

Nie commituj i nie pushuj bez osobnej zgody.
```
