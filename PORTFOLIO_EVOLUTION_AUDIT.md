# Station — audyt ewolucji funkcji do portfolio

Data audytu: 2026-07-28  
Punkt odniesienia dla aktualnej wersji: `20c8ee2` (`main`)  
Status materiału: analiza lokalna, bez publikacji i bez zmian w działającej aplikacji Station

## Zasady interpretacji

- `HISTORICAL BUILD` oznacza UI i funkcję odtworzone bezpośrednio z podanego commita.
- `RECONSTRUCTED EARLY STATE` oznacza kontrolowaną wizualizację funkcji cofniętej do języka najwcześniejszego prototypu. Nie jest przedstawiana jako prawdziwy screenshot z historii.
- `CURRENT BUILD` oznacza czysty build commita `20c8ee2`, będącego aktualnym `HEAD` brancha `main` podczas audytu.
- Niezacommitowane zmiany znajdujące się w głównym katalogu roboczym zostały uznane za pracę w toku i nie są podstawą materiałów `CURRENT BUILD`.
- Rozwój funkcji i rozwój designu są rozdzielone. Vinyl Dust, chassis, światło i dopracowane powierzchnie pojawiają się wyłącznie w stanie `CURRENT`.

## Najważniejsze punkty zwrotne

| Commit | Znaczenie dla historii produktu |
| --- | --- |
| `550369f` | M1: jeden WAV, inicjalizacja audio, jeden pad/przycisk odtwarzania |
| `e8d92f5` | M3: grywalny bank 16 padów |
| `07c4d7a` | M4: pierwszy 16-krokowy sekwencer |
| `98b7649` | pierwsze Basic Pump |
| `dfbb888` | pierwszy mikser kanałów |
| `5307ea0` | manualne slice’y i waveform |
| `c5c5f17` | Unified Chop Workspace |
| `3ab73a0` | Pattern Groups, Song/Playlist i persistence |
| `ead3930` | pierwsza biblioteka próbek i kontekstowy workflow |
| `a60afbc` | rozszerzenie workflow na wąskich ekranach |
| `3263d54` | Equal + Smart Auto Chop, w tym wykrywanie transientów |
| `8aa9e92` | pionowe paski miksera |
| `66352ed` | Lab Interface i świadomy etap projektowania responsywnego UI |
| `71b7c66` | uproszczony SEQ i SONG jako lanes aranżacji |
| `dc14e7e` | rzeczywisty podział SEQ na `01–08 / 09–16` |
| `ac13738` | pierwsza kompletna implementacja System Display |
| `5f79dfa` | jeden stały rozmiar System Display i MIX bus na ekranie |
| `735d392` | offline render SONG do WAV |
| `20c8ee2` | aktualny zatwierdzony punkt odniesienia |

## Audyt funkcji

### 1. Pierwszy odtwarzacz WAV

| Pole | Ustalenie |
| --- | --- |
| Obecny stan | WAV jest źródłem dla padów, CHOP, patternów, miksera, Pump, zapisu projektu i renderu SONG. |
| Najwcześniejszy rzeczywisty stan | `550369f`: jeden plik WAV, `START AUDIO`, nazwa pliku i jeden przycisk/pad `PLAY SAMPLE`, również klawisz `A`. |
| Commit / zakres | `550369f`; dokument zadania: `docs/tasks/M1_AUDIO_PROOF_OF_CONCEPT.md`. |
| Sensowny etap pośredni | Nie. Skok do banku padów jest wystarczająco mocny i należy do kolejnego rozdziału funkcji. |
| Czy potrzebna rekonstrukcja | Nie. Rzeczywisty build jest idealnym punktem startowym. |
| Materiały | Jeden desktopowy screenshot M1; opcjonalnie ciasny kadr samego inputu i przycisku. |
| Co pokazać | Jedno zadanie: wybierz WAV i uruchom dźwięk. Surowość jest atutem. |
| Czego nie pokazywać | Pad banku, waveformu, transportu, BPM, designu Vinyl Dust. |
| Ryzyko pomieszania z designem | Niskie. Build ma prosty, wczesny styl. |
| Rekomendowane stany | Tylko `EARLY`; późniejszy kontrast zapewnia finał całej historii. |

