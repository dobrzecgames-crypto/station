# Station — reconstruction notes

## Cel

Laboratorium pokazuje ewolucję możliwości Station bez przepisywania aktualnej aplikacji i bez sugerowania, że finalny język wizualny istniał od początku.

## Stany prawdziwe historycznie

Poniższe materiały uruchomiono bezpośrednio z kodu danego commita:

- `550369f` — pierwszy WAV i pojedynczy pad/przycisk odtwarzania;
- `e8d92f5` — pierwszy 16-pad bank;
- `07c4d7a` — pierwszy 16-step sequencer;
- `dfbb888` — pierwszy mikser z poziomymi suwakami;
- `5307ea0` — źródło funkcjonalne manualnego CHOP;
- `3ab73a0` — pierwsza Pattern Playlist / SONG;
- `ead3930` — pierwsza Library;
- `5ab12d9` — mobilny stan sprzed podziału SEQ i sprzed System Display;
- `3263d54` — Equal + Smart Auto Chop;
- `8aa9e92` — pionowe fader strips;
- `dc14e7e` — pierwszy rzeczywisty podział `01–08 / 09–16`;
- `20c8ee2` — CURRENT BUILD.

Historyczne screenshoty nie mają dopisanego nowego CSS ani danych wstrzykniętych do kodu. Tam, gdzie potrzebny był stan roboczy:

- prawdziwy WAV załadowano przez historyczny file input;
- test loop uruchomiono przez historyczny przycisk aplikacji;
- kroki SEQ i klipy SONG ustawiono przez istniejące historyczne kontrolki;
- bieżące próbki przypisano przez własny sample browser Station.

## Stany zrekonstruowane

### `chop_early_desktop.png` i `chop_early_mobile.png`

Klasyfikacja: `RECONSTRUCTED EARLY STATE`.

Oba kadry pokazują ten sam wczesny stan funkcjonalny; wariant mobilny układa
materiał pionowo bez dodawania nowych funkcji. Rekonstrukcja wizualnie cofa
manualny CHOP do języka prototypu:

- systemowa typografia;
- neutralne szarości;
- zwykłe przyciski i input;
- prosty waveform;
- czerwone, techniczne markery;
- prosta lista slice’ów;
- podstawowa siatka padów.

Funkcjonalna podstawa jest prawdziwa: commit `5307ea0` zawiera waveform, ręczne slice’y i ich obsługę. Rekonstrukcja nie dodaje funkcji, których wtedy nie było; tylko porządkuje je w jeden kadr portfolio bez finalnego designu.

### `seq_early_mobile_reconstructed.png` i `seq_early_mobile_clean.png`

Klasyfikacja: `RECONSTRUCTED EARLY STATE`.

To kontrolowane ekrany, nie rzekome historyczne screenshoty. Pokazują pierwszą ideę `07c4d7a` — 16 kroków — ściśniętą na szerokości telefonu. Wariant `clean` usuwa opisową ramkę problemu i zachowuje wyłącznie sam wczesny interfejs.

Uproszczono:

- sekwencer do jednego rzędu;
- transport do Play + BPM;
- kontekst do jednego pada;
- brak finalnych powierzchni i modułów.

Uczciwość rekonstrukcji opiera się na tym, że:

- pierwszy sequencer faktycznie miał jeden rząd 16 kroków;
- późniejszy pre-split build `5ab12d9` faktycznie wymagał szerokiej matrycy;
- rozwiązanie `01–08 / 09–16` faktycznie weszło w `dc14e7e`.

### `system_display_early_mobile.png` (scena `system-scattered`)

Klasyfikacja: `RECONSTRUCTED EARLY STATE`.

To kompozycja problemu, który jest opisany w `docs/SYSTEM_DISPLAY.md`: status audio, zmiana patternu, parametry kroku, parametry pada i błąd SONG pojawiają się w osobnych blokach.

Uproszczono:

- każdy typ komunikatu do jednej krótkiej linii;
- SEQ do ośmiu widocznych kroków;
- parametry do jednego suwaka na kontekst;
- całe UI do jednego wąskiego ekranu.

Rekonstrukcja jest uczciwa, ponieważ nie przypisuje Station nieistniejącej funkcji. Łączy w jednym kadrze rzeczywiste rodzaje informacji, które przed `ac13738` były renderowane w różnych częściach interfejsu.

Ten plik zastąpił 2026-07-29 wcześniejszy, autentyczny zrzut mobilny `5ab12d9` — patrz sekcja „Zmiana zasady” niżej.

