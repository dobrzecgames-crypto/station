# Tune Gravity — audyt i prototyp DSP

## Status

**Prototyp badawczy, nie efekt produkcyjny.** Nie został dodany do FX Racka, modelu projektu ani UI. Nie przeszedł odsłuchu na rzeczywistych wokalach, testów Chrome/Edge ani testów telefonu, więc nie spełnia kryteriów akceptacji Tune Gravity.

## Wniosek z audytu Station

- `AudioEngine` jest jedynym właścicielem `BaseAudioContext`, node'ów, głosów i routingu. React wysyła polecenia i pokazuje stan; nie jest zegarem ani miejscem DSP.
- Live playback i offline SONG render korzystają z tej samej klasy `AudioEngine`. To dobry punkt wspólny dla zaakceptowanego efektu, ale obecny prototyp celowo przetwarza zwykły `Float32Array` poza silnikiem.
- Sygnał biegnie przez kanał pada, Pump i bus Pattern Group, następnie przez cztery szeregowe sloty grupy oraz cztery sloty mastera.
- Slot tworzy tylko runtime aktualnie wybranego efektu. Zmiana typu usuwa poprzedni graf, a `dispose()` rozłącza racki i kontekst. Stan node'ów nie jest serializowany.
- Repozytorium nie ma jeszcze żadnego `AudioWorkletProcessor`. Polityka architektury dopuszcza Worklet dopiero dla zmierzonej potrzeby; analiza pitchu i shifter czasu rzeczywistego taką potrzebę prawdopodobnie stworzą.
- Parametry efektów są przechowywane w każdym `EffectSlotState`; projekt ma obecnie schema v19. Globalne `projectKey.root` i `projectKey.scale` są już serializowane i walidowane, więc Tune Gravity nie potrzebuje osobnego systemu skal.
- Nagranie mikrofonowe jest ograniczoną ścieżką wejścia do CHOP: `MediaRecorder` -> decode -> mono-focused WAV asset. Odtwarzanie używa zdekodowanego `AudioBuffer`; eksport SONG używa `OfflineAudioContext`.
- Oficjalnym celem MVP są aktualne Chrome i Edge na Windows. Mobile jest w roadmapie później. Wymagania telefonu z briefu Tune Gravity pozostają obowiązkowym testem jakości DSP, ale nie zostały wykonane w tym etapie.

### Gdzie efekt ma sens

Tune Gravity nie powinien być efektem master. Detektor monofoniczny na pełnym miksie albo akordzie nie ma jednoznacznego F0 i wygeneruje błędne cele.

Obecny rack Pattern Group także nie gwarantuje wejścia monofonicznego — grupa może sumować 16 padów. Najbezpieczniejsza pierwsza integracja to tryb QUALITY przetwarzający pojedynczy, jawnie wybrany wokalny asset i tworzący wynik do dalszego odsłuchu/resamplingu. Taki przepływ wymaga osobnej zgody w granicach roadmapy. Wariant realtime można później umieścić przed sumowaniem grupy wyłącznie tam, gdzie źródło jest pojedynczym wokalem.

## Prototyp

Kod znajduje się w `src/audio/tuneGravity/` i nie zależy od React ani Web Audio node'ów. Narzędzie `tools/tune-gravity-prototype.ts` przyjmuje mono lub stereo PCM16/Float32 WAV, downmixuje analizę do mono i generuje dwa pliki porównawcze oraz raport JSON.

```text
pnpm tune-gravity:prototype input.wav output/tune-gravity \
  --key=A --scale=naturalMinor --gravity=0.65 --speed=0.55 --humanize=0.5
```

Wyniki:

```text
output/tune-gravity-td-psola.wav
output/tune-gravity-granular.wav
output/tune-gravity-report.json
```

Raport liczbowy nie zastępuje odsłuchu.

## Detekcja pitchu

### Wariant wybrany: YIN