### 2. LIBRARY

| Pole | Ustalenie |
| --- | --- |
| Obecny stan | Wbudowane kategorie próbek, preview i workflow browse-and-tap połączony z przypisaniem do pada oraz System Display. |
| Najwcześniejszy rzeczywisty stan | `ead3930`: pierwsza biblioteka i podstawowy wybór/przypisanie. |
| Commit / zakres | `ead3930` → `5cbad1b` → `64f1e0b`; dalsze uporządkowanie `7016678`, `ff8d918`. |
| Sensowny etap pośredni | Tak: `64f1e0b`, gdzie przypisanie zmienia się w czytelny browse-and-tap flow. |
| Czy potrzebna rekonstrukcja | Nie dla samej Library. Do jednego wspólnego kadru „Library + Pad” można użyć uproszczonej rekonstrukcji, jeśli historyczny layout okaże się zbyt rozproszony. |
| Materiały | Wczesna lista próbek z celem przypisania; bieżący widok biblioteki z aktywnym kontekstem pada. |
| Co pokazać | Drogę „znajdź dźwięk → odsłuchaj → przypisz do pada”. |
| Czego nie pokazywać | Pełnego FX Racka i elementów niezwiązanych z wyborem próbki. |
| Ryzyko pomieszania z designem | Średnie od `66352ed`; bieżący wygląd należy pokazać jako wynik, nie jako genezę funkcji. |
| Rekomendowane stany | `EARLY` (`ead3930`), `INTERMEDIATE` (`64f1e0b`), `CURRENT` (`20c8ee2`). |

### 3. PAD

| Pole | Ustalenie |
| --- | --- |
| Obecny stan | 16 padów na Pattern Group, pointer/keyboard, sample browser, parametry dźwięku, slice’y, pitch i mapowanie skali. |
| Najwcześniejszy rzeczywisty stan | `e8d92f5`: 16-pad bank, przypisanie WAV per pad, volume/pitch i granie myszą lub klawiaturą. |
| Commit / zakres | `e8d92f5`; później `ca46619` (banki per Pattern Group), `ff8d918` i `1eeaf47` (bieżący workflow edycji dźwięku). |
| Sensowny etap pośredni | Nie dla głównego kontrastu. Najwcześniejszy pad bank już jasno komunikuje instrument. |
| Czy potrzebna rekonstrukcja | Nie. |
| Materiały | Autentyczny wczesny bank 4×4 i bieżący bank z załadowanymi dźwiękami. |
| Co pokazać | Moment, w którym pojedynczy plik staje się grywalnym instrumentem. |
| Czego nie pokazywać | Zaawansowanych parametrów, jeśli odciągają uwagę od live play. |
| Ryzyko pomieszania z designem | Niskie w `e8d92f5`, wysokie w bieżącym stanie. |
| Rekomendowane stany | `EARLY` (`e8d92f5`), `CURRENT` (`20c8ee2`). |

### 4. CHOP — ręczne cięcie

| Pole | Ustalenie |
| --- | --- |
| Obecny stan | Oddzielne źródło CHOP, waveform, ręczne markery, preview, drag markerów, automatyczne slice’y i mapowanie na pady. |
| Najwcześniejszy rzeczywisty stan | `5307ea0`: waveform i ręczne slice’y w Sample Editorze. |
| Commit / zakres | `5307ea0`; `c5c5f17` tworzy Unified Chop Workspace; `7fb3eab` dodaje przesuwanie markerów. |
| Sensowny etap pośredni | Tak: `c5c5f17` pokazuje funkcję jako osobny workflow, jeszcze przed autoslicingiem. |
| Czy potrzebna rekonstrukcja | Nie. |
| Materiały | Wczesny waveform z markerami; pośredni Unified Chop Workspace; bieżący CHOP. |
| Co pokazać | Manualne ustawianie cięć i mapowanie fragmentów na kolejne pady. |
| Czego nie pokazywać | Automatycznego cięcia w pierwszym kadrze; nie może wyglądać jak zastępstwo manualnego workflow. |
| Ryzyko pomieszania z designem | Niskie w `5307ea0`; średnie w `c5c5f17`; wysokie w `CURRENT`. |
| Rekomendowane stany | `EARLY` (`5307ea0`), `INTERMEDIATE` (`c5c5f17`), `CURRENT` (`20c8ee2`). |

