# Station — architektura FX Rack dla Pattern Groups i Mastera

## Status dokumentu

- Typ: specyfikacja implementacyjna dla Codexa
- Zakres: wspólny system slotów efektowych dla Pattern Groups i mastera
- Platforma docelowa: przeglądarka desktopowa
- Warstwa audio: Web Audio API
- Założenie: compressor i delay są już zaimplementowane i działają
- Priorytet: ogólna architektura efektów bez rozbudowy Station do pełnego DAW
- Poza zakresem: efekty per pad, send/return, automatyzacja, zewnętrzne pluginy, nieograniczona liczba slotów

---

## 1. Cel

Celem jest zbudowanie pierwszego ogólnego systemu FX Rack w Station.

System ma umożliwiać nakładanie efektów:

- osobno na każdą Pattern Group;
- osobno na master;
- przez wybór efektu z jednej wspólnej listy.

Na początek lista efektów zawiera tylko:

- `NONE`;
- `COMPRESSOR`;
- `DELAY`.

Nie dodajemy nowych algorytmów DSP. Wykorzystujemy istniejące implementacje kompresora i delay.

---

## 2. Zakres wersji 1

Każda Pattern Group otrzymuje dokładnie dwa sloty efektów, a master również dokładnie dwa. Każdy slot pozwala wybrać `NONE`, `COMPRESSOR` albo `DELAY`. Efekty działają szeregowo zgodnie z kolejnością slotów.

```text
Pattern Group bus
-> FX SLOT 1
-> FX SLOT 2
-> master input
```

```text
sum of Pattern Groups and preview
-> MASTER FX SLOT 1
-> MASTER FX SLOT 2
-> master gain
-> destination
```

---

## 3. Ograniczenia zakresu

W tej wersji:

- dokładnie 2 sloty na każdą Pattern Group;
- dokładnie 2 sloty na master;
- tylko `NONE`, `COMPRESSOR`, `DELAY`;
- brak drag-and-drop;
- brak dowolnej liczby slotów;
- brak efektów per pad;
- brak sendów i returnów;
- brak efektów równoległych;
- brak automatyzacji;
- brak presetów;
- brak kopiowania efektów między grupami;
- brak globalnego browsera pluginów;
- brak zewnętrznych pluginów;
- brak Web Audio Worklet;
- brak nowych efektów DSP.

Station nadal ma pozostać grooveboxem, a nie DAW-em.

---

## 4. Zachowanie istniejących efektów

Aktualnie działający master compressor i master delay nie mogą zniknąć ani zmienić brzmienia po migracji. Po migracji ich obecny układ powinien zostać odwzorowany w master FX Rack.

Jeżeli obecny routing to:

```text
delay
-> compressor
```

migracja istniejącego projektu powinna ustawić:

```text
MASTER SLOT 1 = DELAY
MASTER SLOT 2 = COMPRESSOR
```

Jeżeli rzeczywisty kod ma inną kolejność, należy zachować rzeczywistą kolejność.

---

## 5. Model danych

```ts
export type EffectType =
  | 'none'
  | 'compressor'
  | 'delay'

export interface EffectSlotState {
  id: string
  type: EffectType
  enabled: boolean
  compressor: CompressorConfig
  delay: DelayConfig
}

export interface EffectRackState {
  slots: [EffectSlotState, EffectSlotState]
}
```

Jeżeli istniejące typy nadal nazywają się `MasterCompressorConfig` i `MasterDelayConfig`, można zmienić je na bardziej ogólne `CompressorConfig` i `DelayConfig` tylko wtedy, gdy będzie to mały i bezpieczny refactor.

Każdy slot zachowuje ustawienia obu typów efektu, nawet jeżeli aktualnie wybrany jest tylko jeden. Dzięki temu zmiana `COMPRESSOR -> DELAY -> COMPRESSOR` nie kasuje poprzednich ustawień kompresora.

Pattern Group otrzymuje:

```ts
effects: EffectRackState
```

Projekt otrzymuje:

```ts
masterEffects: EffectRackState
```

Web Audio node'y nie mogą być serializowane.

---

## 6. Domyślny stan i stabilne ID

Nowa Pattern Group:

```text
SLOT 1 = NONE
SLOT 2 = NONE
```

Nowy projekt powinien zachować obecne domyślne zachowanie master efektów. Jeżeli obecny compressor i delay są domyślnie obecne, ale wyłączone, można utworzyć:

```text
MASTER SLOT 1 = DELAY, enabled false
MASTER SLOT 2 = COMPRESSOR, enabled false
```

Sloty muszą mieć stabilne ID, na przykład:

```text
pattern-group-1:fx-slot-1
pattern-group-1:fx-slot-2
master:fx-slot-1
master:fx-slot-2
```

Nie generować nowych losowych ID przy każdym renderze ani otwarciu projektu.

---

## 7. Runtime architecture

