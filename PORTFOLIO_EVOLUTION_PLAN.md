# Station — plan prezentacji ewolucji funkcji

Data planu: 2026-07-28  
Zakres: wyłącznie rozdział „Rozwój funkcji”  
Poza zakresem: projektowanie finalnej strony portfolio i osobny rozdział „Rozwój designu”

## Reguła montażowa

Każda sekcja ma odpowiadać na jedno pytanie i używać maksymalnie trzech stanów. Screenshot nie jest dekoracją: ma pokazywać konkretną zmianę workflow.

Stała kolejność:

1. Pierwszy WAV
2. LIBRARY + PAD
3. CHOP
4. SEQ
5. SONG
6. MIX
7. SYSTEM DISPLAY
8. CURRENT BUILD

## 1. Pierwszy WAV

### Screenshoty

- `wav_early_desktop.png`
  - stan: `EARLY`
  - źródło: `HISTORICAL BUILD`
  - commit: `550369f`
  - viewport: desktop, ciasny kadr aplikacji

### Kontrast

Jeden plik i jeden przycisk kontra pełny instrument pokazany dopiero w finale.

### Co widz ma zrozumieć

Station zaczęło od testu najbardziej podstawowego ryzyka: czy przeglądarka może stabilnie wczytać i zagrać WAV po świadomym uruchomieniu audio.

### Czego nie tłumaczyć szeroko

Web Audio lifecycle, szczegółów `AudioContext`, architektury silnika ani testów edge case’ów.

### Decyzja o stanach

Tylko `EARLY`. Nie rozcieńczać najmocniejszego punktu startowego etapem pośrednim.

## 2. LIBRARY + PAD

### Screenshoty

- `library_pad_early_desktop.png`
  - stan: `EARLY`
  - źródło: `HISTORICAL BUILD`
  - commit: najlepiej `ead3930` dla Library; kadr z `e8d92f5` może uzupełnić pierwszy bank padów
- `library_pad_intermediate_mobile.png`
  - stan: `INTERMEDIATE`
  - źródło: `HISTORICAL BUILD`
  - commit: `64f1e0b`
- `library_pad_current_desktop.png`
  - stan: `CURRENT`
  - źródło: `CURRENT BUILD`
  - commit: `20c8ee2`

### Kontrast

Surowa lista i techniczne przypisanie → browse-and-tap → spójny workflow wyboru i gry.

### Co widz ma zrozumieć

Dźwięk przestaje być plikiem. Trafia pod palce i od razu staje się materiałem do grania.

### Czego nie tłumaczyć szeroko

Kategorii assetów, persistence, mapowania skali i parametrów obwiedni.

### Decyzja o stanach

Użyć trzech stanów tylko wtedy, gdy `64f1e0b` wizualnie jasno pokazuje uproszczenie przypisania. W przeciwnym razie zostawić `EARLY + CURRENT`.

## 3. CHOP

### Screenshoty

- `chop_early_desktop.png`
  - stan: `EARLY`
  - źródło: `HISTORICAL BUILD`
  - commit: `5307ea0`
- `chop_intermediate_desktop.png`
  - stan: `INTERMEDIATE`
  - źródło: `HISTORICAL BUILD`
  - commit: `3263d54`
- `chop_current_mobile.png`
  - stan: `CURRENT`
  - źródło: `CURRENT BUILD`
  - commit: `20c8ee2`

### Kontrast

Ręczne dodawanie markerów → automatyczne wykrycie kandydatów transientów → pełny Unified Chop Workspace.

### Co widz ma zrozumieć

Manualne cięcie nadal istnieje; autoslicing skraca powtarzalną pracę i szybciej przenosi slice’y na pady.

### Czego nie tłumaczyć szeroko

Algorytmu detekcji, ograniczeń rozdzielczości peaks, równych cięć jako osobnej funkcji oraz źródłowego pitchu.

### Decyzja o stanach

Trzy stany są uzasadnione, bo każdy zmienia workflow. Jeżeli kadr `3263d54` okaże się wizualnie zbyt podobny do CURRENT, użyć zamiast niego `c5c5f17` i opowiedzieć rozwój „editor → workspace → current”.

## 4. SEQ

### Screenshoty