### 5. Autoslicing transientów

| Pole | Ustalenie |
| --- | --- |
| Obecny stan | Equal slicing i Smart slicing z wykrywaniem kandydatów transientów, regulacją liczby slice’ów i preview. |
| Najwcześniejszy rzeczywisty stan | `3263d54`: `autoChopOperations.ts` i UI Equal + Smart Auto Chop. |
| Commit / zakres | `3263d54`; późniejsze uproszczenia layoutu `3f586f1`, `ff8d918`. |
| Sensowny etap pośredni | Nie. Funkcja pojawia się już w czytelnej, użytecznej formie. |
| Czy potrzebna rekonstrukcja | Tak, tylko jeśli potrzebny będzie osobny „przed/po” w jednym spójnym, surowym layoucie CHOP. Taki kadr musi mieć etykietę `RECONSTRUCTED EARLY STATE`. |
| Materiały | Manualne markery jako „przed”; Smart preview i automatycznie rozmieszczone markery jako „po”. |
| Co pokazać | Skrócenie drogi, nie magiczną zamianę manualnego cięcia. |
| Czego nie pokazywać | Szczegółów algorytmu, bucketów peaks ani obietnicy perfekcyjnej detekcji. |
| Ryzyko pomieszania z designem | Wysokie: funkcja powstała już w rozwiniętym UI. |
| Rekomendowane stany | Wspólny `INTERMEDIATE` w sekcji CHOP (`3263d54`), nie osobny rozdział. |

### 6. SEQ

| Pole | Ustalenie |
| --- | --- |
| Obecny stan | 16 ścieżek × 16 kroków, Pattern Groups, warianty A–D, velocity, shift, playhead i dwa zakresy po osiem kroków. |
| Najwcześniejszy rzeczywisty stan | `07c4d7a`: prosty 16-step sequencer dla wybranego pada, minimalny transport i BPM. |
| Commit / zakres | `07c4d7a`; `23c8e20`; `f58f9ad`; `3ab73a0`; `dc14e7e`. |
| Sensowny etap pośredni | Tak, ale jeden: `dc14e7e` jako odpowiedź na problem szerokości. |
| Czy potrzebna rekonstrukcja | Nie. Wczesny i obecny stan są historyczne. |
| Materiały | Desktop EARLY z jednym rzędem 16 kroków; wąski kadr problemu; wąski kadr z `01–08 / 09–16`; bieżący desktop. |
| Co pokazać | Od jednego rzędu do matrycy wielu padów oraz decyzję o dwóch ośmiokrokowych stronach. |
| Czego nie pokazywać | Rozbudowanego tutorialu velocity/shift ani wszystkich Pattern Group operations. |
| Ryzyko pomieszania z designem | Średnie: podział stron wszedł razem z odświeżeniem powierzchni, ale sama decyzja funkcjonalna ma precyzyjny commit. |
| Rekomendowane stany | `EARLY` (`07c4d7a`), `INTERMEDIATE` (`dc14e7e`, mobile), `CURRENT` (`20c8ee2`). |

### 7. Podział kroków `01–08 / 09–16`