Nie budować osobnych ręcznie zakodowanych ścieżek dla każdej grupy. Należy zbudować małą ogólną abstrakcję pojedynczego runtime slotu.

```ts
interface RuntimeEffectSlot {
  input: GainNode
  output: GainNode
  type: EffectType
  effect?: RuntimeEffect
}

interface RuntimeEffect {
  input: AudioNode
  output: AudioNode
  applyConfig(config: EffectSlotState): void
  dispose(): void
}
```

Nazwy mogą być inne, ale wymagania są następujące:

- compressor i delay korzystają ze wspólnego modelu slotu;
- kod efektu nie jest kopiowany dla każdej grupy;
- runtime node'y są tworzone per instancja slotu;
- każda grupa ma niezależne parametry;
- master ma niezależne parametry;
- React nie tworzy node'ów.

Każdy slot powinien mieć stałe `input` i `output`.

```text
rack input
-> slot 1 input/output
-> slot 2 input/output
-> rack output
```

Zmiana typu efektu może przebudować zawartość pojedynczego slotu, ale nie może przebudowywać całego AudioContext ani pozostałych racków.

---

## 8. Bypass i factory efektów

Nie przepinać całego grafu przy każdym kliknięciu `enabled`.

Dla kompresora użyć istniejącego neutralnego bypassu. Dla delay:

```text
dry = 1
wet = 0
feedback = 0
```

Dla `NONE`:

```text
input
-> output
```

Zmiana typu podczas odtwarzania nie może powodować crasha, podwójnego sygnału, pozostawienia starej pętli feedback ani wielokrotnego połączenia node'ów. Dopuszczalne jest krótkie wyciszenie lub crossfade około 20 ms podczas wymiany typu efektu.

Zbudować małą fabrykę runtime efektów:

```ts
private createRuntimeEffect(
  type: EffectType,
): RuntimeEffect
```

Fabryka tworzy neutralny pass-through dla `none`, compressor runtime dla `compressor` i delay runtime dla `delay`.

Nie tworzyć jednocześnie wszystkich efektów w każdym slocie. Slot powinien posiadać tylko runtime efekt aktualnie wybranego typu. Proste input/output GainNode mogą pozostać stałe.

---

## 9. Routing Pattern Group

```text
group bus gain
-> group FX rack input
-> group FX slot 1
-> group FX slot 2
-> master FX rack input
```

Każda Pattern Group ma własny runtime rack. Solo, mute i volume grupy muszą nadal działać.

Preferowana kolejność:

```text
channels
-> Pump
-> group bus volume/mute/solo
-> group FX rack
-> master
```

Nie zmieniać obecnego znaczenia group volume, mute i solo bez wyraźnej konieczności. W pierwszej wersji dopuszczalne jest, że mute grupy wycisza wejście do efektów i ogon delay stopniowo zanika. Nie budować osobnego systemu pre-fader/post-fader.

---

## 10. Routing mastera

```text
Pattern Group FX outputs
+ preview
-> master FX rack input
-> master slot 1
-> master slot 2
-> master gain
-> destination
```

Preview nie przechodzi przez efekty konkretnej Pattern Group. Preview przechodzi tylko przez master FX rack.

---

## 11. Compressor i delay w slotach

Kompresor grupowy korzysta z tego samego DSP i zakresów co obecny kompresor master. Każda instancja ma własne enabled, threshold, ratio, attack i release. Nie dodawać nowych funkcji kompresora.

Delay grupowy korzysta z tego samego DSP i zakresów co obecny master delay. Każda instancja ma własne enabled, sync, division, manual time, feedback i mix.

Wszystkie zsynchronizowane delay korzystają z jednego BPM projektu. Zmiana BPM musi aktualizować delay w każdej Pattern Group i w każdym master slocie. Każda pętla feedback musi być niezależna.

---

## 12. Wydajność

Maksymalny zakładany projekt:

```text
8 Pattern Groups
x 2 FX slots
+ 2 master slots
= maksymalnie 18 slotów
```

Nie tworzyć runtime node'ów ciężkiego efektu, gdy slot ma `NONE`. Nie tworzyć jednocześnie compressor i delay w każdym slocie tylko po to, aby jeden był nieaktywny.

---

## 13. UI

W widoku MIXER dodać sekcję efektów dla wybranej Pattern Group. Nie pokazywać jednocześnie dużych paneli dla efektów wszystkich grup.

```text
SELECTED GROUP: PATTERN GROUP 1

GROUP FX

SLOT 1
[ NONE / COMPRESSOR / DELAY ]

SLOT 2
[ NONE / COMPRESSOR / DELAY ]
```

Po wybraniu efektu wyświetlić jego parametry pod slotem.

Master otrzymuje osobną sekcję:

```text
MASTER FX

SLOT 1
[ NONE / COMPRESSOR / DELAY ]

SLOT 2
[ NONE / COMPRESSOR / DELAY ]
```

Nie tworzyć modali, osobnej strony pluginów, drag-and-drop, kabli, graficznego routingu ani rozbudowanego browsera.

