# Station — UI/UX Reorganization for Contextual Workflow

## Status dokumentu

- Typ: specyfikacja implementacyjna dla Codexa
- Projekt: Station
- Repozytorium: `https://github.com/dobrzecgames-crypto/station`
- Branch: `main`
- Punkt odniesienia: commit `4710086 feat: add pattern group FX racks`
- Platforma docelowa: desktop browser
- Priorytet: Chrome / Edge / Windows / laptop 1366×768 i większy
- Zakres: reorganizacja interfejsu i workflow
- Poza zakresem: zmiany DSP, routingu audio, persistence, modeli projektowych i funkcjonalności efektów

---

# 1. Cel

Celem jest uporządkowanie interfejsu Station tak, aby aplikacja pozostała zwartym grooveboxem i samplerem działającym w przeglądarce.

Aktualnie funkcje są technicznie poprawne, ale widok `MIX` oraz kolejne sekcje UI zaczynają tworzyć długi pionowy dokument. Wraz z rozwojem Pattern Groups, Mixer, Pump i FX Racków prowadzi to do:

- nadmiernego scrolla;
- jednoczesnego pokazywania zbyt wielu poziomów kontekstu;
- trudnego przechodzenia między grupą, kanałami, FX i masterem;
- utraty charakteru samodzielnego urządzenia;
- ryzyka zamiany Station w klasyczny DAW.

Docelowy system powinien opierać się na:

1. pięciu głównych workspace’ach;
2. stałym kontekście Pattern Group i Variant;
3. jednym wspólnym dolnym panelu kontekstowym;
4. lokalnym scrollu zamiast scrolla całej aplikacji;
5. stopniowym wdrożeniu bez przebudowy audio engine.

---

# 2. Najważniejsze ograniczenia

Nie zmieniać:

- AudioEngine;
- kolejności routingu audio;
- Compressor DSP;
- Delay DSP;
- Pump DSP;
- modelu dwóch FX slotów;
- modelu danych Pattern Groups;
- Pattern variants A–D;
- Playlist;
- persistence;
- migracji schema;
- działania Save/Open;
- działania CHOP;
- logiki Sequencera;
- wartości domyślnych efektów.

Nie dodawać:

- efektów per pad;
- send/return;
- automatyzacji;
- plugin browsera;
- popupów pluginowych;
- drag-and-drop routingu;
- kabli;
- resize’owalnych i dokowanych paneli;
- nieskończonego timeline;
- nowych efektów;
- kompletnego mobile UI.

Ta zmiana dotyczy przede wszystkim sposobu prezentacji istniejących funkcji.

---

# 3. Obecny problem strukturalny

Aktualny widok `MIX` zawiera jednocześnie:

- busy wszystkich Pattern Groups;
- master bus;
- Pump;
- mixer kanałów wybranej grupy;
- Group FX Rack;
- Master FX Rack.

Parametry Compressor i Delay są renderowane inline w kartach slotów. Gdy oba sloty grupy i oba sloty mastera są aktywne, interfejs rozszerza się pionowo i wymusza długi scroll.

Dodatkowo:

- Pattern Group jest głównym kontekstem danych, ale jej selektor jest mocno związany z Sequencerem;
- Variant A–D nie jest stale widoczny;
- `SAMPLE` jest osobnym globalnym widokiem mimo że jest edycją wybranego pada;
- `ProjectKeyPanel` jest stale renderowany mimo że nie jest potrzebny w codziennym workflow;
- `NONE` jest prezentowane jak efekt, choć jest tylko pustym stanem slotu;
- Mixer miesza trzy poziomy:
  - wszystkie grupy;
  - wybraną grupę;
  - master.

---

# 4. Docelowa architektura UI

## 4.1. Główne workspace’y

Docelowa główna nawigacja:

```text
CHOP
PADS
SEQ
SONG
MIX
```

Usunąć `SAMPLE` z głównej nawigacji.

Sample Editor ma pozostać funkcjonalnie dostępny, ale otwierany kontekstowo z wybranego pada.