YIN liczy funkcję różnicową oraz cumulative mean normalized difference w oknach 2048 próbek, co 256 próbek. Minimum po progu daje F0 z interpolacją paraboliczną. Confidence wynosi `1 - CMNDF`; osobny próg RMS odrzuca ciszę przed kosztowną analizą.

Zakres prototypu to 65–1000 Hz. Domyślnie ramka staje się voiced dopiero przy confidence >= 0.72 i RMS >= 0.006.

### Wariant porównawczy: MPM/NSDF

McLeod Pitch Method liczy normalized square difference i wybiera pierwszy wystarczająco silny dodatni peak. Daje niezależny confidence i służy do wykrywania rozbieżności YIN/MPM na przyszłym korpusie wokalnym.

Oba detektory przechodzą testy na harmonicznych sygnałach głosopodobnych 110 Hz i 330 Hz oraz odrzucają ciszę i szerokopasmowy szum. To nie dowodzi poprawności na prawdziwym wokalu ani odporności na octave errors.

## Wybór nuty i parametry

- F0 jest konwertowane na ciągły numer MIDI i mapowane do pitch classes globalnego Project Key.
- Zmiana celu wymaga, by nowa nuta była wyraźnie bliższa o domyślnie 18 centów i utrzymała się co najmniej 45 ms.
- Krótkie unvoiced gaps zachowują pamięć celu, ale sam szum dostaje ratio 1. Po około 120 ms bez wiarygodnego F0 pamięć jest zerowana.
- GRAVITY zmienia rzeczywistą siłę przyciągania, dead zone i capture range. Nie jest wet/dry. Dalekie błędy są stopniowo osłabiane, a korekta jest ograniczona domyślnie do 300 centów.
- SPEED mapuje się na stałą czasową około 220–8 ms.
- HUMANIZE na dłuższej stabilnej nucie koryguje wolnozmienny środek pitchu, zamiast śledzić każdą próbkę vibrato. Na początku nuty działa mocniej i bardziej bezpośrednio.

## Pitch shifting i formanty

### Wariant wybrany do dalszego odsłuchu: TD-PSOLA

Prototyp wyznacza pitch marks z toru YIN, wybiera lokalne dodatnie maksima i nakłada okna długości około dwóch okresów w nowych odstępach. Zmienia to F0 bez zmiany długości pliku i bez resamplowania całej frazy.

TD-PSOLA zachowuje krótkoczasowy kształt okresu, więc dla małych/średnich korekt powinien lepiej utrzymać obwiednię widmową i formanty niż granularny resampler. Nie ma jeszcze jawnego modelu formantów (LPC/cepstrum), więc nie wolno obiecywać ochrony barwy przy korektach kilku półtonów, niestabilnym F0 lub słabych pitch marks.

### Baseline: granular resampling + overlap-add

Stałe ziarna są lokalnie resamplowane i nakładane. Długość wyniku pozostaje identyczna, ale formanty przesuwają się wraz z pitchem, a granice ziaren mogą modulować barwę. Ten wariant jest generowany po to, by odsłuch miał wyraźny punkt odniesienia; nie jest rekomendowany jako docelowy algorytm.

## Voiced/unvoiced

Korekta jest wyłączana przy niskim RMS, niskim confidence albo braku stabilnego F0. W testach cisza, szum i środkowy segment imitujący oddech mają ratio 1. Granice regionów voiced mają 12 ms crossfade do oryginału. Nadal trzeba sprawdzić prawdziwe spółgłoski, fry, aspirację, szept i leakage podkładu.

## Pomiary techniczne

Środowisko pomiaru: Windows, Node.js 24.14.1, 48 kHz, 3-sekundowy syntetyczny sygnał harmoniczny z glissandem 110–220 Hz i odcinkiem szumu. To pomiar wall-clock prototypu offline, nie profil Chrome AudioWorklet.

| Operacja | Czas | Względem długości materiału |
|---|---:|---:|
| YIN | 1583.6 ms | 0.528x |
| MPM/NSDF | 1770.5 ms | 0.590x |
| YIN + TD-PSOLA | 1938.6 ms | 0.646x |
| YIN + granular baseline | 1658.4 ms | 0.553x |

