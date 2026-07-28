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

### `chop_early_desktop.png`

Klasyfikacja: `RECONSTRUCTED EARLY STATE`.

Rekonstrukcja wizualnie cofa manualny CHOP do języka prototypu:

- systemowa typografia;
- neutralne szarości;
- zwykłe przyciski i input;
- prosty waveform;
- czerwone, techniczne markery;
- prosta lista slice’ów;
- podstawowa siatka padów.

Funkcjonalna podstawa jest prawdziwa: commit `5307ea0` zawiera waveform, ręczne slice’y i ich obsługę. Rekonstrukcja nie dodaje funkcji, których wtedy nie było; tylko porządkuje je w jeden kadr portfolio bez finalnego designu.

### `seq_early_mobile_reconstructed.png`

Klasyfikacja: `RECONSTRUCTED EARLY STATE`.

To kontrolowany ekran problemowy, nie rzekomy historyczny screenshot. Pokazuje pierwszą ideę `07c4d7a` — 16 kroków — ściśniętą na szerokości telefonu. Ma wyjaśnić powód powstania dwóch stron kroków.

Uproszczono:

- sekwencer do jednego rzędu;
- transport do Play + BPM;
- kontekst do jednego pada;
- brak finalnych powierzchni i modułów.

Uczciwość rekonstrukcji opiera się na tym, że:

- pierwszy sequencer faktycznie miał jeden rząd 16 kroków;
- późniejszy pre-split build `5ab12d9` faktycznie wymagał szerokiej matrycy;
- rozwiązanie `01–08 / 09–16` faktycznie weszło w `dc14e7e`.

### `system_display_early_mobile_reconstructed.png`

Klasyfikacja: `RECONSTRUCTED EARLY STATE`.

To kompozycja problemu, który jest opisany w `docs/SYSTEM_DISPLAY.md`: status audio, zmiana patternu, parametry kroku, parametry pada i błąd SONG pojawiają się w osobnych blokach.

Uproszczono:

- każdy typ komunikatu do jednej krótkiej linii;
- SEQ do ośmiu widocznych kroków;
- parametry do jednego suwaka na kontekst;
- całe UI do jednego wąskiego ekranu.

Rekonstrukcja jest uczciwa, ponieważ nie przypisuje Station nieistniejącej funkcji. Łączy w jednym kadrze rzeczywiste rodzaje informacji, które przed `ac13738` były renderowane w różnych częściach interfejsu.

## Elementy wizualnie cofnięte do starszego stylu

- waveform i markery CHOP;
- pola padów w manualnym CHOP;
- 16-step problem view;
- statusy i parametry w pre-display composite;
- typografia, tło, obramowania, przyciski, inputy i suwaki wszystkich rekonstrukcji.

## Czego świadomie nie rekonstruowano

- Library, ponieważ istnieje autentyczny build `ead3930`;
- pierwszy pad bank, ponieważ istnieje autentyczny build `e8d92f5`;
- pierwszy SEQ, ponieważ istnieje autentyczny build `07c4d7a`;
- pierwszy SONG, ponieważ istnieje autentyczny build `3ab73a0`;
- pierwszy MIX, ponieważ istnieje autentyczny build `dfbb888`;
- pionowe fadery, ponieważ istnieje autentyczny build `8aa9e92`;
- podział `01–08 / 09–16`, ponieważ istnieje autentyczny build `dc14e7e`;
- autoslicing, ponieważ istnieje autentyczny build `3263d54`;
- eksport WAV, ponieważ istnieje autentyczna funkcja z `735d392`.

## Granice materiału

- Rekonstrukcje nie używają Vinyl Dust, aktualnego chassis, finalnych świateł ani System Display.
- CURRENT BUILD nie został zmieniony funkcjonalnie.
- Nie przygotowano rozdziału o rozwoju designu.
- Nie dodano eksportu stems, resamplingu, scenes ani funkcji spoza istniejącego produktu.
- Mobilne kadry pokazują decyzje responsywne, ale nie są deklaracją zaliczenia pełnej macierzy testów mobilnych przeglądarek.

