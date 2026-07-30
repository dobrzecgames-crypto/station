# Station MONO-3 — plan projektu i brief wdrożeniowy

## Status

Kierunek produktowy jest zatwierdzony do rozpoczęcia w osobnym tasku.

Ten dokument zastępuje porzucony pomysł Piano Rolla. Niedokończone zmiany
Piano Rolla nie są częścią projektu i nie wolno ich odtwarzać.

MONO-3 jest jawnym, ograniczonym wyjątkiem od dotychczasowego zakazu
syntezatora oscylatorowego. Nie jest zgodą na budowę pełnego DAW, systemu MIDI,
mod matrix, dowolnej automatyzacji ani nieskończonej osi czasu.

Nie twórz commita i nie wdrażaj projektu bez osobnego polecenia.

## Cel produktu

Dodać do Station prosty, ciepło brzmiący syntezator, który może być źródłem
dźwięku pada tak samo jak sample.

Użytkownik ma móc:

1. utworzyć patch syntezatora na wybranym padzie,
2. zaprojektować bas, pluck, lead, stab albo wobble,
3. zmapować patch na kolejne pady przez istniejące Project Key / Scale Map,
4. sekwencjonować te pady w obecnym 16-krokowym SEQ,
5. przypisać do jednego pada akord zawierający od jednej do pięciu nut,
6. użyć PATTERN, wariantów A–D, SONG, Pump, Group FX i Master FX,
7. zapisać projekt i wyrenderować SONG do WAV z takim samym brzmieniem jak
   podczas odtwarzania na żywo.

Docelowa ścieżka pozostaje grooveboxowa:

> patch syntezatora -> pad -> Scale Map -> SEQ -> Pump -> zapisany szkic

## Najważniejsze decyzje

### 1. Bez Piano Rolla i bez nowego sekwencera

MONO-3 korzysta z istniejących padów i istniejącego `StepPattern`.

- Jeden krok SEQ nadal uruchamia jeden pad.
- Pad syntezatorowy może uruchomić jedną nutę albo cały przypisany akord.
- Istniejące velocity i SHIFT dotyczą całego wyzwolenia pada.
- Nie dodajemy siatki Piano Roll, długości nut ani drugiej osi czasu.

### 2. Syntezator jest źródłem pada

Pad może być:

- pusty,
- oparty na samplu,
- oparty na patchu MONO-3.

Sample i patch syntezatora wzajemnie się wykluczają. Zastąpienie zajętego pada
innym rodzajem źródła wymaga potwierdzenia.

### 3. Patch jest współdzielony przez mapowane pady

Patch należy do Pattern Group. Pady w banku wskazują go przez stabilne
`synthPatchId`.

`MAP TO PROJECT SCALE` dla pada syntezatorowego:

- przekazuje kolejnym padom referencję do tego samego patcha,
- ustawia istniejące `pitchSemitones` zgodnie ze skalą,
- kopiuje początkowy układ interwałów akordu,
- nie tworzy kopii patcha,
- nie tworzy sampla WAV,
- nie zmienia Patternów, miksera, Pump ani CHOP,
- zachowuje obecną zasadę, że późniejsza zmiana Project Key nie przestraja
  istniejącego mapowania.

Edycja współdzielonego patcha zmienia brzmienie wszystkich padów, które go
używają. Układ akordu pozostaje własnością konkretnego pada i może być później
zmieniany niezależnie.

### 4. MONO i POLY 5

Patch ma przełącznik:

- `MONO` — jedna nuta, last-note priority i glide,
- `POLY 5` — maksymalnie pięć jednoczesnych głosów.

W trybie POLY 5 jeden pad może zawierać nutę bazową oraz maksymalnie cztery
dodatkowe interwały. Jedno naciśnięcie takiego pada uruchamia cały akord.

Interwały są zapisywane względem bazowej wysokości pada, na przykład:

```text
[0, 4, 7, 10]
```

oznacza prymę, tercję wielką, kwintę i septymę małą. Scale Map transponuje cały
układ bez automatycznej reharmonizacji. Diatoniczne generowanie akordów jest
poza zakresem.

POLY 5 ma limit pięciu aktywnych głosów na patch. Po przekroczeniu limitu
najstarszy głos jest zwalniany. Glide działa wyłącznie w MONO.

### 5. Jeden wspólny silnik audio

