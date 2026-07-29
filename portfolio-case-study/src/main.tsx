import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import wavEarly from '../../portfolio-assets/evolution/wav/early/wav_early_desktop.png'
import libraryPadEarly from '../../portfolio-assets/evolution/library-pad/early/library_pad_early_mobile.png'
import chopEarly from '../../portfolio-assets/evolution/chop/early/chop_early_mobile.png'
import seqEarly from '../../portfolio-assets/evolution/seq/early/seq_early_mobile_clean.png'
import songEarly from '../../portfolio-assets/evolution/song/early/song_early_mobile.png'
import mixEarly from '../../portfolio-assets/evolution/mix/early/mix_early_mobile.png'
import systemDisplayEarly from '../../portfolio-assets/evolution/system-display/early/system_display_early_mobile.png'
import currentPhone from '../../portfolio-assets/evolution/current/current_phone.png'
import './styles.css'

const story = [
  'Station nie zaczęło się jako w pełni zaprojektowany sampler.',
  'Najwcześniejsza wersja miała odpowiedzieć na jedno podstawowe pytanie: czy da się wczytać dźwięk bez instalacji, odtworzyć go stabilnie i stać się fundamentem prawdziwego narzędzia muzycznego?',
  'Pierwszy prototyp był bardzo prosty. Pozwalał wczytać plik WAV i uruchomić dźwięk.',
  'Kolejny etap nie polegał już na sprawdzaniu samej technologii, lecz na dodawaniu funkcji potrzebnych do rzeczywistej pracy z próbką. Pojawiły się pady, cięcie materiału, sekwencer i kolejne elementy workflow.',
  'Każda z tych funkcji zaczynała w prostej, ubogiej formie. Najważniejsze było nie to, jak wyglądała, lecz czy realnie pomagała w pracy z dźwiękiem.',
  'Z czasem osobne narzędzia zaczęły działać jak jeden instrument.',
  'Cel stał się wtedy znacznie większy: zamienić urządzenie, które użytkownik już posiada, w pełnoprawny sampler gotowy do działania bez jakiejkolwiek instalacji.',
  'Narzędzie dostępne od razu, które pozwala przejść od pojedynczej próbki do kompletnego utworu muzycznego — przy biurku, podczas spotkania ze znajomymi, kiedy nagle pojawia się pomysł, albo setki kilometrów od studia, w górach czy nad morzem.',
]

type Classification = 'historical' | 'reconstructed' | 'current'

const classificationLabel: Record<Classification, string> = {
  historical: 'HISTORICAL BUILD',
  reconstructed: 'RECONSTRUCTED EARLY STATE',
  current: 'CURRENT BUILD',
}

interface ChapterData {
  id: string
  eyebrow: string
  title: string
  paragraph: string
  extraClassName?: string
  proof: {
    src: string
    alt: string
    classification: Classification
    source: string
  }
}

const chapters: ChapterData[] = [
  {
    id: 'library-pad-title',
    eyebrow: '02 / LIBRARY + PAD',
    title: 'Pad instrument — materiał pod palcami',
    paragraph:
      'Ten sam mechanizm wgrywania i odtwarzania WAV z poprzedniego kroku trafił teraz na każdy z szesnastu padów osobno. Bez kategorii, bez biblioteki — tylko szesnaście osobnych przycisków wyboru pliku.',
    proof: {
      src: libraryPadEarly,
      alt: 'Zrekonstruowany, uproszczony widok pierwszego banku szesnastu padów z wgranym plikiem kick-01.wav',
      classification: 'reconstructed',
      source: 'Źródło funkcjonalne · e8d92f5',
    },
  },
  {
    id: 'chop-title',
    eyebrow: '03 / CHOP',
    title: 'CHOP — od próbki do slice’ów',
    paragraph:
      'CHOP pozwala podzielić próbkę na fragmenty i przypisać je do padów. Na początku to wyłącznie ręczne markery na surowym waveformie — żadnego autoslicingu, żadnego wykrywania transientów.',
    proof: {
      src: chopEarly,
      alt: 'Zrekonstruowany, uproszczony widok pierwszego ręcznego CHOP z surowym waveformem i ręcznymi markerami',
      classification: 'reconstructed',
      source: 'Źródło funkcjonalne · 5307ea0',
    },
  },
  {
    id: 'seq-title',
    eyebrow: '04 / SEQ',
    title: 'SEQ — od padów do patternu',
    paragraph:
      'SEQ służy do układania dźwięków i slice’ów w powtarzalne patterny. Pierwsza wersja trzymała wszystkie szesnaście kroków w jednym rzędzie szerszym niż ekran urządzenia — żeby zobaczyć krok 16, trzeba było niewygodnie przewijać w poziomie. Podzieliliśmy sekwencję na dwie czytelne strony: kroki 1–8 i 9–16.',
    proof: {
      src: seqEarly,
      alt: 'Zrekonstruowany, uproszczony widok pierwszego szesnastokrokowego sekwencera w jednym rzędzie szerszym niż ekran, wymagającym przewijania w poziomie',
      classification: 'reconstructed',
      source: 'Źródło funkcjonalne · 07c4d7a',
    },
  },
  {
    id: 'song-title',
    eyebrow: '05 / SONG',
    title: 'SONG — od kolejności klipów do aranżacji',
    paragraph:
      'SONG układa gotowe patterny w utwór. Zaczęło się od surowej tabeli: który pattern gra w którym slocie, wypełnianej ręcznie, bez lanes i bez podglądu przebiegu.',
    proof: {
      src: songEarly,
      alt: 'Zrekonstruowany, uproszczony widok pierwszej Pattern Playlist jako tabeli patternów i slotów czasowych',
      classification: 'reconstructed',
      source: 'Źródło funkcjonalne · 3ab73a0',
    },
  },
  {
    id: 'mix-title',
    eyebrow: '06 / MIX',
    title: 'MIX — od suwaka do charakteru brzmienia',
    paragraph:
      'Pierwszy mikser to szesnaście identycznych kart: suwak głośności, mute, solo. Żadnego routingu między grupami, żadnego automatycznego przyciszania w rytm utworu (Pump), żadnego charakteru — czysta technika bez tożsamości brzmienia.',
    proof: {
      src: mixEarly,
      alt: 'Zrekonstruowany, uproszczony widok pierwszego miksera jako listy identycznych kart kanałów',
      classification: 'reconstructed',
      source: 'Źródło funkcjonalne · dfbb888',
    },
  },
  {
    id: 'system-display-title',
    eyebrow: '07 / SYSTEM DISPLAY',
    title: 'System Display — jeden ekran, wiele kontekstów',
    paragraph:
      'Zanim powstał System Display, transport, statusy, komunikaty i parametry żyły osobno w różnych częściach interfejsu. Na wąskim ekranie to się nie skalowało — trzeba było przewijać, żeby złożyć pełny obraz stanu aplikacji.',
    proof: {
      src: systemDisplayEarly,
      alt: 'Zrekonstruowany widok stanu sprzed System Display, w którym transport, statusy i parametry są rozproszone po osobnych blokach',
      classification: 'reconstructed',
      source: 'Kompozycja na podstawie layoutów sprzed ac13738',
    },
  },
]