Nie zmieniać jeszcze nazw pozostałych workspace’ów na abstrakcyjne typu MAKE lub PERFORM.

---

## 4.2. Stały układ aplikacji

Docelowa struktura:

```text
┌─────────────────────────────────────────────────────────────┐
│ GLOBAL HEADER                                               │
│ STATION | CHOP PADS SEQ SONG MIX | AUDIO | PROJECT         │
├─────────────────────────────────────────────────────────────┤
│ MUSIC CONTEXT BAR                                           │
│ PLAY STOP | BPM | MODE | GROUP | VARIANT                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ CURRENT WORKSPACE                                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ CONTEXT PANEL                                               │
│ selected pad / step / channel / Pump / FX / master         │
└─────────────────────────────────────────────────────────────┘
```

Cała aplikacja powinna działać jako workspace ograniczony do viewportu.

Nie projektować głównego layoutu jako długiej strony dokumentu.

---

# 5. Global Header

Global Header powinien zawierać:

- logo `STATION`;
- główną nawigację;
- kompaktowy status audio;
- Project menu.

## 5.1. Audio status

Zastąpić duży tekstowy blok prostszym statusem:

```text
● AUDIO READY
```

lub:

```text
START AUDIO
```

Nie zmieniać logiki inicjalizacji AudioContext.

## 5.2. Project menu

Zamiast stale widocznych dużych przycisków:

```text
SAVE PROJECT
OPEN PROJECT
```

zastosować kompaktowy przycisk:

```text
PROJECT
```

Po kliknięciu pokazać małe menu:

```text
SAVE PROJECT
OPEN PROJECT
PROJECT KEY
```

Menu nie powinno być pluginowym popupem. Może być prostym popoverem zamykanym po kliknięciu poza nim albo po Escape.

Jeżeli wdrożenie Project menu byłoby zbyt szeroką zmianą na pierwszy etap, można tymczasowo pozostawić Save/Open, ale przygotować strukturę CSS pod późniejsze skompresowanie.

---

# 6. Music Context Bar

Pasek powinien być stale widoczny bez względu na workspace.

Powinien zawierać:

- Play;
- Stop;
- BPM;
- transport mode: Pattern / Song;
- Pattern Group selector;
- Pattern Variant A–D;
- opcjonalnie Swing jako kontrolkę kompaktową lub rozwijaną.

## 6.1. Pattern Group selector

Pattern Group jest globalnym kontekstem bieżącej pracy.

Minimalna forma:

```text
<  GROUP 1  >
```

Dodatkowo przycisk menu grupy:

```text
•••
```

Opcje:

```text
NEW GROUP
DELETE GROUP
```

Nie renderować od razu ośmiu dużych przycisków grup.

Zmiana grupy musi aktualizować kontekst:

- CHOP;
- PADS;
- SEQ;
- MIX;
- Group FX.

Nie zmieniać danych innych grup.

## 6.2. Variant selector

Pokazywać stale:

```text
A  B  C  D
```

Wybrany wariant musi być czytelnie zaznaczony.

Należy zachować obecną logikę istnienia lub braku wariantu.

Nie tworzyć automatycznie brakującego wariantu bez istniejącego workflow Duplicate.

## 6.3. Zarządzanie wariantami

Operacje:

- duplicate;
- clear;
- create missing variant;
- delete group;

nie powinny zajmować stale dużej przestrzeni nad Sequencerem.

Przenieść je do kompaktowego menu kontekstowego grupy lub wariantu.

Nie zmieniać potwierdzeń dotyczących nadpisania i usuwania Playlist clips.

---

# 7. Dolny panel kontekstowy

Wprowadzić jeden wspólny komponent, np.:

```text
ContextPanel
```

Panel ma mieć trzy stany:

```text
closed
compact
expanded
```

Sugerowane wysokości:

- `closed`: 0 px;
- `compact`: około 72–96 px;
- `expanded`: około 220–280 px.