### `library_pad_early_mobile.png`, `song_early_mobile.png`, `mix_early_mobile.png` (sceny `library-pad-early`, `song-early`, `mix-early`)

Klasyfikacja: `RECONSTRUCTED EARLY STATE`.

Dane są autentyczne (te same wartości i stany, które faktycznie prezentują komity `e8d92f5`, `3ab73a0`, `dfbb888`), ale chrome wizualny jest celowo cofnięty do języka prototypu `portfolio-lab` — bez ciemnego tła i pomarańczowego akcentu Station, bez zaokrągleń, systemowa typografia.

- `library-pad-early`: szesnaście padów, `kick-01.wav` wgrany na PAD 01 (identyczny mechanizm co w otwierającym WAV), reszta pusta.
- `song-early`: tabela pattern/slot, klipy `1A` w slotach 1, 2, 3, 5, 6, 8 — te same sloty, które ustawiono w autentycznym buildzie `3ab73a0`.
- `mix-early`: cztery identyczne karty kanałów (VOL/MUTE/SOLO), wszystkie puste, zgodnie z domyślnym stanem `dfbb888`.

### `seq_early_mobile_clean.png` (scena `seq-problem`, zaktualizowana 2026-07-29)

Wcześniejsza wersja tej sceny mieściła wszystkie 16 kroków w jednym, ciasnym rzędzie — co nie oddawało realnego problemu. Zaktualizowano do rzędu przycisków o stałej szerokości (46px), szerszego niż ekran, z kontenerem przewiniętym programowo w połowie (krok 6 przycięty, widoczne kroki ok. 7–12) oraz doklejonym, celowo prymitywnym paskiem przewijania pod spodem (prawdziwy scrollbar Chromium jest przezroczystą nakładką, niewidoczną w spoczynku na statycznym zrzucie, więc pasek jest narysowany jako zwykły `div`, nie prawdziwy scrollbar).

## Elementy wizualnie cofnięte do starszego stylu

- waveform i markery CHOP;
- pola padów w manualnym CHOP;
- 16-step problem view;
- statusy i parametry w pre-display composite;
- typografia, tło, obramowania, przyciski, inputy i suwaki wszystkich rekonstrukcji.

## Zmiana zasady (2026-07-29)

Pierwotna zasada brzmiała: „nie rekonstruuj, jeśli istnieje autentyczny build” — patrz commity z Library, pierwszego pad banku, SEQ, SONG i MIX niżej w tym dokumencie w wersji sprzed tej daty. Zasada okazała się niewystarczająca: Station miało ciemny/pomarańczowy branding od bardzo wczesnych commitów, więc nawet autentyczne, mobilne zrzuty tych wczesnych stanów wyglądają zbyt dopracowanie na tle narracji „zaczęliśmy ubogo, doszliśmy do jednego instrumentu”. Nowa zasada: o tym, czy dany `EARLY` kadr w case-study jest rekonstrukcją czy autentycznym zrzutem, decyduje wyłącznie to, czy wygląda odpowiednio prymitywnie — nie to, czy autentyczny build istnieje.

W efekcie zrekonstruowano również (mimo istniejących autentycznych buildów): pierwszy pad bank (`e8d92f5`), pierwszy SEQ (`07c4d7a`), pierwszy SONG (`3ab73a0`) i pierwszy MIX (`dfbb888`) — patrz sekcja „Stany zrekonstruowane” wyżej.

## Czego nadal świadomie nie rekonstruowano

- Library jako osobny stan (`ead3930`) — LIBRARY i PAD są w case-study jednym rozdziałem pokazującym tylko wczesny PAD;
- pionowe fadery, ponieważ nie są obecnie użyte w case-study (tylko EARLY i CURRENT na funkcję, bez stanu INTERMEDIATE);
- podział `01–08 / 09–16`, ponieważ nie jest obecnie użyty w case-study jako osobny kadr (opisany w tekście, nie w drugim obrazku);
- autoslicing, z tego samego powodu co wyżej;
- eksport WAV, ponieważ istnieje autentyczna funkcja z `735d392`, a case-study nie pokazuje obecnie osobnego kadru renderu WAV.

## Granice materiału

- Rekonstrukcje nie używają Vinyl Dust, aktualnego chassis, finalnych świateł ani System Display.
- CURRENT BUILD nie został zmieniony funkcjonalnie.
- Nie przygotowano rozdziału o rozwoju designu.
- Nie dodano eksportu stems, resamplingu, scenes ani funkcji spoza istniejącego produktu.
- Mobilne kadry pokazują decyzje responsywne, ale nie są deklaracją zaliczenia pełnej macierzy testów mobilnych przeglądarek.

