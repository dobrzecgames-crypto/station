import { StrictMode, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import wavEarly from '../../portfolio-assets/evolution/wav/early/wav_early_desktop.png'
import libraryPadEarly from '../../portfolio-assets/evolution/library-pad/early/library_pad_early_mobile.png'
import chopEarly from '../../portfolio-assets/evolution/chop/early/chop_early_mobile.png'
import seqEarly from '../../portfolio-assets/evolution/seq/early/seq_early_mobile_clean.png'
import songEarly from '../../portfolio-assets/evolution/song/early/song_early_mobile.png'
import mixEarly from '../../portfolio-assets/evolution/mix/early/mix_early_mobile.png'
import systemDisplayEarly from '../../portfolio-assets/evolution/system-display/early/system_display_early_mobile.png'
import designEarly from '../../portfolio-assets/evolution/design/early/design_early_mobile.png'
import libraryPadIntermediate from '../../portfolio-assets/evolution/library-pad/intermediate/library_pad_intermediate_mobile.png'
import chopIntermediate from '../../portfolio-assets/evolution/chop/intermediate/chop_intermediate_mobile.png'
import seqIntermediate from '../../portfolio-assets/evolution/seq/intermediate/seq_intermediate_mobile.png'
import songIntermediate from '../../portfolio-assets/evolution/song/intermediate/song_intermediate_mobile.png'
import mixIntermediate from '../../portfolio-assets/evolution/mix/intermediate/mix_intermediate_mobile.png'
import systemDisplayIntermediate from '../../portfolio-assets/evolution/system-display/intermediate/system_display_intermediate_mobile.png'
import designIntermediate from '../../portfolio-assets/evolution/design/intermediate/design_intermediate_mobile.png'
import chopCurrent from '../../portfolio-assets/evolution/chop/current/chop_current_mobile.png'
import seqCurrent from '../../portfolio-assets/evolution/seq/current/seq_current_mobile.png'
import systemDisplayCurrent from '../../portfolio-assets/evolution/system-display/current/system_display_current_mobile.png'
import currentPads from '../../portfolio-assets/evolution/current/current_pads_synth.png'
import currentPhone from '../../portfolio-assets/evolution/current/current_phone.png'
import currentSong from '../../portfolio-assets/evolution/current/current_song_full.png'
import currentMix from '../../portfolio-assets/evolution/current/current_mix_pump.png'
import './styles.css'

const stationAppUrl = import.meta.env.DEV ? 'http://localhost:5173/' : '/station/'

const story = [
  'Station nie zaczęło się jako w pełni zaprojektowany sampler.',
  'Najwcześniejsza wersja miała odpowiedzieć na jedno podstawowe pytanie: czy da się wczytać dźwięk bez instalacji, odtworzyć go stabilnie i stać się fundamentem prawdziwego narzędzia muzycznego?',
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
  paragraphs: string[]
  postProofParagraphs?: string[]
  showVinylPalette?: boolean
  extraClassName?: string
  /** Module accent from DESIGN_SYSTEM.md — lights up the chapter lamp and rail dot. */
  accent: string
  proofs: [ProofSlide, ProofSlide, ProofSlide]
}

interface ProofSlide {
  stage: 'start' | 'process' | 'final'
  label: string
  src?: string
  alt?: string
  classification?: Classification
  source: string
  placeholder?: string
}

const chapters: ChapterData[] = [
  {
    id: 'library-pad-title',
    eyebrow: '02 / LIBRARY + PAD',
    accent: '#B6C879',
    title: 'Dźwięk trafia pod palce',
    paragraphs: [
      'Ten sam mechanizm wgrywania i odtwarzania WAV z poprzedniego kroku trafił teraz na każdy z szesnastu padów osobno. Bez kategorii, bez biblioteki — tylko szesnaście osobnych przycisków wyboru pliku.',
    ],
    proofs: [
      {
        stage: 'start',
        label: 'Początek',
        src: libraryPadEarly,
        alt: 'Zrekonstruowany, uproszczony widok pierwszego banku szesnastu padów z wgranym plikiem kick-01.wav',
        classification: 'reconstructed',
        source: 'Źródło funkcjonalne · e8d92f5',
      },
      {
        stage: 'process',
        label: 'W trakcie',
        src: libraryPadIntermediate,
        alt: 'Autentyczny historyczny widok pierwszej biblioteki próbek z kategoriami i technicznym przypisywaniem dźwięku',
        classification: 'historical',
        source: 'ead3930 · pierwsza Library',
      },
      {
        stage: 'final',
        label: 'Efekt końcowy',
        src: currentPads,
        alt: 'Aktualny widok PADS z biblioteką i panelem edycji dźwięku w System Display',
        classification: 'current',
        source: 'e92961d · Station Beta 1',
      },
    ],
  },
  {
    id: 'chop-title',
    eyebrow: '03 / CHOP',
    accent: '#C69A62',
    title: 'Próbka staje się materiałem',
    paragraphs: [
      'CHOP pozwala podzielić próbkę na fragmenty i przypisać je do padów. Na początku to wyłącznie ręczne markery na surowym waveformie — żadnego autoslicingu, żadnego wykrywania transientów.',
    ],
    proofs: [
      {
        stage: 'start',
        label: 'Początek',
        src: chopEarly,
        alt: 'Zrekonstruowany, uproszczony widok pierwszego ręcznego CHOP z surowym waveformem i ręcznymi markerami',
        classification: 'reconstructed',
        source: 'Źródło funkcjonalne · 5307ea0',
      },
      {
        stage: 'process',
        label: 'W trakcie',
        src: chopIntermediate,
        alt: 'Autentyczny historyczny CHOP z funkcjami automatycznego cięcia Equal i Smart',
        classification: 'historical',
        source: '3263d54 · Equal + Smart Auto Chop',
      },
      {
        stage: 'final',
        label: 'Efekt końcowy',
        src: chopCurrent,
        alt: 'Aktualny mobilny widok CHOP z wgraną próbką Sample 1, widoczną falą i automatycznym cięciem SMART ustawionym na 12 slice’ów',
        classification: 'current',
        source: 'e92961d · SMART 12 / Station Beta 1',
      },
    ],
  },
  {
    id: 'seq-title',
    eyebrow: '04 / SEQ',
    accent: '#8F86B8',
    title: 'Pattern zamiast pojedynczych uderzeń',
    paragraphs: [
      'SEQ służy do układania dźwięków i slice’ów w powtarzalne patterny. Pierwsza wersja trzymała wszystkie szesnaście kroków w jednym rzędzie szerszym niż ekran urządzenia — żeby zobaczyć krok 16, trzeba było niewygodnie przewijać w poziomie. Podzieliliśmy sekwencję na dwie czytelne strony: kroki 1–8 i 9–16.',
    ],
    proofs: [
      {
        stage: 'start',
        label: 'Początek',
        src: seqEarly,
        alt: 'Zrekonstruowany, uproszczony widok pierwszego szesnastokrokowego sekwencera w jednym rzędzie szerszym niż ekran, wymagającym przewijania w poziomie',
        classification: 'reconstructed',
        source: 'Źródło funkcjonalne · 07c4d7a',
      },
      {
        stage: 'process',
        label: 'W trakcie',
        src: seqIntermediate,
        alt: 'Autentyczny mobilny widok pośredniego SEQ ze starą oprawą, próbką Kick 01 i szesnastokrokową matrycą wymagającą przewijania w poziomie',
        classification: 'historical',
        source: '5ab12d9 · mobilny problem 16 kroków',
      },
      {
        stage: 'final',
        label: 'Efekt końcowy',
        src: seqCurrent,
        alt: 'Aktualny mobilny widok SEQ z dwunastoma slice’ami próbki oraz aktywnymi krokami patternu',
        classification: 'current',
        source: 'e92961d · Station Beta 1',
      },
    ],
  },
  {
    id: 'song-title',
    eyebrow: '05 / SONG',
    accent: '#B77878',
    title: 'Patterny zaczynają tworzyć utwór',
    paragraphs: [
      'SONG układa gotowe patterny w utwór. Zaczęło się od surowej tabeli: który pattern gra w którym slocie, wypełnianej ręcznie, bez lanes i bez podglądu przebiegu.',
    ],
    proofs: [
      {
        stage: 'start',
        label: 'Początek',
        src: songEarly,
        alt: 'Zrekonstruowany, uproszczony widok pierwszej Pattern Playlist jako tabeli patternów i slotów czasowych',
        classification: 'reconstructed',
        source: 'Źródło funkcjonalne · 3ab73a0',
      },
      {
        stage: 'process',
        label: 'W trakcie',
        src: songIntermediate,
        alt: 'Autentyczny historyczny widok pierwszego działającego SONG z patternami ułożonymi w kolejne sloty',
        classification: 'historical',
        source: '3ab73a0 · pierwsza Pattern Playlist',
      },
      {
        stage: 'final',
        label: 'Efekt końcowy',
        src: currentSong,
        alt: 'Aktualny widok SONG z arrangement lanes i rozbudowaną aranżacją patternów',
        classification: 'current',
        source: 'e92961d · Station Beta 1',
      },
    ],
  },
  {
    id: 'mix-title',
    eyebrow: '06 / MIX',
    accent: '#6E91A6',
    title: 'Proporcje, ruch i charakter',
    paragraphs: [
      'Pierwszy mikser to szesnaście identycznych kart: suwak głośności, mute, solo. Żadnego routingu między grupami, żadnego automatycznego przyciszania w rytm utworu (Pump), żadnego charakteru — czysta technika bez tożsamości brzmienia.',
    ],
    proofs: [
      {
        stage: 'start',
        label: 'Początek',
        src: mixEarly,
        alt: 'Zrekonstruowany, uproszczony widok pierwszego miksera jako listy identycznych kart kanałów',
        classification: 'reconstructed',
        source: 'Źródło funkcjonalne · dfbb888',
      },
      {
        stage: 'process',
        label: 'W trakcie',
        src: mixIntermediate,
        alt: 'Autentyczny historyczny mikser po przejściu na pionowe fadery i kompaktowy panel Pump',
        classification: 'historical',
        source: '8aa9e92 · pionowe fader strips',
      },
      {
        stage: 'final',
        label: 'Efekt końcowy',
        src: currentMix,
        alt: 'Aktualny widok MIX z meteringiem kanałów i routingiem Pump wewnątrz miksera',
        classification: 'current',
        source: 'e92961d · Station Beta 1',
      },
    ],
  },
  {
    id: 'system-display-title',
    eyebrow: '07 / SYSTEM DISPLAY',
    accent: '#83BED2',
    title: 'Jeden ekran dla całego systemu',
    paragraphs: [
      'Zanim powstał System Display, transport, statusy, komunikaty i parametry żyły osobno w różnych częściach interfejsu. Na wąskim ekranie to się nie skalowało — trzeba było przewijać, żeby złożyć pełny obraz stanu aplikacji.',
    ],
    proofs: [
      {
        stage: 'start',
        label: 'Początek',
        src: systemDisplayEarly,
        alt: 'Zrekonstruowany widok stanu sprzed System Display, w którym transport, statusy i parametry są rozproszone po osobnych blokach',
        classification: 'reconstructed',
        source: 'Kompozycja na podstawie layoutów sprzed ac13738',
      },
      {
        stage: 'process',
        label: 'W trakcie',
        src: systemDisplayIntermediate,
        alt: 'Autentyczny pierwszy System Display z rozwiniętymi ustawieniami tempa i odtwarzania',
        classification: 'historical',
        source: 'ac13738 · pierwszy System Display',
      },
      {
        stage: 'final',
        label: 'Efekt końcowy',
        src: systemDisplayCurrent,
        alt: 'Aktualny mobilny widok Station z rozwiniętym System Display oraz dwunastoma padami utworzonymi z próbki',
        classification: 'current',
        source: 'e92961d · Station Beta 1',
      },
    ],
  },
  {
    id: 'design-title',
    eyebrow: '08 / DESIGN',
    accent: '#C86F50',
    title: 'Funkcje dostały wspólny język',
    paragraphs: [
      'Po zakończeniu najważniejszych testów funkcjonalnych przyszedł moment, żeby połączyć wszystkie elementy Station w jedną wersję produktu. Pojawiła się wtedy pierwsza, tymczasowa oprawa graficzna: wypukłe przełączniki, fazowane krawędzie i gradientowe klawisze, obok nich zwykłe, niestylowane checkboxy systemowe, a komunikaty żyły w osobnych miejscach — jednego wspólnego wyświetlacza jeszcze nie było. Sampler zaczął wyglądać jak spójne urządzenie, ale to był etap przejściowy, potrzebny, żeby sprawdzić proporcje i hierarchię interfejsu, zanim powstanie coś ostatecznego.',
    ],
    postProofParagraphs: [
      'Przy projektowaniu docelowego języka wizualnego wróciliśmy do palety stworzonej wcześniej dla innego projektu — futurystycznej gry osadzonej w synthwave’owej, niedalekiej przyszłości, przefiltrowanej przez estetykę wyblakłych okładek i starych płyt winylowych. Ten kierunek świetnie pasował: Station czerpie z klasycznych, sprzętowych samplerów — fizycznych, ograniczonych, konkretnych — a jednocześnie działa na urządzeniu, które użytkownik już ma, bez instalacji. Z tego połączenia powstał Vinyl Dust.',
    ],
    showVinylPalette: true,
    proofs: [
      {
        stage: 'start',
        label: 'Początek',
        src: designEarly,
        alt: 'Autentyczny zrzut z etapu hardware-inspired: wypukłe przełączniki, fazowane krawędzie, gradientowe klawisze, niestylowane checkboxy i komunikaty rozproszone po osobnych panelach',
        classification: 'historical',
        source: 'f3c2aee · hardware-inspired pass',
      },
      {
        stage: 'process',
        label: 'W trakcie',
        src: designIntermediate,
        alt: 'Autentyczny etap pośredni z pierwszym spójnym systemem Lab Interface i uporządkowaną typografią',
        classification: 'historical',
        source: '66352ed · Lab Interface',
      },
      {
        stage: 'final',
        label: 'Efekt końcowy',
        src: currentPhone,
        alt: 'Aktualny interfejs Station Beta 1 oparty na języku wizualnym Vinyl Dust',
        classification: 'current',
        source: 'e92961d · Vinyl Dust / Station Beta 1',
      },
    ],
  },
]

/** Reveals once a section scrolls into view; stays revealed afterwards. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, inView] as const
}

function Chapter({
  id,
  eyebrow,
  title,
  paragraphs,
  postProofParagraphs,
  showVinylPalette,
  proofs,
  extraClassName,
  accent,
}: ChapterData) {
  const [ref, inView] = useInView<HTMLElement>()
  const sectionClassName = ['chapter', extraClassName, inView && 'chapter--visible'].filter(Boolean).join(' ')

  return (
    <section
      ref={ref}
      id={`section-${id}`}
      className={sectionClassName}
      style={{ '--lamp-color': accent } as CSSProperties}
      aria-labelledby={id}
    >
      <header className="chapter__header">
        <p className="eyebrow">
          <span className="lamp" aria-hidden="true" />
          {eyebrow}
        </p>
        <div className="chapter__copy">
          <h2 id={id}>{title}</h2>
          {paragraphs.map((text) => <p key={text}>{text}</p>)}
        </div>
      </header>

      <EvidenceCarousel proofs={proofs} title={title} />

      {postProofParagraphs?.length ? (
        <div className="chapter__post-proof">
          {postProofParagraphs.map((text) => <p key={text}>{text}</p>)}
        </div>
      ) : null}

      {showVinylPalette ? <VinylDustPalette /> : null}
    </section>
  )
}

const vinylSceneColors = [
  { name: 'VOID', role: 'TŁO', value: '#0B0C14' },
  { name: 'SKY', role: 'CIEŃ', value: '#201B2B' },
  { name: 'PANEL', role: 'POWIERZCHNIA', value: '#181720' },
  { name: 'CONTROL', role: 'STEROWANIE', value: '#2B2527' },
  { name: 'IVORY', role: 'TEKST', value: '#EEE4D6' },
]

const vinylFunctionColors = [
  { name: 'ACTION', role: 'WYBÓR', value: '#C86F50' },
  { name: 'LOADED', role: 'MATERIAŁ', value: '#B99A62' },
  { name: 'SIGNAL', role: 'READY', value: '#83BED2' },
  { name: 'RECORD', role: 'REC', value: '#CF5450' },
]

const vinylModuleColors = [
  {
    name: 'CHOP',
    value: '#A5769D',
    material: 'linear-gradient(180deg, #493547 0%, #2E263A 45%, #191827 100%)',
  },
  {
    name: 'PADS',
    value: '#C69B61',
    material: 'linear-gradient(180deg, #334454 0%, #263444 45%, #171E2B 100%)',
  },
  {
    name: 'SEQ',
    value: '#9A88C3',
    material: 'linear-gradient(180deg, #3E3A62 0%, #2C2B4B 45%, #19182F 100%)',
  },
  {
    name: 'SONG',
    value: '#B07085',
    material: 'linear-gradient(180deg, #503549 0%, #36263C 45%, #201827 100%)',
  },
  {
    name: 'MIX',
    value: '#78A1B2',
    material: 'linear-gradient(180deg, #2C4954 0%, #213744 45%, #14212C 100%)',
  },
  {
    name: 'PROJECT',
    value: '#9AA5AF',
    material: 'linear-gradient(180deg, #3E4556 0%, #2D3444 45%, #1A202D 100%)',
  },
]

function VinylDustPalette() {
  return (
    <figure className="vinyl-palette" aria-label="Paleta kolorów systemu Vinyl Dust">
      <header className="vinyl-palette__header">
        <strong>VINYL DUST</strong>
      </header>

      <section className="vinyl-palette__group" aria-label="Kolory bazowe">
        <div className="vinyl-palette__scene">
          {vinylSceneColors.map((color) => (
            <div
              className="vinyl-palette__swatch"
              key={color.name}
              aria-label={`${color.name}, ${color.value}`}
            >
              <span
                className="vinyl-palette__color"
                style={{ '--swatch-color': color.value } as CSSProperties}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="vinyl-palette__group" aria-label="Kolory funkcjonalne">
        <div className="vinyl-palette__functions">
          {vinylFunctionColors.map((color) => (
            <div
              className="vinyl-palette__function"
              key={color.name}
              style={{ '--swatch-color': color.value } as CSSProperties}
              aria-label={`${color.name}, ${color.value}`}
            />
          ))}
        </div>
      </section>

      <section className="vinyl-palette__group" aria-label="Kolory modułów Station">
        <div className="vinyl-palette__modules">
          {vinylModuleColors.map((color) => (
            <div
              className="vinyl-palette__module"
              key={color.name}
              style={{
                '--swatch-color': color.value,
                '--swatch-material': color.material,
              } as CSSProperties}
              aria-label={`${color.name}, ${color.value}`}
            />
          ))}
        </div>
      </section>
    </figure>
  )
}

function EvidenceCarousel({
  proofs,
  title,
}: {
  proofs: [ProofSlide, ProofSlide, ProofSlide]
  title: string
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isInteracting, setIsInteracting] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const activeProof = proofs[activeIndex]

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => Math.min(proofs.length - 1, Math.max(0, current + direction)))
  }

  return (
    <figure
      className="chapter__proof evidence-carousel"
      aria-label={`${title}: trzy etapy rozwoju`}
    >
      <div className="evidence-carousel__topline" aria-live="polite">
        <span>{String(activeIndex + 1).padStart(2, '0')} / 03</span>
        <strong>{activeProof.label}</strong>
      </div>

      <div
        className={`evidence-carousel__viewport${isInteracting ? ' is-interacting' : ''}`}
        onPointerDown={() => setIsInteracting(true)}
        onPointerUp={() => setIsInteracting(false)}
        onPointerCancel={() => setIsInteracting(false)}
        onPointerLeave={() => setIsInteracting(false)}
        onTouchStart={(event) => {
          touchStartX.current = event.changedTouches[0]?.clientX ?? null
        }}
        onTouchEnd={(event) => {
          setIsInteracting(false)
          if (touchStartX.current === null) return
          const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
          touchStartX.current = null
          if (Math.abs(distance) < 45) return
          move(distance < 0 ? 1 : -1)
        }}
      >
        {activeProof.src ? (
          <img key={activeProof.src} src={activeProof.src} alt={activeProof.alt ?? ''} />
        ) : (
          <div className="evidence-carousel__placeholder" role="img" aria-label={activeProof.placeholder}>
            <span>03 / EFEKT KOŃCOWY</span>
            <p>{activeProof.placeholder}</p>
          </div>
        )}

        <button
          className="evidence-carousel__arrow evidence-carousel__arrow--previous"
          type="button"
          onClick={() => move(-1)}
          disabled={activeIndex === 0}
          aria-label={`Poprzedni etap rozwoju: ${title}`}
        >
          <span className="evidence-carousel__chevron" aria-hidden="true" />
        </button>
        <button
          className={`evidence-carousel__arrow evidence-carousel__arrow--next${activeIndex === 0 ? ' is-inviting' : ''}`}
          type="button"
          onClick={() => move(1)}
          disabled={activeIndex === proofs.length - 1}
          aria-label={`Następny etap rozwoju: ${title}`}
        >
          <span className="evidence-carousel__chevron" aria-hidden="true" />
        </button>
      </div>

      <div className="evidence-carousel__dots" aria-hidden="true">
        {proofs.map((proof, index) => (
          <span
            key={proof.stage}
            className={index === activeIndex ? 'is-active' : undefined}
          />
        ))}
      </div>

      {activeProof.classification ? (
        <figcaption aria-live="polite">
          <div className="proof__source">
            <span className={`classification classification--${activeProof.classification}`}>
              {classificationLabel[activeProof.classification]}
            </span>
          </div>
        </figcaption>
      ) : null}
    </figure>
  )
}

function App() {
  const [finaleRef, finaleInView] = useInView<HTMLElement>()

  return (
    <>
      <main id="top">
        <section className="machine-hero" aria-label="Station — aktualny instrument">
          <div className="machine-hero__visual">
            <iframe
              className="machine-hero__frame"
              src={stationAppUrl}
              title="Station — interaktywny sampler i groovebox"
              allow="autoplay"
            />
          </div>

        </section>

        <article className="opening" id="section-start">
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
              </div>
            </figcaption>
          </figure>

          <div className="opening__story opening__story--continuation">
            {story.slice(2).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          {chapters.map((chapter) => <Chapter key={chapter.id} {...chapter} />)}

          <section
            ref={finaleRef}
            id="section-finale"
            className={`chapter chapter--finale${finaleInView ? ' chapter--visible' : ''}`}
            style={{ '--lamp-color': '#EEE4D6' } as CSSProperties}
            aria-labelledby="current-build-title"
          >
            <header className="chapter__header">
              <p className="eyebrow">
                <span className="lamp" aria-hidden="true" />
                09 / CURRENT BUILD
              </p>
              <div className="chapter__copy">
                <h2 id="current-build-title">Jeden spójny instrument</h2>
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

            <figure className="finale-proof">
              <img
                src={currentPads}
                alt="Aktualny mobilny widok PADS z jedną próbką pociętą na szesnaście gotowych padów"
              />
            </figure>
          </section>
        </article>
      </main>

      <footer>
        <a className="back-to-machine" href="#top" aria-label="Wróć do Beat Machine na początku strony">
          <span className="back-to-machine__arrow" aria-hidden="true">↑</span>
          <span>Back to Beat Machine</span>
        </a>
      </footer>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
