# Station — pierwszy prosty kompresor master

## Status dokumentu

- Typ: specyfikacja implementacyjna dla Codexa
- Zakres: pierwszy działający kompresor w Station
- Platforma docelowa: przeglądarka desktopowa, Chrome i Edge na Windows
- Warstwa audio: Web Audio API
- Priorytet: prostota, przewidywalność i brak regresji
- Poza zakresem: emulacja analogowa, saturacja, limiter, sidechain z kicka, auto-makeup, kompresory per pad i per Pattern Group

---

## 1. Cel etapu

Celem jest dodanie do Station jednego prostego kompresora działającego na całym miksie.

Ma on:

1. znajdować się na master busie;
2. przetwarzać dźwięk wszystkich Pattern Groups, padów i podglądu próbek;
3. korzystać z natywnego `DynamicsCompressorNode`;
4. mieć mały, czytelny zestaw parametrów;
5. być domyślnie wyłączony;
6. nie zmieniać timingu sekwencera;
7. nie wprowadzać saturacji, limitera ani „charakteru maszyny”;
8. być przygotowany tak, aby później można było rozbudować Station o kompresory grupowe, ale bez implementowania ich teraz.

To ma być narzędzie użytkowe do delikatnego sklejenia miksu i kontroli szczytów, a nie masteringowy procesor ani rozbudowany moduł dynamiki.

---

## 2. Dlaczego pierwszy kompresor powinien być na masterze

Aktualny silnik ma już:

- niezależne kanały padów;
- Pump Gain dla kanałów;
- busy Pattern Groups;
- master gain;
- wspólny punkt wyjścia do `AudioContext.destination`.

Najprostszy i najbardziej kontrolowany tor to:

```text
pad voice
-> channel gain
-> pump gain
-> Pattern Group bus
-> master compressor
-> master gain
-> destination
```

Podgląd źródła powinien korzystać z tego samego końcowego toru:

```text
preview voice
-> master compressor
-> master gain
-> destination
```

Dzięki temu:

- cały słyszalny sygnał przechodzi przez ten sam kompresor;
- nie trzeba tworzyć wielu instancji procesora;
- CPU i złożoność pozostają minimalne;
- UI nie musi jeszcze rozróżniać kompresji padów, grup i mastera;
- zachowujemy Station jako groovebox, a nie pełny DAW.

---

## 3. Zakres funkcjonalny wersji 1

### 3.1. Parametry dostępne dla użytkownika

Pierwsza wersja ma zawierać dokładnie:

| Parametr | Zakres UI | Wartość domyślna | Znaczenie |
|---|---:|---:|---|
| ENABLED | on/off | off | Włącza lub omija działanie kompresora |
| THRESHOLD | -60 do 0 dB | -18 dB | Poziom, od którego zaczyna się kompresja |
| RATIO | 1:1 do 12:1 | 4:1 | Siła kompresji powyżej progu |
| ATTACK | 0.003 do 0.100 s | 0.010 s | Czas reakcji |
| RELEASE | 0.050 do 1.000 s | 0.250 s | Czas powrotu |

Nie dodawać teraz:

- knee;
- makeup gain;
- auto gain;
- input gain;
- output gain;
- mix/dry-wet;
- lookahead;
- sidechain;
- tryb peak/RMS;
- presetów;
- wizualizacji obwiedni;
- historii gain reduction;
- kompresora wielopasmowego.

`knee` może pozostać stałą wartością wewnętrzną.

### 3.2. Stała wartość knee

Ustawić:

```ts
knee = 12
```

To daje umiarkowanie miękkie wejście w kompresję bez dokładania kolejnej kontrolki.

### 3.3. Bypass

`DynamicsCompressorNode` nie ma natywnego parametru bypass.

W pierwszej wersji nie budować równoległego dry/wet routingu. Zamiast tego, gdy kompresor jest wyłączony, ustawić go w praktycznie neutralnym stanie:

```ts
threshold = 0
ratio = 1
attack = 0.003
release = 0.050
knee = 0
```

Po ponownym włączeniu przywrócić zapisane parametry użytkownika.

To zachowuje stałą topologię grafu audio i eliminuje ryzyko kliknięć związanych z przepinaniem node'ów podczas odtwarzania.

---

## 4. Model stanu

Dodać typ:

```ts
export interface MasterCompressorConfig {
  enabled: boolean
  thresholdDb: number
  ratio: number
  attackSeconds: number
  releaseSeconds: number
}
```