AudioEngine pozostaje jedyną publiczną granicą Web Audio.

React:

- edytuje serializowalny patch,
- wysyła jawne polecenia note-on/note-off,
- pokazuje stan interfejsu.

AudioEngine:

- tworzy i niszczy głosy,
- planuje nuty SEQ według `AudioContext.currentTime`,
- realizuje obwiednie, filtr, LFO, saturację i voice stealing,
- prowadzi ten sam tor w PATTERN, SONG i offline WAV.

Nie używaj React renderowania, `requestAnimationFrame`, `setTimeout` ani
`setInterval` jako źródła czasu dźwięku. Timer look-ahead może jedynie budzić
scheduler zgodnie z obecną architekturą.

## Architektura brzmienia

Każdy głos POLY 5 ma własne oscylatory, filtr i obwiednie:

```text
OSC 1 ----\
OSC 2 ----- MIX -> 24 dB LOW-PASS -> SOFT DRIVE -> AMP -> pad channel
SUB -------/              ^                         ^
                           |                         |
                    FILTER ENV + LFO             AMP ADSR
```

### Oscylatory

`OSC 1` i `OSC 2`:

- waveform: `sine | triangle | sawtooth | square`,
- octave: od -2 do +2,
- detune: co najmniej od -50 do +50 centów,
- level: 0–1.

`SUB`:

- waveform: `sine | square`,
- octave: -1 albo -2,
- level: 0–1.

Bazowa nuta patcha domyślnie wynosi C2. Ostateczna wysokość składnika akordu:

```text
patch.baseMidiNote + pad.pitchSemitones + chordInterval
```

Zakres musi pozwalać grać co najmniej od C0 do C8. Nie ograniczaj interfejsu do
rejestru basowego.

### Filtr

- filtr dolnoprzepustowy 24 dB/oktawę,
- cutoff,
- resonance,
- modulacja obwiednią w półtonach lub centach,
- modulacja LFO przez parametr `detune` filtra, dzięki czemu głębokość jest
  muzycznie stabilniejsza niż liniowa modulacja Hz.

Implementacja może użyć dwóch kaskadowych `BiquadFilterNode`, ale musi zostać
sprawdzona odsłuchowo pod kątem rezonansu i przesterowań.

### Obwiednie

AMP ADSR:

- attack,
- decay,
- sustain,
- release.

Prosta obwiednia filtra:

- attack,
- decay,
- amount.

Każda automatyzacja AudioParam musi zaczynać od bezpiecznej bieżącej wartości i
nie może powodować klików podczas retriggera ani voice stealingu.

### LFO

Pierwsza wersja ma jedno LFO:

- waveform: `sine | triangle | sawtooth | square`,
- synchronizacja z BPM,
- podziały: 1/2, 1/4, 1/8, 1/16 oraz odpowiadające wartości triolowe,
- depth,
- cel w v1: cutoff filtra.

LFO jest właściwym źródłem efektu wobble/„woof”. Pump nadal moduluje głośność
Group Busa i nie zastępuje LFO filtra.

Faza LFO ma pochodzić z zegara AudioContext i być wspólna dla głosów patcha,
żeby akord poruszał filtrem spójnie. Zmiana BPM podczas odtwarzania aktualizuje
częstotliwość LFO bez restartowania transportu.

### Saturacja

- jedno proste sterowanie `DRIVE`,
- miękka, symetryczna krzywa `WaveShaperNode`,
- oversampling, jeżeli jest dostępny i nie powoduje rozbieżności Chrome/Edge,
- odpowiedni headroom dla pięciu głosów,
- brak limitera dodanego wyłącznie do syntezatora lub eksportu.

„Ciepłe analogowe brzmienie” ma wynikać przede wszystkim z lekkiego detune,
filtra, obwiedni i miękkiej saturacji. Nie należy dodawać losowych timerów,
ciężkiego modelowania analogowego ani nowej zależności DSP.

### Gate i glide

- ręczne granie: note-on przy wciśnięciu, note-off przy puszczeniu,
- SEQ: długość głosu wynika z globalnego parametru patcha `GATE`, wyrażonego
  jako część długości kroku,
- MONO: last-note priority i glide pomiędzy wysokościami,
- POLY 5: glide wyłączony; każdy głos ma niezależną obwiednię.

## Proponowany model danych