| Pole | Ustalenie |
| --- | --- |
| Obecny stan | Dwa jawne taby zakresów, po osiem kroków w matrycy. |
| Najwcześniejszy rzeczywisty stan | `dc14e7e`, linie `stepPage`, `pageStartStep` i przyciski zakresu. |
| Commit / zakres | `dc14e7e`; decyzja pozostaje w `20c8ee2`. |
| Sensowny etap pośredni | To samo jest etapem pośrednim całego SEQ. |
| Czy potrzebna rekonstrukcja | Tylko dla syntetycznego kadru „ściśnięte 16 → czytelne 8+8”. Oba interfejsy można też pokazać na autentycznych buildach. |
| Materiały | Dwa mobilne screenshoty o identycznym viewportcie. |
| Co pokazać | Brak poziomego scrolla i większe, czytelne cele dotykowe. |
| Czego nie pokazywać | Nie twierdzić, że Station przeszło z dokładnie takiego samego finalnego layoutu 16-krokowego; pierwsza strona problemu może być rekonstrukcją porównawczą. |
| Ryzyko pomieszania z designem | Średnie; status każdego kadru musi być zapisany w indeksie. |
| Rekomendowane stany | `EARLY/PROBLEM` jako uczciwa rekonstrukcja porównawcza, `INTERMEDIATE` jako historyczny `dc14e7e`. |

### 8. SONG

| Pole | Ustalenie |
| --- | --- |
| Obecny stan | Playlist pattern clips z równoległymi klipami, stronicowaniem slotów i offline renderem do WAV. |
| Najwcześniejszy rzeczywisty stan | `3ab73a0`: prosta Playlist i pattern clips. |
| Commit / zakres | `3ab73a0`; `adca4ed` (paint-drag); `71b7c66` (arrangement lanes); `ff8d918` (8-slot page); `735d392` (render WAV). |
| Sensowny etap pośredni | Tak: `71b7c66` pokazuje przejście z listy/siatki do czytelnych lanes. |
| Czy potrzebna rekonstrukcja | Nie dla zasadniczej historii. |
| Materiały | Wczesna prosta siatka Playlist; lanes z początkiem, rozwinięciem i zakończeniem; bieżący SONG. |
| Co pokazać | Jak patterny stają się strukturą utworu. |
| Czego nie pokazywać | Nie nazywać tego nieskończonym timeline’em lub DAW arrangement. |
| Ryzyko pomieszania z designem | Średnie w `71b7c66`, wysokie w `CURRENT`. |
| Rekomendowane stany | `EARLY` (`3ab73a0`), `INTERMEDIATE` (`71b7c66`), `CURRENT` (`20c8ee2`). |

### 9. MIX i suwaki miksera

| Pole | Ustalenie |
| --- | --- |
| Obecny stan | 16 kanałów z pionowymi faderami, mute/solo, metering, busy grup i mastera, FX oraz wielo-trasowy Pump. |
| Najwcześniejszy rzeczywisty stan | `dfbb888`: siatka kart kanałów z poziomymi suwakami, mute/solo i statusem Pump. |
| Commit / zakres | `dfbb888`; `8aa9e92` (pionowe fader strips); `dc14e7e` (metering/Vinyl Dust pass); `5f79dfa` (bus na displayu). |
| Sensowny etap pośredni | Tak: `8aa9e92`, bo zmiana orientacji suwaków jest natychmiast czytelna. |
| Czy potrzebna rekonstrukcja | Nie. |
| Materiały | Wczesne karty z poziomymi sliderami; pośrednie pionowe fader strips; bieżący MIX. |
| Co pokazać | Rosnącą kontrolę proporcji bez wchodzenia w pełny routing FX. |
| Czego nie pokazywać | Szczegółowych compressor/delay/EQ paneli i całej architektury busów. |
| Ryzyko pomieszania z designem | Niskie w `dfbb888`, średnie w `8aa9e92`, wysokie w `CURRENT`. |
| Rekomendowane stany | `EARLY` (`dfbb888`), `INTERMEDIATE` (`8aa9e92`), `CURRENT` (`20c8ee2`). |