- `seq_early_desktop.png`
  - stan: `EARLY`
  - źródło: `HISTORICAL BUILD`
  - commit: `07c4d7a`
- `seq_early_mobile.png`
  - stan: `EARLY / PROBLEM`
  - źródło: `RECONSTRUCTED EARLY STATE`
  - commit: nie dotyczy; rekonstrukcja na podstawie pierwszego 16-step layoutu
- `seq_intermediate_mobile.png`
  - stan: `INTERMEDIATE`
  - źródło: `HISTORICAL BUILD`
  - commit: `dc14e7e`
- `seq_current_desktop.png`
  - stan: `CURRENT`
  - źródło: `CURRENT BUILD`
  - commit: `20c8ee2`

### Kontrast

Jeden rząd 16 kroków → zbyt ciasne 16 kroków na telefonie → jawny podział `01–08 / 09–16` → bieżąca matryca wielu padów.

### Co widz ma zrozumieć

Rozwiązanie mobilne nie polegało na zmniejszaniu wszystkiego ani poziomym scrollu, lecz na podziale tej samej 16-krokowej struktury na dwie czytelne strony.

### Czego nie tłumaczyć szeroko

Look-ahead schedulera, velocity, shift, Pattern Group banks ani wariantów A–D.

### Decyzja o stanach

W głównym montażu użyć maksymalnie trzech obrazów: `EARLY DESKTOP`, dwukadrowy kontrast mobile, `CURRENT DESKTOP`. Mobile „problem” i „solution” mogą być jedną kompozycją.

## 5. SONG

### Screenshoty

- `song_early_desktop.png`
  - stan: `EARLY`
  - źródło: `HISTORICAL BUILD`
  - commit: `3ab73a0`
- `song_intermediate_desktop.png`
  - stan: `INTERMEDIATE`
  - źródło: `HISTORICAL BUILD`
  - commit: `71b7c66`
- `song_current_desktop.png`
  - stan: `CURRENT`
  - źródło: `CURRENT BUILD`
  - commit: `20c8ee2`
- `song_current_render_detail.png`
  - stan: `CURRENT`
  - źródło: `CURRENT BUILD`
  - commit funkcji: `735d392`

### Kontrast

Prosta kolejność pattern clips → lanes pokazujące równoległość i strukturę → bieżąca aranżacja z możliwością renderu WAV.

### Co widz ma zrozumieć

Krótkie patterny dostały początek, rozwinięcie i zakończenie bez zamieniania Station w DAW z nieskończonym timeline’em.

### Czego nie tłumaczyć szeroko

Modelu referencji do wariantów, migracji persistence i szczegółów offline renderingu.

### Decyzja o stanach

Trzy główne stany. Detal `RENDER SONG` ma być końcową adnotacją, nie czwartym pełnym ekranem.

## 6. MIX

### Screenshoty

- `mix_early_desktop.png`
  - stan: `EARLY`
  - źródło: `HISTORICAL BUILD`
  - commit: `dfbb888`
- `mix_intermediate_desktop.png`
  - stan: `INTERMEDIATE`
  - źródło: `HISTORICAL BUILD`
  - commit: `8aa9e92`
- `mix_current_desktop.png`
  - stan: `CURRENT`
  - źródło: `CURRENT BUILD`
  - commit: `20c8ee2`
- `mix_current_pump_detail.png`
  - stan: `CURRENT`
  - źródło: `CURRENT BUILD`
  - funkcja źródłowa: `98b7649`, obecny routing: `20c8ee2`

### Kontrast

Karty kanałów z prostymi poziomymi sliderami → pionowe fader strips → pełny MIX z meteringiem, busami i Pump.

### Co widz ma zrozumieć

Station zyskało kontrolę proporcji, ruchu i charakteru. Pump jest muzycznym sidechainem oraz częścią tożsamości brzmienia, nie osobnym technicznym wykładem.

### Czego nie tłumaczyć szeroko

Pełnego FX Racka, topologii busów, kompresora, delay i EQ.

### Decyzja o stanach

Trzy stany są wizualnie wyraźne i uzasadnione. Pump pokazać w detalu bieżącego ekranu.

## 7. SYSTEM DISPLAY

### Screenshoty