Zbudować jedno wspólne źródło dostępnych efektów:

```ts
export const availableEffects = [
  { type: 'none', label: 'NONE' },
  { type: 'compressor', label: 'COMPRESSOR' },
  { type: 'delay', label: 'DELAY' },
] as const
```

Nie duplikować listy osobno dla grup i mastera.

---

## 14. Persistence

Każda Pattern Group zapisuje swoje dwa sloty, a projekt zapisuje dwa sloty mastera. Sprawdzić faktyczny aktualny schema version i zwiększyć go o jeden.

Migracja musi:

1. zachować ustawienia istniejącego master compressora;
2. zachować ustawienia istniejącego master delay;
3. umieścić je w master slotach w tej samej kolejności co obecny routing;
4. utworzyć puste sloty dla wszystkich Pattern Groups;
5. nie zmieniać pozostałych danych projektu.

Starsze projekty muszą nadal się otwierać.

Nie zmieniać padów, banków, assetów, Pattern variants, Pattern Clips, Playlist, Pump, Project Key, CHOP ani transportu.

Walidacja projektu musi sprawdzać dokładnie dwa sloty, poprawny `EffectType`, poprawne configi, stabilne ID slotów, brak nieprawidłowych liczb oraz bezpieczne wartości feedback.

---

## 15. Dispose

Każdy runtime rack i każdy runtime effect musi mieć poprawny cleanup.

Przy `DELAY -> NONE` stara pętla feedback musi zostać odłączona. Przy `COMPRESSOR -> DELAY` stary compressor node musi zostać odłączony.

Przy dispose AudioEngine:

- odłączyć racki grup;
- odłączyć master rack;
- odłączyć sloty;
- odłączyć pętle feedback;
- wyczyścić runtime maps;
- nie pozostawiać aktywnych node'ów.

Ponowny START AUDIO nie może tworzyć podwójnego routingu, podwójnego dry/wet, wielu compressorów w tym samym slocie, wielu pętli feedback ani podwójnej głośności.

---

## 16. Testy manualne

Sprawdzić co najmniej:

1. Wszystkie group sloty `NONE`, master zachowuje obecne efekty.
2. Compressor tylko na jednej grupie.
3. Delay tylko na jednej grupie.
4. `COMPRESSOR -> DELAY` i `DELAY -> COMPRESSOR` na tej samej grupie.
5. Master rack zachowuje obecne brzmienie.
6. Zmianę typu `NONE -> COMPRESSOR -> DELAY -> NONE` podczas playbacku.
7. Dwa niezależne delay: Group 1 `1/4`, Group 2 `1/8`.
8. Równoległe Pattern Clips z efektami różnych grup.
9. SAVE / OPEN wszystkich typów i parametrów slotów.
10. Dispose z kilkoma aktywnymi pętlami feedback.

Oczekiwane: brak crasha, brak podwójnego routingu, brak nieskończonego feedback, niezależne parametry grup, poprawna kolejność efektów i działające migracje.

---

## 17. Testy techniczne

Uruchomić:

```bash
pnpm typecheck
pnpm build
```

Jeżeli repo ma testy jednostkowe, dodać testy dla migracji istniejących master efektów do slotów, walidacji dwóch slotów, tworzenia domyślnego racka, zmiany typu efektu, obliczania czasu delay dla wielu instancji oraz stabilnych ID slotów.

---

## 18. Kryteria akceptacji

- każda Pattern Group ma dokładnie dwa sloty;
- master ma dokładnie dwa sloty;
- lista zawiera NONE, COMPRESSOR i DELAY;
- kolejność slotów odpowiada routingowi;
- group effects działają tylko na swoją grupę;
- master effects działają na sumę i preview;
- istniejące brzmienie mastera zostało zachowane;
- BPM aktualizuje wszystkie zsynchronizowane delay;
- configi grup są niezależne;
- persistence i migracje działają;
- dispose usuwa wszystkie node'y i feedback;
- brak podwójnego routingu;
- Pump, mute, solo i Pattern Clips działają bez regresji;
- `pnpm typecheck` i `pnpm build` przechodzą;
- nie dodano funkcji spoza zakresu.

---

## 19. Zalecana kolejność implementacji

1. Sprawdzić rzeczywisty routing po compressorze i delay.
2. Wydzielić wspólne typy configów, jeżeli jest to bezpieczne.
3. Dodać `EffectType`, `EffectSlotState`, `EffectRackState`.
4. Dodać stabilne ID slotów.
5. Zbudować runtime contract efektu.
6. Zbudować runtime slot.
7. Zbudować runtime rack.
8. Przenieść istniejące master efekty do master racka.
9. Dodać racki Pattern Groups.
10. Podłączyć wspólne BPM do wszystkich delay.
11. Dodać UI listy efektów.
12. Dodać persistence i migrację.
13. Dodać dispose.
14. Wykonać pełne testy.