### 10. Pump / sidechain

| Pole | Ustalenie |
| --- | --- |
| Obecny stan | Manualny muzyczny sidechain z niezależnymi trasami, źródłami i ustawieniami na cele. |
| Najwcześniejszy rzeczywisty stan | `98b7649`: Basic Pump z jednym źródłem kicka, celami, depth/length/profile. |
| Commit / zakres | `98b7649`; `dfbb888`; `20c8ee2`. |
| Sensowny etap pośredni | Nie w tym portfolio. Pump pozostaje częścią rozwoju MIX. |
| Czy potrzebna rekonstrukcja | Nie. |
| Materiały | Mały detal wczesnego panelu Pump i detal bieżącego MIX/Pump, maksymalnie dwa kadry. |
| Co pokazać | „Efekt sidechain, który stał się charakterystycznym ruchem Station”. |
| Czego nie pokazywać | Zaawansowanej analizy kicka, technicznej topologii routingu ani osobnego rozdziału DSP. |
| Ryzyko pomieszania z designem | Średnie; bieżący Pump wizualnie mocno korzysta z System Display. |
| Rekomendowane stany | Włączony w `MIX EARLY` i `MIX CURRENT`; bez osobnego `INTERMEDIATE`. |

### 11. SYSTEM DISPLAY

| Pole | Ustalenie |
| --- | --- |
| Obecny stan | Jeden dynamiczny obszar line + panel, przejmowany przez kontekst aktywnej funkcji, o stałej wysokości dla tenantów. |
| Najwcześniejszy rzeczywisty stan | Przed `ac13738` informacje były rozproszone między header, transport, workspace i context panel. Dobrym punktem „przed” jest `5ab12d9` albo `71b7c66`. |
| Commit / zakres | `ac13738` (pierwsza pełna implementacja); `5f79dfa` (jedna wysokość i MIX bus na ekranie); dokument `docs/SYSTEM_DISPLAY.md`. |
| Sensowny etap pośredni | Nie. Kontrast rozproszone informacje → jeden display jest wystarczająco silny. |
| Czy potrzebna rekonstrukcja | Tak dla zwięzłego, kontrolowanego kadru „rozproszone komunikaty”, jeśli historyczny ekran jest zbyt gęsty. Musi być oznaczony `RECONSTRUCTED EARLY STATE`. |
| Materiały | Wąski ekran przed displayem; bieżący display zamknięty i otwarty z kontekstem SEQ/MIX. |
| Co pokazać | Jeden obszar zmienia treść, rośnie w miejscu i oszczędza przestrzeń. |
| Czego nie pokazywać | System Display jako czysto dekoracyjnego „świecącego ekranu”; aspekt estetyczny należy do przyszłego rozdziału designu. |
| Ryzyko pomieszania z designem | Bardzo wysokie. Narracja musi pozostać przestrzenna i funkcjonalna. |
| Rekomendowane stany | `EARLY` (`5ab12d9` lub rekonstrukcja), `CURRENT` (`20c8ee2`). |

### 12. Eksport utworu

| Pole | Ustalenie |
| --- | --- |
| Obecny stan | Offline render zajętego zakresu Playlist do pliku WAV. |
| Najwcześniejszy rzeczywisty stan | `735d392`. |
| Commit / zakres | `735d392`; decyzja w `docs/DECISIONS.md`; implementacja w `src/project/renderSong.ts` i `src/audio/wavEncoder.ts`. |
| Sensowny etap pośredni | Nie. |
| Czy potrzebna rekonstrukcja | Nie. |
| Materiały | Mały detal `RENDER SONG` i stan postępu/sukcesu; nie osobny duży rozdział. |
| Co pokazać | Zamknięcie ścieżki „sample → pad → pattern → song → WAV”. |
| Czego nie pokazywać | Eksportu stems, MP3, chmury ani funkcji, których nie ma. |
| Ryzyko pomieszania z designem | Niskie, jeśli kadr pozostaje detalem funkcjonalnym. |
| Rekomendowane stany | Tylko `CURRENT`, jako domknięcie sekcji SONG lub CURRENT BUILD. |