- `system_display_early_mobile.png`
  - stan: `EARLY`
  - źródło: preferowany `HISTORICAL BUILD`
  - commit: `5ab12d9` albo `71b7c66`
  - fallback: `RECONSTRUCTED EARLY STATE`, jeśli autentyczny ekran nie czyta się bez długiego opisu
- `system_display_current_mobile.png`
  - stan: `CURRENT`
  - źródło: `CURRENT BUILD`
  - commit: `20c8ee2`
- `system_display_current_open_mobile.png`
  - stan: `CURRENT`
  - źródło: `CURRENT BUILD`
  - commit implementacji bazowej: `ac13738`

### Kontrast

Komunikaty i parametry rozproszone między transportem, workspace’em i panelami → jeden obszar, który zmienia właściciela i rośnie w tym samym miejscu.

### Co widz ma zrozumieć

To rozwiązanie problemu przestrzeni i kontekstu, szczególnie na wąskim ekranie.

### Czego nie tłumaczyć szeroko

Kanałów priority, API tenantów, detali `claim/release` ani świetlnej estetyki ekranu. Wygląd System Display jako element design language należy do przyszłego rozdziału.

### Decyzja o stanach

Tylko `EARLY + CURRENT`. Dwa bieżące kadry mogą pokazać ekran zamknięty i otwarty, ale są jednym stanem funkcjonalnym.

## 8. CURRENT BUILD

### Screenshoty

- `current_phone.png`
  - `CURRENT BUILD`
  - commit: `20c8ee2`
  - rekomendowany viewport: `390 × 844`
- `current_tablet.png`
  - `CURRENT BUILD`
  - commit: `20c8ee2`
  - rekomendowany viewport: `768 × 1024`
- `current_desktop.png`
  - `CURRENT BUILD`
  - commit: `20c8ee2`
  - rekomendowany viewport: `1440 × 1000`

### Kontrast

Wszystkie wcześniejsze surowe, osobne funkcje zbiegają się w jeden instrument.

### Co widz ma zrozumieć

Station prowadzi pełną lokalną ścieżkę:

`sample → pad → pattern → pump/mix → song → saved/rendered musical sketch`

### Czego nie tłumaczyć szeroko

Nie analizować tutaj Vinyl Dust, chassis, światła, powierzchni i głębi. To wyłącznie punkt końcowy rozwoju możliwości. Design zostanie opowiedziany osobno.

### Decyzja o stanach

Wyłącznie `CURRENT`. Nie wprowadzać żadnych funkcjonalnych zmian na potrzeby portfolio.

## Minimalny zestaw finalny

Jeżeli pełna pula okaże się za długa, zachować te 15 kluczowych obrazów:

1. `wav_early_desktop.png`
2. `library_pad_early_desktop.png`
3. `library_pad_current_desktop.png`
4. `chop_early_desktop.png`
5. `chop_intermediate_desktop.png`
6. `chop_current_mobile.png`
7. `seq_early_desktop.png`
8. wspólna kompozycja `seq_early_mobile.png` + `seq_intermediate_mobile.png`
9. `seq_current_desktop.png`
10. `song_early_desktop.png`
11. `song_current_desktop.png`
12. `mix_early_desktop.png`
13. `mix_current_desktop.png`
14. wspólna kompozycja `system_display_early_mobile.png` + `system_display_current_open_mobile.png`
15. trzy rozmiary `CURRENT BUILD` jako jeden finał responsywny

## Kolejność dalszej pracy

1. Utworzyć strukturę `portfolio-assets/evolution/`.
2. Przygotować clean historical builds albo bezpieczne statyczne rekonstrukcje na podstawie konkretnych commitów.
3. Najpierw wykonać autentyczne screenshoty historyczne.
4. Dopiero potem tworzyć brakujące rekonstrukcje.
5. Każdy plik natychmiast dopisać do `SCREENSHOT_INDEX.md`.
6. Zapisać wszystkie decyzje o uproszczeniach w `RECONSTRUCTION_NOTES.md`.
7. Wykonać screenshoty `CURRENT BUILD` z czystego `20c8ee2`.
8. Zweryfikować, że żaden EARLY nie używa Vinyl Dust ani bieżącego chassis.