Nie dodawać ręcznego resize.

## 7.1. Zasady

Panel pokazuje tylko jeden aktywny kontekst.

Obsługiwane konteksty docelowo:

```text
pad
sample
step
channel
pump
group-fx-slot
master-fx-slot
group-bus
master
```

W pierwszym etapie obowiązkowo obsłużyć:

```text
group-fx-slot
master-fx-slot
```

Pozostałe konteksty można migrować etapami.

## 7.2. Nagłówek panelu

Nagłówek musi jasno wskazywać zakres zmian.

Przykład:

```text
GROUP 1 / FX SLOT 1
COMPRESSOR
```

lub:

```text
MASTER / FX SLOT 2
DELAY
```

Nagłówek powinien zawierać:

- nazwę scope;
- numer slotu;
- nazwę efektu;
- przycisk zamknięcia;
- status ON / BYPASS.

## 7.3. Zachowanie panelu

- kliknięcie FX slotu otwiera panel;
- kliknięcie innego FX slotu zmienia zawartość bez zamykania;
- kliknięcie zamknięcia wraca do `closed`;
- zmiana Pattern Group przy otwartym group FX panelu powinna przełączyć panel na ten sam numer slotu nowej grupy;
- jeżeli nowa grupa ma pusty slot, panel pokazuje chooser `ADD EFFECT`;
- przejście do innego głównego workspace może zamykać panel, chyba że dany kontekst ma sens również tam;
- na pierwszym etapie można zamykać panel przy każdej zmianie głównego workspace.

---

# 8. FX Rack — nowy UX

## 8.1. Karty slotów

Nie renderować pełnych parametrów efektu inline.

Każdy rack pokazuje tylko dwie kompaktowe karty:

```text
INPUT → FX 1 → FX 2 → OUTPUT
```

Przykład aktywnego slotu:

```text
FX 1
COMPRESSOR
ON
```

Przykład bypass:

```text
FX 1
COMPRESSOR
BYPASS
```

Przykład pustego slotu:

```text
FX 2
+ ADD EFFECT
```

## 8.2. NONE

W modelu danych zachować:

```text
type: 'none'
```

W UI nie pokazywać `NONE` jako równorzędnego efektu.

Zamiast tego:

```text
EMPTY
+ ADD EFFECT
```

## 8.3. Add Effect

Kliknięcie pustego slotu otwiera w Context Panel:

```text
GROUP 1 / FX SLOT 2

ADD EFFECT

COMPRESSOR
DELAY
```

Nie dodawać wyszukiwarki ani browsera efektów.

## 8.4. Parametry Compressor

Po wybraniu Compressor pokazać:

- Enabled / Bypass;
- Threshold;
- Ratio;
- Attack;
- Release;
- Replace;
- Remove.

Nie zmieniać zakresów parametrów.

## 8.5. Parametry Delay

Po wybraniu Delay pokazać:

- Enabled / Bypass;
- Sync;
- Division;
- Time;
- Feedback;
- Mix;
- Replace;
- Remove.

Nie zmieniać zakresów parametrów ani wyliczania BPM sync.

## 8.6. Replace

`REPLACE` otwiera chooser:

```text
COMPRESSOR
DELAY
```

Nie wymaga drag-and-drop.

Nie zmieniać zasady zachowywania poprzednich ustawień danego typu w stanie slotu.

## 8.7. Remove

`REMOVE` ustawia slot na:

```text
type: 'none'
```

Może zachować wewnętrzne konfiguracje Compressor i Delay zgodnie z obecnym modelem danych.

## 8.8. Bypass vs Empty

Te stany muszą być wyraźnie inne:

```text
EMPTY
```

brak efektu.

```text
COMPRESSOR / BYPASS
```

efekt istnieje, parametry są zachowane, ale DSP jest wyłączone.

---

# 9. MIX Workspace

## 9.1. Główna odpowiedzialność

MIX ma służyć przede wszystkim do miksowania aktualnej Pattern Group i przechodzenia do Group Bus, Group FX i Master.

