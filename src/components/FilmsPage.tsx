import { useState, useEffect } from 'react'
import './FilmsPage.css'
import FILMS_DATA from '../data/films.json'

export interface Film {
  id: number
  title: string
  year: number
  note: number
  review: string
  genre: string
  cover: string
  director: string
  like: boolean
}

const FILMS = FILMS_DATA as Film[]

// ── Compteur VHS animé ───────────────────────────────
function VhsCounter() {
  const [time, setTime] = useState('00:00:00')

  useEffect(() => {
    let seconds = 0
    const id = setInterval(() => {
      seconds++
      const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
      const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
      const s = String(seconds % 60).padStart(2, '0')
      setTime(`${h}:${m}:${s}`)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return <div className="fp-vhs-counter">REC ● {time}</div>
}

// ── Étoiles ──────────────────────────────────────────
function Stars({ note, like }: { note: number, like: boolean }) {
  return (
    <div className="fp-stars">
      {Array.from({ length: 5 }, (_, i) => {
        const full = i < Math.floor(note)
        const half = !full && i < note
        return (
          <span key={i} className={`fp-star ${full ? 'filled' : half ? 'half' : ''} ${like ? 'liked' : ''}`}>
            {full ? '★' : half ? '⯨' : '☆'}
          </span>
        )
      })}
      <span className="fp-note">{note}/5</span>
      {like && <span className="fp-like-heart">♥</span>}
    </div>
  )
}
// ── Boîte VHS ────────────────────────────────────────
function DvdItem({ film, isActive, onClick }: {
  film: Film
  isActive: boolean
  onClick: (id: number | null) => void
}) {
  return (
    <div
      className={`fp-dvd ${isActive ? 'active' : ''}`}
      onClick={() => onClick(isActive ? null : film.id)}
    >
      <div className="fp-dvd-case">
        <div className="fp-dvd-spine" />
        <div className="fp-dvd-front">
          {film.cover && <img src={film.cover} alt={film.title} />}
          <div className="fp-dvd-placeholder">
            <span className={film.like ? 'fp-dvd-title-liked' : ''}>{film.title}</span>
            <span className="fp-dvd-year">{film.year}</span>
            {film.like && <span className="fp-dvd-heart">♥</span>}
          </div>
          <div className="fp-dvd-logo">VHS</div>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────
export function FilmsPage() {
  const [activeId, setActiveId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const filteredFilms = [...FILMS]
    .sort((a, b) => b.note - a.note)
    .filter(f => f.title.toLowerCase().includes(search.toLowerCase()))

  const activeFilm = FILMS.find(f => f.id === activeId) ?? null

  return (
    <div className="fp-root">

      {/* Compteur REC */}
      <VhsCounter />

      {/* Label VHS */}
      <div className="fp-vhs-label">▶ PLAY</div>

      {/* Titre */}
      <header className="fp-header">
        <div className="fp-film-strip">
          {Array.from({ length: 10 }, (_, i) => <div key={i} className="fp-film-hole" />)}
        </div>
        <h1 className="fp-title">Melo's Studio</h1>
        <div className="fp-film-strip">
          {Array.from({ length: 10 }, (_, i) => <div key={i} className="fp-film-hole" />)}
        </div>
      </header>

      {/* Barre de recherche */}
      <div className="fp-search-bar">
        <span className="fp-search-icon">▶</span>
        <input
          type="text"
          placeholder="RECHERCHER UN FILM..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="fp-search-input"
        />
      </div>

      {/* Contenu */}
      <main className="fp-main">

        {/* Pile VHS */}
        <section className="fp-stack-section">
          <div className="fp-stack">
            {filteredFilms.length > 0
              ? filteredFilms.map((film, i) => (
                  <div
                    key={film.id}
                    className="fp-stack-row"
                  >
                    <DvdItem
                      film={film}
                      isActive={activeId === film.id}
                      onClick={setActiveId}
                    />
                  </div>
                ))
              : (
                <div className="fp-not-found">
                  <p>PAS ENCORE VU</p>
                  <p>OU PAS ENCORE REVIEWÉ</p>
                  <p>DÉSOLÉ 📼</p>
                </div>
              )
            }
          </div>
        </section>

        {/* Review */}
        <section className="fp-review-panel">
          {activeFilm ? (
            <div className="fp-review-content">
            <div className="fp-spotlight" />

            {/* Cover */}
            {activeFilm.cover && (
                <img src={activeFilm.cover} alt={activeFilm.title} className="fp-review-cover" />
            )}

            <div className="fp-review-genre">{activeFilm.genre}</div>
            <h2 className="fp-review-title">{activeFilm.title}</h2>
            <p className="fp-review-meta">{activeFilm.year} · {activeFilm.director}</p>
            <Stars note={activeFilm.note} like={!!activeFilm.like} />
            <div className="fp-review-divider" />
            {activeFilm.review
              ? <p className="fp-review-text">{activeFilm.review}</p>
              : <p className="fp-no-review">[ AUCUNE REVIEW DISPONIBLE ]</p>
            }
            </div>
          ) : (
            <div className="fp-review-empty">
              <div className="fp-cursor-blink">_</div>
              <p>Clique sur une cassette</p>
            </div>
          )}
        </section>

      </main>

      {/* Grain */}
      <div className="fp-grain" />

    </div>
  )
}