### 13. Najważniejsze elementy mobilnego workflow

| Pole | Ustalenie |
| --- | --- |
| Obecny stan | Responsywne workspace’y, touch targets, dwie ośmiokrokowe strony SEQ, 8-slot pages SONG i kontekstowe sterowanie w System Display. |
| Najwcześniejszy rzeczywisty stan | `a60afbc`: świadome rozszerzenie mobile sampler workflow. Wcześniejsze buildy miały responsywne media queries, ale nie były pełnym mobile UX. |
| Commit / zakres | `a60afbc`; `b90206e`; `dc14e7e`; `ff8d918`; `ac13738`; `5f79dfa`. |
| Sensowny etap pośredni | Tak: `dc14e7e` dla SEQ oraz `ff8d918` dla SONG. |
| Czy potrzebna rekonstrukcja | Tak tylko dla syntetycznego pokazania problemu 16 ściśniętych kroków. |
| Materiały | Telefon: SEQ przed/po, SONG page, System Display; tablet/wąski desktop: bieżący workflow. |
| Co pokazać | Konkretne decyzje przestrzenne, nie ogólną obietnicę „mobile first”. |
| Czego nie pokazywać | Nie twierdzić, że bieżący MVP ma pełną walidację mobilnych przeglądarek; dokumentacja nadal traktuje Chrome/Edge desktop jako wymagany zakres akceptacji. |
| Ryzyko pomieszania z designem | Wysokie, bo większość rozwiązań powstała podczas odświeżania UI. |
| Rekomendowane stany | Kadry mobilne w sekcjach SEQ, SONG i SYSTEM DISPLAY; bez osobnego rozdziału funkcji. |

## Rekomendowana macierz stanów

| Funkcja | EARLY | INTERMEDIATE | CURRENT |
| --- | --- | --- | --- |
| Pierwszy WAV | `550369f` — historical | — | finał całej historii, nie osobny kadr |
| Library + Pad | `ead3930` / `e8d92f5` — historical | `64f1e0b` — historical | `20c8ee2` |
| CHOP | `5307ea0` — historical | `c5c5f17` lub `3263d54` — historical | `20c8ee2` |
| SEQ | `07c4d7a` — historical | `dc14e7e` — historical; opcjonalny problem view reconstructed | `20c8ee2` |
| SONG | `3ab73a0` — historical | `71b7c66` — historical | `20c8ee2` |
| MIX | `dfbb888` — historical | `8aa9e92` — historical | `20c8ee2` |
| SYSTEM DISPLAY | `5ab12d9` historical lub uproszczone reconstructed | — | `20c8ee2` |
| CURRENT BUILD | — | — | `20c8ee2`, telefon / tablet / desktop |

## Wnioski audytu

1. Większość mocnych stanów EARLY istnieje naprawdę i nie wymaga fikcyjnej rekonstrukcji.
2. Rekonstrukcja jest uzasadniona przede wszystkim dla:
   - porównawczego mobilnego widoku SEQ z 16 ściśniętymi krokami;
   - uporządkowanego „przed” dla System Display;
   - ewentualnie wspólnego, jednorodnego kadru Library + Pad.
3. Autoslicing powinien być częścią rozdziału CHOP, a Pump częścią MIX.
4. Eksport WAV powinien zamknąć historię SONG lub CURRENT BUILD, nie tworzyć dziewiątego głównego rozdziału.
5. Trzy stany mają sens dla Library + Pad, CHOP, SEQ, SONG i MIX. Pierwszy WAV oraz System Display są mocniejsze w układzie dwóch punktów.
6. Wszystkie screenshoty `CURRENT BUILD` powinny powstać z czystego `20c8ee2`, nie z głównego katalogu z pracą w toku.