Domyślna konfiguracja:

```ts
export const defaultMasterCompressorConfig: MasterCompressorConfig = {
  enabled: false,
  thresholdDb: -18,
  ratio: 4,
  attackSeconds: 0.01,
  releaseSeconds: 0.25,
}
```

Stan serializowany nie może zawierać Web Audio node'ów.

`DynamicsCompressorNode` pozostaje wyłącznie runtime state wewnątrz `AudioEngine`.

---

## 5. Zmiana topologii AudioEngine

### 5.1. Nowe pole runtime

W `AudioEngine` dodać:

```ts
private masterCompressor: DynamicsCompressorNode | undefined
private masterCompressorConfig: MasterCompressorConfig =
  defaultMasterCompressorConfig
```

Domyślną konfigurację należy skopiować, a nie współdzielić jako mutowalny obiekt.

### 5.2. Tworzenie node'a

Podczas `initialize()` graf powinien zostać zbudowany tylko raz.

Zamiast tworzenia wyłącznie `masterGain`, stworzyć końcowy tor:

```text
masterCompressor -> masterGain -> destination
```

Sugerowana odpowiedzialność metod:

```ts
private createMasterOutput(context: AudioContext): void
private applyMasterCompressorConfig(immediately?: boolean): void
```

`createMasterOutput()` ma:

1. stworzyć `DynamicsCompressorNode`;
2. stworzyć `GainNode` mastera;
3. połączyć kompresor z master gainem;
4. połączyć master gain z destination;
5. ustawić parametry kompresora;
6. ustawić master volume i mute.

Nie tworzyć node'ów ponownie, jeżeli już istnieją.

### 5.3. Nowe połączenia

Wszystkie Pattern Group busy mają kończyć się na:

```ts
bus.gain.connect(this.masterCompressor)
```

a nie bezpośrednio na `masterGain`.

Preview ma kończyć się na:

```ts
gain.connect(this.masterCompressor)
```

a nie bezpośrednio na `masterGain`.

Kanały nadal mają iść:

```text
channel gain -> pump gain -> group bus
```

Nie zmieniać ich lokalnego routingu.

---

## 6. Publiczne API AudioEngine

Dodać jedną główną metodę:

```ts
setMasterCompressorConfig(config: MasterCompressorConfig): void
```

Metoda ma:

1. zwalidować i ograniczyć wartości;
2. zapisać bezpieczną kopię konfiguracji;
3. zastosować ją do runtime node'a, jeśli audio jest uruchomione.

Opcjonalnie dodać:

```ts
getMasterCompressorReductionDb(): number
```

Implementacja:

```ts
return this.masterCompressor?.reduction ?? 0
```

Ta metoda jest potrzebna tylko wtedy, jeśli od razu powstanie prosty meter redukcji. Sam odczyt może zostać dodany bez rozbudowanego UI.

Nie wystawiać samego `DynamicsCompressorNode` poza `AudioEngine`.

---

## 7. Walidacja parametrów

Dodać funkcje clampujące.

```ts
thresholdDb: -60 do 0
ratio: 1 do 12
attackSeconds: 0.003 do 0.1
releaseSeconds: 0.05 do 1
```

Nie polegać wyłącznie na poprawności danych z UI lub projektu.

Przykład:

```ts
private clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}
```

Dla nieprawidłowych wartości lepiej użyć wartości domyślnej danego parametru niż arbitralnego minimum.

---

## 8. Automatyzacja parametrów bez klików

Zmiany parametrów podczas odtwarzania nie powinny tworzyć gwałtownych skoków.

Dla każdego `AudioParam`:

1. pobrać `context.currentTime`;
2. anulować przyszłe zdarzenia;
3. zachować bieżącą wartość;
4. wykonać krótki ramp.

Sugerowany czas:

```ts
0.02 s
```

Przykład pomocniczej metody:

```ts
private rampAudioParam(
  parameter: AudioParam,
  target: number,
  durationSeconds = 0.02,
): void {
  if (!this.context) return
  const now = this.context.currentTime
  parameter.cancelScheduledValues(now)
  parameter.setValueAtTime(parameter.value, now)
  parameter.linearRampToValueAtTime(target, now + durationSeconds)
}
```

Dla pierwszej konfiguracji po utworzeniu node'a wartości mogą być ustawione natychmiast.

---

## 9. Gain reduction meter

### 9.1. Minimalna wersja