Nazwy mogą zostać lekko dopasowane do istniejących konwencji, ale relacje i
granice mają pozostać takie:

```ts
type SynthPatchId = string
type SynthWaveform = 'sine' | 'triangle' | 'sawtooth' | 'square'
type SubWaveform = 'sine' | 'square'
type SynthVoiceMode = 'mono' | 'poly5'

interface SynthOscillatorState {
  waveform: SynthWaveform
  octave: number
  detuneCents: number
  level: number
}

interface SynthPatch {
  id: SynthPatchId
  name: string
  mode: SynthVoiceMode
  baseMidiNote: number
  oscillator1: SynthOscillatorState
  oscillator2: SynthOscillatorState
  sub: {
    waveform: SubWaveform
    octave: -1 | -2
    level: number
  }
  ampEnvelope: {
    attackSeconds: number
    decaySeconds: number
    sustain: number
    releaseSeconds: number
  }
  filter: {
    cutoffHz: number
    resonance: number
    envelopeAttackSeconds: number
    envelopeDecaySeconds: number
    envelopeAmountSemitones: number
  }
  lfo: {
    waveform: SynthWaveform
    division: string
    depthSemitones: number
  }
  drive: number
  glideSeconds: number
  gate: number
}
```

Rozszerzenie `PatternGroup`:

```ts
synthPatches: SynthPatch[]
```

Rozszerzenie `PadState`:

```ts
synthPatchId: SynthPatchId | null
chordIntervals: number[]
```

Zasady:

- `assetId` i `synthPatchId` nie mogą być ustawione jednocześnie,
- domyślne `chordIntervals` to `[0]`,
- tablica zawiera 1–5 unikalnych, skończonych liczb całkowitych,
- zero reprezentuje bazową nutę pada,
- dodatkowe interwały powinny mieścić się w ograniczonym, muzycznie użytecznym
  zakresie, rekomendowane -24…+24 półtony,
- patch ID musi istnieć w tym samym Pattern Group,
- patch bez żadnej referencji pada może zostać usunięty,
- usunięcie jednego mapowanego pada nie usuwa patcha używanego przez inne pady.

## Persistence v10

Podnieść schema projektu z v9 do v10.

Migracja v1–v9:

- dodaje do każdego Pattern Group puste `synthPatches`,
- ustawia `synthPatchId = null` na każdym padzie,
- ustawia `chordIntervals = [0]`,
- nie zmienia assetów, regionów, pitch, patternów, SHIFT, velocity, Pump ani FX,
- nie zmienia dotychczasowego brzmienia projektu.

Walidacja ma odrzucać:

- pad jednocześnie wskazujący sample i synth,
- brakujący albo należący do innej grupy patch,
- zduplikowane patch ID,
- NaN i Infinity,
- wartości parametrów poza ustalonym zakresem,
- nieobsługiwane waveform i podziały LFO,
- pustą listę akordu, więcej niż pięć nut, duplikaty i niecałkowite interwały,
- końcowe nuty poza obsługiwanym zakresem silnika,
- dane syntezatora przypisane do nieistniejących grup lub padów.

## Scheduler i routing

Rozszerzyć dane `StepSequencerTrack` albo wprowadzić małą unię zdarzeń źródła:

- sample trigger zachowuje obecną ścieżkę bez zmian,
- synth trigger przekazuje patch, bazową wysokość pada, interwały, velocity,
  SHIFT, czas note-on i czas note-off.

Jedno aktywne pole SEQ pada syntezatorowego:

1. bierze velocity i SHIFT z istniejącego `StepPattern`,
2. oblicza czas na podstawie AudioContext dokładnie jak sample,
3. tworzy nuty z `chordIntervals`,
4. planuje note-off według `patch.gate * stepDuration`,
5. prowadzi głosy przez kanał wyzwalającego pada,
6. następnie przez Group Bus, Pump, Group FX, Master FX i master output.

Trigger pada syntezatorowego musi uruchamiać Pump, jeżeli ten pad jest źródłem
route. Synth musi również podlegać Pump jako część docelowego Group Busa.

PATTERN, SONG i offline WAV muszą korzystać z tej samej funkcji rozwiązującej
pad syntezatorowy do zaplanowanych nut. Nie wolno utrzymywać osobnej logiki
pitch lub akordów w rendererze.