Nie powinien jednocześnie wyświetlać wszystkich pełnych parametrów wszystkich poziomów routingu.

## 9.2. Group strip

Zamiast dużej siatki kart wszystkich Pattern Groups zastosować kompaktowy pasek:

```text
G1   G2   G3   G4   MASTER
```

Każda pozycja może pokazywać:

- nazwę;
- mini status mute/solo;
- ewentualnie kompaktowy volume;
- selected state.

Kliknięcie grupy zmienia globalny `selectedPatternGroupId`.

Nie tworzyć osobnego lokalnego selektora grupy niezależnego od globalnego context bar.

## 9.3. Selected Group Bus

Pokazać kompaktowo:

```text
GROUP 1 BUS
VOL
MUTE
SOLO
FX 1
FX 2
```

Kliknięcie FX slotu otwiera Context Panel.

## 9.4. Master

Pokazać kompaktowo:

```text
MASTER
VOL
MUTE
FX 1
FX 2
```

Master może być wizualnie oddzielony po prawej stronie lub w osobnym stałym bloku, ale nie jako pełna dodatkowa długa sekcja.

Kliknięcie Master FX otwiera Context Panel.

## 9.5. Channel Mixer

Pozostawić kanały aktualnej Pattern Group.

Nie dodawać efektów per pad.

Channel Mixer może posiadać lokalny scroll, gdy wysokość viewportu jest mała.

## 9.6. Pump

Na pierwszym etapie można pozostawić obecny panel Pump, ale nie powinien znajdować się pomiędzy group buses i channel mixerem jako pełna duża sekcja.

Preferowany docelowy model:

- wybrany channel posiada mały przycisk lub badge `PUMP`;
- kliknięcie otwiera Pump w Context Panel.

Nie zmieniać routingu Pump.

---

# 10. PADS i Sample Editor

## 10.1. Główny workspace PADS

`PAD` zmienić wizualnie na `PADS`.

Workspace zawiera:

- 16-pad grid;
- podstawowe informacje o zaznaczonym padzie;
- szybkie Import / Clear;
- przycisk `EDIT SAMPLE`.

## 10.2. Sample Editor

Usunąć `SAMPLE` z głównego MainNavigation.

Kliknięcie `EDIT SAMPLE`:

- otwiera rozszerzony Context Panel;
- pokazuje waveform;
- region controls;
- Preview;
- Reset.

Alternatywnie, jeśli pełny waveform nie mieści się sensownie w panelu 280 px, można użyć kontekstowego expanded workspace overlay wewnątrz Station, ale nie nowego popup window.

Nie zmieniać logiki SampleEditor.

---

# 11. SEQ Workspace

Sequencer powinien zachować:

- 16-step matrix;
- selected pad;
- step velocity;
- step shift;
- preview pada.

Przenieść do stałego context bar:

- Pattern Group selector;
- Variant A–D.

Usunąć z głównej powierzchni Sequencera:

- duże Prev / Next;
- New Pattern;
- Duplicate A to B/C/D;
- Clear;
- Delete Group.

Te operacje powinny być dostępne w kompaktowych menu Group / Variant.

W pierwszym etapie dopuszczalne jest pozostawienie istniejących przycisków do czasu wdrożenia menu, ale nie duplikować równolegle dwóch pełnych zestawów sterowania.

Selected step editor może pozostać inline na dole Sequencera lub zostać później przeniesiony do Context Panel.

Nie przenosić go obowiązkowo w pierwszym etapie.

---

# 12. SONG Workspace

Nie budować pełnego DAW timeline.

Playlist ma pozostać prostym układaniem Pattern Clips.

Interfejs musi jasno pokazywać hierarchię:

```text
GROUP
→ VARIANT
→ CLIP
→ PLAYLIST
```

Clip powinien mieć czytelną nazwę, np.:

```text
G1-A
G2-C
```

lub:

```text
GROUP 1 / A
```

Nie zmieniać logiki Playlist podczas pierwszego etapu UI.