Meter nie jest wymagany do działania DSP, ale jest bardzo przydatny do oceny, czy kompresor faktycznie pracuje.

Jeżeli zostanie dodany w tym samym etapie, ma pokazywać wyłącznie:

```text
GR 0.0 dB
```

lub np. pasek od 0 do -20 dB.

### 9.2. Odczyt

`DynamicsCompressorNode.reduction` jest wartością tylko do odczytu i zwykle jest ujemna.

UI może odświeżać ją przez `requestAnimationFrame`, ale:

- React nie może sterować audio timingiem;
- odczyt meteru jest tylko prezentacją;
- zatrzymać pętlę po odmontowaniu komponentu;
- nie zapisywać gain reduction w projekcie;
- nie aktualizować całej aplikacji częściej niż trzeba.

Dopuszczalne jest ograniczenie odświeżania do około 20–30 FPS.

### 9.3. Decyzja zakresowa

Jeżeli meter znacząco powiększy zmianę, odłożyć go do kolejnego małego zadania.

DSP, stan, persistence i podstawowe UI mają pierwszeństwo.

---

## 10. UI

### 10.1. Lokalizacja

Kompresor powinien znaleźć się w widoku miksera, przy sekcji MASTER.

Nie tworzyć osobnego dużego ekranu ani racka efektów.

### 10.2. Proponowany układ

```text
MASTER COMP

[ ON ]

THRESHOLD   -18 dB
RATIO       4:1
ATTACK      10 ms
RELEASE     250 ms

GR          -3.2 dB
```

Meter GR jest opcjonalny w tym etapie.

### 10.3. Kontrolki

Na początek użyć zwykłych sliderów lub kontrolek zgodnych z obecnym mikserem.

Wyświetlanie:

- threshold: liczba całkowita lub 1 miejsce po przecinku, `dB`;
- ratio: 1 miejsce po przecinku, `:1`;
- attack: przeliczyć sekundy na `ms`;
- release: przeliczyć sekundy na `ms`.

Nie wprowadzać jeszcze gałek obrotowych, dragowania pionowego ani podwójnego kliknięcia do resetu, jeżeli nie ma tego standardu w obecnym UI.

### 10.4. Zachowanie disabled

Gdy `enabled === false`:

- wartości użytkownika pozostają widoczne;
- kontrolki parametrów mogą pozostać aktywne;
- użytkownik może przygotować ustawienia przed włączeniem;
- sekcja powinna wizualnie wskazywać bypass;
- nie kasować parametrów po wyłączeniu.

---

## 11. Integracja z App

React ma przechowywać serializowalny config:

```ts
const [masterCompressor, setMasterCompressor] =
  useState(defaultMasterCompressorConfig)
```

Po zmianie stanu:

```ts
useEffect(() => {
  audioEngine.setMasterCompressorConfig(masterCompressor)
}, [audioEngine, masterCompressor])
```

Nie tworzyć node'a w komponencie React.

Nie odwoływać się do `AudioContext` z UI.

Nie ustawiać parametrów kompresora bezpośrednio z komponentu miksera.

Komponent UI ma emitować tylko nowy `MasterCompressorConfig`.

---

## 12. Persistence

### 12.1. Stan docelowy

Konfiguracja kompresora powinna być częścią zapisywanego projektu.

Dodać do `ProjectState`:

```ts
masterCompressor: MasterCompressorConfig
```

### 12.2. Migracja schema-v3

Aktualne projekty schema-v3 nie mają pola kompresora.

Najbezpieczniej:

- zwiększyć schemat do v4;
- projekty v1, v2 i v3 migrować do v4;
- brakujące pole uzupełniać `defaultMasterCompressorConfig`;
- po otwarciu projektu kompresor pozostaje wyłączony.

Nie reinterpretować żadnych istniejących danych jako ustawień kompresora.

### 12.3. Walidacja projektu

Loader ma odrzucać lub bezpiecznie normalizować:

- `NaN`;
- `Infinity`;
- wartości poza zakresem;
- brakujące właściwości;
- nieprawidłowy typ `enabled`.

Zalecenie: migracja uzupełnia brakujące dane, walidator finalnego schema-v4 wymaga pełnej poprawnej struktury.

---

## 13. Testy manualne

Przed uznaniem zadania za skończone wykonać wszystkie poniższe testy.

### Test A — neutralny bypass

1. Uruchomić audio.
2. Załadować próbki.
3. Odtworzyć pattern.
4. Kompresor pozostawić wyłączony.
5. Porównać poziom i charakter z buildem sprzed zmiany.