## Interfejs

### Główna zakładka

Dodać `SYNTH` pomiędzy `PADS` i `SEQ`.

Zakładka edytuje patch wybranego pada. Nie zawiera Piano Rolla ani osobnego
sekwencera.

### Tworzenie źródła

Na pustym padzie:

- `CREATE SYNTH` tworzy domyślny ciepły patch,
- pad otrzymuje referencję patcha i `[0]`.

Na padzie z samplem:

- utworzenie synth wymaga potwierdzenia zastąpienia źródła,
- nie usuwa assetu używanego przez inne pady.

Na padzie wskazującym współdzielony patch:

- SYNTH pokazuje i edytuje ten patch,
- interfejs jasno informuje, ile padów korzysta z patcha.

### Kontrolki patcha

Podzielić powierzchnię na małe, czytelne sekcje:

- OSC 1,
- OSC 2,
- SUB,
- FILTER,
- AMP ENV,
- FILTER ENV,
- LFO,
- DRIVE / GLIDE / GATE,
- CHORD.

Kontrolki muszą działać pointerem i dotykiem. Nie opierać żadnej funkcji na
hover. System Display może pokazywać aktualnie edytowany parametr, ale nie
należy wciskać wszystkich kontrolek syntezatora do jego małego panelu.

### Edycja akordu

Sekcja CHORD dotyczy wybranego pada, a nie współdzielonego patcha.

- zawsze pokazuje bazową nutę pada,
- pozwala dodać lub usunąć do czterech interwałów,
- pokazuje równocześnie interwał i wynikową nazwę nuty,
- blokuje szóstą nutę i duplikaty,
- odsłuchuje cały akord jednym przyciskiem/padem,
- przy zmianie na MONO wymaga potwierdzenia przed zredukowaniem akordu do `[0]`.

Można użyć kompaktowej klawiatury chromatycznej jako edytora interwałów, ale
nie może ona rozrosnąć się do Piano Rolla ani nowego sekwencera.

### Istniejące pady i Scale Map

- pad syntezatorowy jest jednoznacznie oznaczony,
- grany ręcznie reaguje na pointer down/up oraz key down/up,
- feedback wizualny pozostaje zgodny z sample padami,
- `MAP TO PROJECT SCALE` obsługuje sample i synth bez regresji starej ścieżki.

## Etapy realizacji

Każdy etap ma zakończyć się własną krótką weryfikacją. Nie maskować problemów
etapu wcześniejszego pracą z następnego.

### Etap 0 — ochrona stanu i baseline

1. Przeczytać `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`,
   `docs/AUDIO_ENGINE.md`, `docs/DATA_MODEL.md`,
   `docs/PATTERN_GROUP_BANKS_ARCHITECTURE.md`, `docs/SMART_PUMP.md` oraz ten
   dokument.
2. Sprawdzić `git status`, diff i ostatnie commity.
3. Zachować wszystkie bieżące zmiany `PumpDisplay`.
4. Potwierdzić brak treści Piano Rolla.
5. Uruchomić `pnpm typecheck` i `pnpm build` przed implementacją.

Warunek wyjścia: znany, działający baseline albo dokładnie opisany istniejący
problem niezwiązany z MONO-3.

### Etap 1 — domena i schema v10

1. Dodać typy patcha i operacje czystej domeny.
2. Rozszerzyć Pattern Group i PadState.
3. Dodać tworzenie, klonowanie, współdzielenie i bezpieczne usuwanie patcha.
4. Rozszerzyć Scale Map.
5. Dodać migrację v1–v9 i pełną walidację v10.

Warunek wyjścia: typecheck/build przechodzą; projekty v9 normalizują się bez
zmiany starego brzmienia; nie ma jeszcze konieczności generowania audio.

### Etap 2 — pojedynczy głos MONO

1. Zbudować engine-owned synth voice.
2. Dodać OSC 1, OSC 2, SUB, mikser, filtr, obwiednie i drive.
3. Dodać ręczne note-on/note-off, last-note priority i glide.
4. Prowadzić głos przez kanał pada i istniejący routing grupy.
5. Zapewnić click-safe release i cleanup AudioNodes.

Warunek wyjścia: ręcznie grany patch działa stabilnie w Chrome i Edge, nie
przerywa sample playback i nie zostawia wiszących głosów.