---

# 13. Project Key

`ProjectKeyPanel` nie powinien być stale renderowany pod TransportBar.

Przenieść dostęp do Project Key do:

- Project menu;
- albo kontekstowego panelu mapowania skali.

Nie zmieniać logiki mapowania ani wartości domyślnej.

Jeżeli przeniesienie Project Key zwiększy zakres pierwszego wdrożenia, można pozostawić go tymczasowo, ale przygotować osobny mały commit później.

---

# 14. Scroll i viewport

## 14.1. Główna zasada

Główna strona dokumentu nie powinna mieć kilometrowego scrolla.

Preferowana struktura CSS:

```text
station-shell
  height: 100dvh
  overflow: hidden
```

Wewnątrz:

```text
header
context-bar
workspace
context-panel
```

`workspace` powinien używać:

```text
min-height: 0
overflow: auto
```

Tylko wewnętrzne obszary mogą się przewijać.

## 14.2. Sticky / fixed

Header i Music Context Bar powinny pozostać widoczne.

Nie używać wielu niezależnych `position: fixed`, jeśli powodowałoby to nakładanie i problemy z wysokością.

Preferować layout grid lub flex oparty o pełną wysokość viewportu.

## 14.3. Minimalna wysokość

Projektować dla wysokości 768 px.

Przy mniejszej wysokości:

- Context Panel może przejść z expanded do compact;
- workspace może scrollować lokalnie;
- transport nie może znikać.

---

# 15. Animacje

Animacje mają wyjaśniać zmianę kontekstu, a nie dekorować.

## 15.1. Context Panel

- open/close: 120–160 ms;
- slide od dołu;
- subtelny fade;
- respect `prefers-reduced-motion`.

## 15.2. Main workspace

Opcjonalny fade:

```text
80–120 ms
```

Nie stosować długiego przesuwania całych ekranów.

## 15.3. Bez animacji

Nie animować:

- Play/Stop;
- pad trigger;
- step toggle;
- mute/solo;
- suwaków;
- waveform;
- wartości parametrów;
- zmian BPM;
- statusów audio wymagających natychmiastowej reakcji.

---

# 16. Etapowanie implementacji

Nie wykonywać całej reorganizacji jako jednego ogromnego refactoru.

## Etap 1 — wspólny Context Panel dla FX

Zakres:

- dodać `ContextPanel`;
- zmienić `EffectRackPanel` w kompaktowy rack;
- przenieść parametry Group FX do Context Panel;
- przenieść parametry Master FX do Context Panel;
- zachować wszystkie obecne funkcje i stan;
- usunąć pełne rozwijanie parametrów inline;
- rozróżnić Empty i Bypass;
- zachować dwa serial slots;
- sprawdzić zmianę grupy przy otwartym panelu;
- sprawdzić zmianę BPM dla Delay.

To jest pierwszy wymagany etap.

## Etap 2 — globalny Group / Variant context

Zakres:

- dodać Pattern Group selector do stałego paska;
- dodać Variant A–D do stałego paska;
- usunąć ich zależność od samego Sequencera;
- zachować bezpieczne Duplicate / Clear / Delete;
- uporządkować nazewnictwo.

## Etap 3 — compact MIX

Zakres:

- zastąpić duże group bus cards kompaktowym group strip;
- zostawić channel mixer aktualnej grupy;
- dodać compact Group Bus i Master;
- otwierać Group FX i Master FX w Context Panel;
- przygotować miejsce pod późniejszy Pump context.

## Etap 4 — PADS + Sample Editor

Zakres:

- usunąć SAMPLE z MainNavigation;
- otwierać Sample Editor z wybranego pada;
- wykorzystać expanded Context Panel lub wewnętrzny kontekstowy workspace;
- zachować waveform editing.

## Etap 5 — Project menu i dalsze porządki

Zakres:

- skompresować Save/Open;
- przenieść Project Key;
- dopracować local scroll;
- usunąć tymczasowe duplikaty kontrolek.