Szacowany lookahead wariantu realtime przy 48 kHz to 1763 próbki, czyli **36.73 ms**: połowa ramki analizy (21.33 ms) plus maksymalny okres dla 65 Hz (15.40 ms). Implementacja offline nie dodaje ciszy ani zmienia liczby próbek.

Nie wykonano pomiaru CPU telefonu, pamięci przeglądarki ani deadline'ów 128-próbkowego AudioWorkleta. Naiwne O(N × liczba lagów) detektory są prototypem jakościowym i przed realtime wymagają profilowania oraz prawdopodobnie optymalizacji.

Narzędzie CLI przeszło także test end-to-end na dołączonym stereo `chop-sample-1.wav` (20.59 s, 44.1 kHz): odczyt, downmix, oba detektory, oba shiftery, zapis WAV i raport JSON zakończyły się poprawnie. Materiał nie jest oznaczony jako monofoniczny wokal, więc wynik potwierdza wyłącznie działanie narzędzia i nie jest testem jakości Tune Gravity.

## Wykonane testy

- harmoniczny proxy niskiego głosu: 110 Hz,
- harmoniczny proxy wyższego głosu: 330 Hz,
- stabilna nuta z symulowanym vibrato,
- glissando 110–220 Hz w benchmarku,
- lekko niestrojąca nuta kierowana do A3,
- cisza,
- deterministyczny szerokopasmowy szum,
- segment oddechowy między fragmentami voiced,
- histereza na granicy dwóch nut,
- bit-neutralny bypass przy GRAVITY 0,
- identyczna długość wyniku dla obu shifterów.

Nie testowano prawdziwego niskiego/wyższego męskiego wokalu, kobiecego wokalu, rapowanych melodii, ad-libów, spółgłosek, screamów ani zaszumionego nagrania. W repozytorium nie ma oznaczonego, licencjonowanego korpusu wokalnego, a agent nie ma wiarygodnej możliwości wykonania odsłuchu. Z tego powodu prototyp nie może zostać uznany za używalny efekt wokalowy.

## Znane ograniczenia i następny eksperyment

1. Zebrać zestaw krótkich, jawnie licencjonowanych lub dostarczonych przez właściciela projektu wokali obejmujący pełną matrycę z briefu.
2. Dla każdego klipu wygenerować ślepe pary bypass / TD-PSOLA / granular i zachować raporty YIN/MPM.
3. Oznaczyć octave errors, błędne voiced frames, note chatter, utratę spółgłosek i zmianę tożsamości formantów; odsłuch musi być decydujący.
4. Jeżeli TD-PSOLA ma niestabilne pitch marks, porównać pYIN + bardziej odporny GCI/peak tracking. Jeżeli barwa nadal się przesuwa, dołożyć jawny model obwiedni LPC/cepstralnej albo zbadać PSOLA z korekcją formantów.
5. Dopiero po akceptacji QUALITY zoptymalizować analizę i zbudować minimalny AudioWorklet realtime z kontrolowanym lookahead; zmierzyć Chrome/Edge oraz telefon.
6. Dopiero po tych testach zaprojektować parametry projektu, lifecycle workleta, migrację schematu i UI. Master pozostaje wykluczony.

## Uczciwa ocena

Prototyp realizuje kompletny eksperymentalny łańcuch: F0, confidence, voiced/unvoiced, skala, histereza, smoothing, HUMANIZE, limit korekcji i dwa pitch shiftery bez zmiany czasu trwania. Jest wystarczający do rozpoczęcia kontrolowanego odsłuchu. Nie ma jeszcze dowodu, że zachowuje naturalną barwę prawdziwego wokalu, nie generuje metalicznych artefaktów ani spełnia budżet realtime/mobile. **Tune Gravity nie jest ukończony i nie powinien pojawić się na liście efektów Station.**