### Etap 3 — LFO i pełna powierzchnia SYNTH

1. Dodać tempo-synced LFO filtrowe.
2. Obsłużyć zmianę BPM podczas grania.
3. Dodać zakładkę SYNTH i wszystkie kontrolki patcha.
4. Dodać utworzenie/zastąpienie źródła oraz czytelny stan pusty.
5. Przygotować fabryczny patch startowy brzmiący muzycznie, bez ekstremalnych
   poziomów.

Warunek wyjścia: można stworzyć sub, pluck i wobble bez korzystania z SEQ.

### Etap 4 — POLY 5 i akord na padzie

1. Dodać pięciogłosowy voice allocator.
2. Każdy głos otrzymuje własny filtr i obwiednie.
3. Dodać edytor interwałów wybranego pada.
4. Jedno naciśnięcie uruchamia cały akord.
5. Zaimplementować deterministyczne voice stealing i headroom.
6. Sprawdzić Scale Map całych voicingów.

Warunek wyjścia: pad gra stabilny akord do pięciu nut, a patch z jednym głosem
nadal zachowuje prawidłowe MONO/glide.

### Etap 5 — SEQ, PATTERN, SONG, Pump i FX

1. Rozszerzyć scheduler o synth chord events.
2. Zachować velocity i SHIFT istniejącego kroku.
3. Dodać patch-level GATE.
4. Zapewnić edycję patcha podczas transportu bez restartu.
5. Obsłużyć warianty A–D i nakładające się klipy SONG.
6. Sprawdzić synth jako źródło i cel Pump.
7. Sprawdzić routing przez Group FX i Master FX.

Warunek wyjścia: sample i synth grają równocześnie i pozostają zsynchronizowane
przez pełne przejście SONG.

### Etap 6 — zapis, otwarcie i offline WAV

1. Zapisać i odtworzyć patche, referencje padów, tryb głosu i akordy.
2. Odtworzyć runtime synth state po OPEN.
3. Przekazać patche do renderującego AudioEngine.
4. Użyć tej samej logiki pitch, chord, LFO, gate i obwiedni w offline render.
5. Uwzględnić release oraz ogon efektów w długości renderu.

Warunek wyjścia: PATTERN/SONG live i offline WAV brzmią funkcjonalnie tak samo,
a v9 otwiera się bez regresji.

### Etap 7 — regresje, ergonomia i dokumentacja

1. Uruchomić typecheck/build.
2. Sprawdzić import i playback prawdziwego WAV obok synth.
3. Sprawdzić CHOP, PADS, SEQ, SONG, MIX, PROJECT oraz PumpDisplay.
4. Sprawdzić klawiaturę komputera, pointer i touch-capable pointer.
5. Sprawdzić cleanup po STOP, zmianie banku, usunięciu patcha i OPEN PROJECT.
6. Zaktualizować README, DATA_MODEL, AUDIO_ENGINE i DECISIONS.

Warunek wyjścia: spełnione kryteria odbioru i kompletny raport końcowy.

## Kryteria akceptacji

1. SYNTH jest osobną zakładką, ale nie dodaje nowego sekwencera.
2. Wybrany pad może przechowywać sample albo referencję MONO-3.
3. OSC 1 i OSC 2 oferują sine, triangle, sawtooth i square.
4. SUB oferuje sine i square oraz -1/-2 oktawy.
5. Filtr, AMP ADSR, filter envelope, LFO, drive, glide i gate działają.
6. LFO jest zsynchronizowane z BPM i potrafi tworzyć słyszalne wobble.
7. Instrument nie jest ograniczony do basu; można grać co najmniej C0–C8.
8. MONO ma last-note priority i glide.
9. POLY 5 odtwarza do pięciu głosów z deterministycznym voice stealingiem.
10. Jeden pad może uruchomić cały, maksymalnie pięcionutowy akord.
11. Scale Map mapuje wspólny patch i transponuje cały voicing.
12. SEQ zachowuje velocity i SHIFT oraz uruchamia cały akord jednym krokiem.
13. Sample i synth mogą grać równocześnie.
14. Warianty A–D i SONG działają bez dodatkowego modelu patternu.
15. Synth przechodzi przez kanał pada, Group Bus, Pump, Group FX i Master FX.
16. Synth może być źródłem Pump i podlega Pump jako część docelowej grupy.
17. SAVE/OPEN zachowuje patch, mapowanie i akordy.
18. Migracja v1–v9 nie zmienia istniejących projektów.
19. Offline WAV używa tej samej logiki i zachowuje tempo LFO.
20. STOP anuluje zaplanowane głosy syntezatora bez zatrzymywania niezależnych
    ręcznych głosów, zgodnie z obecną polityką transportu.