Oczekiwany wynik:

- brak słyszalnej kompresji;
- brak spadku głośności;
- brak klików;
- brak zmiany stereo;
- brak przerwania odtwarzania.

### Test B — wyraźna kompresja

Ustawić:

```text
threshold: -30 dB
ratio: 10:1
attack: 3 ms
release: 300 ms
```

Oczekiwany wynik:

- transjenty i suma są wyraźnie ściskane;
- dźwięk nadal działa;
- brak przesteru spowodowanego samym node'em;
- po wyłączeniu kompresora sygnał wraca do neutralnego.

### Test C — zmiany podczas playbacku

Podczas odtwarzania przesuwać wszystkie parametry.

Oczekiwany wynik:

- brak crasha;
- brak utraty audio;
- brak przepięcia grafu;
- brak wyraźnych cyfrowych klików;
- sekwencer utrzymuje timing.

### Test D — wszystkie źródła sygnału

Sprawdzić:

- manualne odpalanie padów;
- odtwarzanie sekwencera;
- równoległe Pattern Clips;
- solo i mute kanałów;
- solo i mute Pattern Groups;
- Pump;
- preview próbki;
- master mute i volume.

Oczekiwany wynik:

- każdy słyszalny sygnał przechodzi przez kompresor;
- Pump nadal działa przed kompresorem;
- master mute pozostaje ostatnią kontrolą poziomu;
- preview nie omija kompresora.

### Test E — SAVE / OPEN

1. Ustawić niestandardowe parametry.
2. Włączyć kompresor.
3. Zapisać projekt.
4. Odświeżyć aplikację.
5. Uruchomić audio.
6. Otworzyć projekt.

Oczekiwany wynik:

- parametry wracają;
- enabled wraca;
- audio pozostaje zatrzymane po OPEN zgodnie z obecnym zachowaniem;
- stare projekty otwierają się z kompresorem wyłączonym.

### Test F — dispose i ponowny start

1. Uruchomić audio.
2. Odtwarzać dźwięk.
3. Wywołać ścieżkę cleanup/dispose.
4. Uruchomić ponownie.

Oczekiwany wynik:

- stare node'y są odłączone;
- brak podwójnego routingu;
- brak dwukrotnie głośniejszego sygnału;
- nie pozostają aktywne głosy.

---

## 14. Kryteria akceptacji

Zadanie jest ukończone tylko wtedy, gdy:

- [ ] istnieje jeden `DynamicsCompressorNode`;
- [ ] znajduje się między całą sumą audio a master gainem;
- [ ] preview również przez niego przechodzi;
- [ ] kompresor jest domyślnie wyłączony;
- [ ] bypass jest praktycznie neutralny;
- [ ] użytkownik ma ENABLED, THRESHOLD, RATIO, ATTACK i RELEASE;
- [ ] parametry są walidowane;
- [ ] zmiany są wygładzane;
- [ ] node jest własnością `AudioEngine`;
- [ ] React nie steruje timingiem audio;
- [ ] konfiguracja zapisuje się w projekcie;
- [ ] migracja starszych projektów działa;
- [ ] `pnpm typecheck` przechodzi;
- [ ] `pnpm build` przechodzi;
- [ ] nie zmieniono Pumpa;
- [ ] nie dodano saturacji ani limitera;
- [ ] nie dodano procesorów per pad ani per group;
- [ ] nie wykonano niezwiązanych refactorów.

---

## 15. Ryzyka i zabezpieczenia

### Ryzyko 1 — preview omija procesor

Obecny preview może łączyć się bezpośrednio z master gainem.

Zabezpieczenie:

- wyszukać każde `.connect(this.masterGain)`;
- świadomie zdecydować, czy połączenie ma trafić do kompresora;
- końcowo tylko `masterCompressor` powinien łączyć się z `masterGain`.

### Ryzyko 2 — podwójne połączenie node'ów

Ponowne `initialize()` nie może tworzyć kolejnych równoległych połączeń.

Zabezpieczenie:

- node'y tworzyć warunkowo;
- nie wykonywać ponownego `connect`, jeśli graf już istnieje;
- sprawdzić ponowny START AUDIO.

### Ryzyko 3 — bypass zmienia barwę lub poziom

Nawet niewłaściwie ustawiony kompresor może ingerować w sygnał.

Zabezpieczenie:

```text
threshold 0 dB
ratio 1:1
knee 0 dB
```