function Chapter({ id, eyebrow, title, paragraph, proof, extraClassName }: ChapterData) {
  return (
    <section className={extraClassName ? `chapter ${extraClassName}` : 'chapter'} aria-labelledby={id}>
      <header className="chapter__header">
        <p className="eyebrow">{eyebrow}</p>
        <div className="chapter__copy">
          <h2 id={id}>{title}</h2>
          <p>{paragraph}</p>
        </div>
      </header>

      <figure className="chapter__proof">
        <img src={proof.src} alt={proof.alt} />
        <figcaption>
          <div className="proof__source">
            <span className={`classification classification--${proof.classification}`}>
              {classificationLabel[proof.classification]}
            </span>
            <span>{proof.source}</span>
          </div>
        </figcaption>
      </figure>
    </section>
  )
}

function App() {
  return (
    <>
      <header className="topbar">
        <a href="#top" className="wordmark" aria-label="Station — początek strony">
          STATION
        </a>
        <span>Product case study</span>
        <span>01 · Początek</span>
      </header>

      <main id="top">
        <article className="opening">
          <header className="opening__header">
            <p className="eyebrow">Station / pierwsze pytanie</p>
            <h1>Czy można wgrać dźwięk?</h1>
          </header>

          <div className="opening__story opening__story--intro">
            {story.slice(0, 2).map((paragraph, index) => (
              <p className={index === 0 ? 'opening__lead' : undefined} key={paragraph}>
                {paragraph}
              </p>
            ))}
          </div>

          <figure className="proof">
            <div className="proof__image">
              <img
                src={wavEarly}
                alt="Pierwszy prototyp Station z wyborem pliku WAV i przyciskiem Play Sample"
              />
            </div>

            <figcaption>
              <div className="proof__source">
                <span className="classification">HISTORICAL BUILD</span>
                <span>550369f · M1</span>
              </div>
              <p>
                Autentyczny pierwszy build Station: jeden plik WAV, inicjalizacja
                audio i pojedynczy przycisk odtwarzania uruchamiany także klawiszem A.
              </p>
            </figcaption>
          </figure>

          <div className="opening__story opening__story--continuation">
            {story.slice(2).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          {chapters.map((chapter) => <Chapter key={chapter.id} {...chapter} />)}

          <section className="chapter chapter--finale" aria-labelledby="current-build-title">
            <header className="chapter__header">
              <p className="eyebrow">08 / CURRENT BUILD</p>
              <div className="chapter__copy">
                <h2 id="current-build-title">Dziś — jeden instrument</h2>
                <p>
                  Wszystkie wcześniejsze, osobne i ubogie funkcje zbiegają się dziś w
                  jeden instrument, dostępny od razu na Twoim urządzeniu.
                </p>
                <p className="chapter__tagline">
                  sample → pad → pattern → pump/mix → song → zapisany lub
                  wyrenderowany szkic muzyczny
                </p>
              </div>
            </header>

            <figure className="chapter__proof">
              <img
                src={currentPhone}
                alt="Bieżący układ PADS na urządzeniu mobilnym z ośmioma slice’ami i otwartym System Display"
              />
              <figcaption>
                <div className="proof__source">
                  <span className="classification classification--current">CURRENT BUILD</span>
                  <span>20c8ee2</span>
                </div>
              </figcaption>
            </figure>
          </section>
        </article>
      </main>

      <footer>
        <span>Station / functional evolution</span>
        <span>
          Początek / Library+Pad / Chop / Seq / Song / Mix / System Display / Current
          Build
        </span>
      </footer>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