21. `pnpm typecheck` i `pnpm build` przechodzą.
22. Bieżące zmiany PumpDisplay pozostają zachowane.

## Wymagane testy ręczne

W aktualnym Chrome i Edge na Windows:

- start/resume AudioContext,
- granie jednego pada synth myszą i klawiaturą,
- note-off po puszczeniu,
- szybki retrigger bez klików i wiszących głosów,
- glide MONO,
- pięcionutowy akord POLY 5,
- voice stealing przy więcej niż pięciu głosach,
- Scale Map synth w co najmniej dwóch oktawach,
- pluck z krótką obwiednią,
- wobble LFO przy kilku podziałach BPM,
- zmiana BPM podczas playback,
- sample WAV i synth jednocześnie,
- SEQ velocity i SHIFT,
- warianty A–D,
- SONG z nakładającymi się klipami,
- Pump source/target,
- Group FX i Master FX,
- SAVE, reload, START AUDIO, OPEN,
- RENDER SONG i odsłuch WAV,
- STOP oraz przełączanie banków bez stuck notes.

Nie wolno twierdzić, że test WAV wykonano bez rzeczywistego załadowania i
odsłuchania pliku WAV w obu wymaganych przeglądarkach.

## Poza zakresem

- Piano Roll,
- nowy sekwencer,
- MIDI input/import/export,
- nagrywanie nut w czasie rzeczywistym,
- długości nut per krok, ties i per-step slide,
- automatyzacja parametrów,
- wavetable w pierwszej wersji,
- import własnych wavetable,
- FM, ring modulation i oscillator sync,
- więcej niż jedno LFO,
- mod matrix,
- unison supersaw,
- efekty tylko dla syntezatora,
- presety i przeglądarka presetów,
- resampling synth do pada WAV,
- arpeggiator,
- pełna polifonia bez limitu,
- nieskończona oś czasu,
- osobna aplikacja lub system pluginów.

Wavetable jest zatwierdzonym możliwym późniejszym rozszerzeniem oscylatora.
Pierwsza wersja nie może jednak tworzyć pod nie ciężkiej, spekulacyjnej
abstrakcji. Obecny podział `SynthPatch` / engine-owned voice powinien wystarczyć
do późniejszego dodania kolejnego typu źródła.

## Ryzyka

- Pięć głosów razy trzy oscylatory daje do piętnastu OscillatorNode plus filtry
  i obwiednie. Trzeba mierzyć cleanup i zachowanie CPU, szczególnie podczas
  szybkiego SEQ.
- Kaskadowy filtr z wysokim resonance może generować duże poziomy.
- Współdzielone LFO musi działać zarówno w zwykłym, jak i OfflineAudioContext.
- Manual note-off wymaga rozszerzenia obecnych zdarzeń padów o pointer/key up
  bez regresji one-shot sampli.
- Ten sam patch może być wyzwalany przez różne kanały padów. Voice allocator
  musi przechowywać routing każdego głosu i zwalniać właściwy AudioNode.
- Nakładające się klipy SONG mogą przekroczyć limit pięciu głosów w tej samej
  chwili. Kolejność voice stealingu musi być stabilna i niezależna od renderów
  React.
- Polyfoniczne akordy łatwo przesterowują. Headroom ma być kontrolowany przed
  Group Bus, ale live i render nie mogą różnić się poziomem.

## Raport końcowy implementacji

Raport musi zawierać:

1. podsumowanie zmian,
2. dokładną listę zmienionych plików,
3. instrukcję uruchomienia,
4. testy automatyczne i ich wyniki,
5. testy ręczne i przeglądarki,
6. niewykonane testy ręczne,
7. ryzyka, ograniczenia i różnice przeglądarkowe,
8. potwierdzenie zachowania PumpDisplay,
9. potwierdzenie braku Piano Rolla i innych prac poza zakresem,
10. potwierdzenie, że niczego nie zacommitowano ani nie wdrożono.