---

# 17. Wymagania implementacyjne

- Preferować małe komponenty zamiast dalszego rozbudowywania `App.tsx`.
- Nie przenosić logiki audio do komponentów UI.
- Nie duplikować state efektów.
- `App.tsx` może przechowywać aktywny kontekst panelu, ale sam rendering parametrów powinien być wydzielony.
- Zachować dostępność:
  - `aria-pressed`;
  - `aria-label`;
  - focus states;
  - obsługa Escape dla zamknięcia panelu;
  - klawiaturowa nawigacja w chooserze efektów.
- Nie używać zewnętrznej biblioteki UI tylko do panelu lub popovera.
- Nie wykonywać szerokiego restylingu całej marki Station w tym samym zadaniu.
- Zachować obecny język wizualny, kolory i typografię, chyba że drobne zmiany są konieczne dla hierarchii.
- Nie zmieniać nazw typów domenowych tylko dla wyglądu UI.
- Nie usuwać testów ani walidacji.

---

# 18. Kryteria akceptacji Etapu 1

Po wdrożeniu pierwszego etapu:

1. Widok MIX nie pokazuje pełnych parametrów czterech FX slotów inline.
2. Group FX ma dwie kompaktowe karty slotów.
3. Master FX ma dwie kompaktowe karty slotów.
4. Kliknięcie pustego slotu otwiera chooser Compressor / Delay.
5. Kliknięcie aktywnego slotu otwiera jego parametry.
6. Empty i Bypass są wizualnie rozróżnione.
7. Compressor zachowuje wszystkie aktualne parametry i zakresy.
8. Delay zachowuje wszystkie aktualne parametry, sync i division.
9. Replace działa bez błędów.
10. Remove ustawia slot na `none`.
11. Kolejność Slot 1 → Slot 2 jest czytelna.
12. Group FX edytuje wyłącznie aktualnie wybraną Pattern Group.
13. Master FX edytuje master.
14. Zmiana BPM nadal aktualizuje zsynchronizowane Delay.
15. Odtwarzanie działa podczas edycji FX.
16. Nie ma zmian brzmienia przy tych samych ustawieniach.
17. Save/Open nadal zapisuje i odtwarza FX racks.
18. Migracje starszych projektów nadal działają.
19. `pnpm typecheck` przechodzi.
20. `pnpm build` przechodzi.
21. Working tree po zakończeniu zawiera wyłącznie celowe zmiany UI.
22. Nie dodano nowych zależności bez wyraźnej konieczności.

---

# 19. Obowiązkowa weryfikacja przed implementacją

Przed zmianami Codex powinien sprawdzić:

- aktualny commit i working tree;
- `App.tsx`;
- `App.css`;
- `MainNavigation`;
- `TransportBar`;
- `Mixer`;
- `EffectRackPanel`;
- modele efektów;
- sposób aktualizacji Group FX i Master FX;
- persistence i schema migrations;
- dokument `docs/FX_RACK_ARCHITECTURE.md`;
- dokumenty Compressor i Delay;
- istniejące screenshoty, jeśli są w repo.

Jeżeli faktyczny kod różni się od tej specyfikacji, nie zgadywać.

Najpierw opisać różnicę i wybrać najmniejszą bezpieczną adaptację, która zachowuje cel dokumentu.

---

# 20. Raport po wykonaniu

Codex powinien zakończyć zadanie raportem zawierającym:

- listę zmienionych plików;
- opis nowej struktury komponentów;
- opis stanu Context Panel;
- sposób rozróżnienia Empty / Bypass;
- potwierdzenie braku zmian DSP i routingu;
- wynik `pnpm typecheck`;
- wynik `pnpm build`;
- informacje o ewentualnych testach manualnych;
- znane ograniczenia;
- screenshot lub krótki opis finalnego layoutu;
- SHA commita, jeżeli użytkownik wyraźnie poleci wykonanie commita.

Nie tworzyć commita bez wyraźnej zgody użytkownika.