### Ryzyko 4 — schema migration staje się zbyt szeroka

Ostatni commit już zmienił persistence do schema-v3.

Zabezpieczenie:

- osobna, mała migracja v3 -> v4;
- brak zmian w bankach Pattern Groups;
- brak zmian w assetach;
- brak zmian w Playlist;
- brak przebudowy całego systemu persistence.

### Ryzyko 5 — za duży zakres UI

Zabezpieczenie:

- jedna zwarta sekcja MASTER COMP;
- bez efekt racka;
- bez presetów;
- bez animowanych wykresów;
- meter GR opcjonalny.

---

## 16. Zalecana kolejność implementacji

### Krok 1 — typy i wartości domyślne

- utworzyć `MasterCompressorConfig`;
- dodać default config;
- dodać clamp/normalizację.

### Krok 2 — runtime node

- dodać `masterCompressor`;
- przebudować końcową część grafu;
- skierować group busy i preview do kompresora;
- poprawić dispose.

### Krok 3 — publiczne API

- dodać `setMasterCompressorConfig`;
- zastosować smoothing;
- zapewnić neutralny bypass.

### Krok 4 — test samego DSP

Przed UI ręcznie ustawić config w kodzie i potwierdzić:

- że kompresja jest słyszalna;
- że bypass jest neutralny;
- że preview przechodzi przez node;
- że Pump nadal działa.

### Krok 5 — UI

- dodać sekcję do Master;
- podpiąć pięć kontrolek;
- nie rozbudowywać stylistyki ponad obecny standard.

### Krok 6 — persistence v4

- zapisywanie configu;
- migracja v1/v2/v3;
- walidacja;
- test SAVE/OPEN.

### Krok 7 — końcowy QA

- typecheck;
- build;
- wszystkie testy manualne;
- raport zmienionych plików i znanych ograniczeń.

---

## 17. Dokładne zadanie dla Codexa

```text
Zaimplementuj pierwszy prosty kompresor master w Station zgodnie z dokumentem
docs/FIRST_MASTER_COMPRESSOR_IMPLEMENTATION.md.

Najważniejsze wymagania:

1. Użyj jednego natywnego Web Audio DynamicsCompressorNode.
2. Umieść go w torze:
   wszystkie group busy i preview -> master compressor -> master gain -> destination.
3. Nie twórz kompresorów per pad ani per Pattern Group.
4. Kompresor ma być domyślnie wyłączony i w bypassie praktycznie neutralny.
5. Udostępnij tylko:
   enabled, threshold, ratio, attack, release.
6. Knee pozostaje wewnętrzną stałą 12 dB przy włączonym procesorze.
7. Zmiany AudioParam wygładzaj krótkim rampem.
8. Runtime Web Audio node pozostaje wyłącznie w AudioEngine.
9. Dodaj config do persistence i bezpieczną migrację obecnego schema-v3 do v4.
10. Nie zmieniaj zachowania Pumpa, sekwencera, banków Pattern Groups, Playlist ani CHOP.
11. Nie dodawaj saturacji, limitera, makeup gain, dry/wet, sidechainu ani presetów.
12. Nie wykonuj szerokiego refactoru niezwiązanego z kompresorem.
13. Dopilnuj, aby preview również przechodził przez kompresor.
14. Zaktualizuj dispose tak, aby node był poprawnie odłączany.
15. Uruchom pnpm typecheck oraz pnpm build.

Najpierw przeanalizuj aktualny routing i persistence. Następnie wykonuj zmianę małymi krokami.
Na końcu przedstaw:
- listę zmienionych plików;
- końcowy routing audio;
- opis migracji schema-v4;
- wyniki typecheck/build;
- wykonane testy manualne;
- wszelkie pozostałe ograniczenia.

Nie commituj i nie pushuj, dopóki nie otrzymasz osobnej zgody.
```

---

## 18. Co świadomie odkładamy

Po potwierdzeniu, że master compressor działa stabilnie, kolejne osobne etapy mogą obejmować:

1. prosty meter gain reduction;
2. output/makeup gain;
3. jeden kompresor na Pattern Group bus;
4. preset „Glue”;
5. opcjonalny dry/wet;
6. dopiero później analizę, czy Station potrzebuje limitera wyjściowego.

Sidechain i inteligentne wykrywanie kicka nie należą do tego procesora. Station ma już Pump jako osobny, muzyczny system duckingu i nie należy mieszać obu funkcji w pierwszym etapie.
