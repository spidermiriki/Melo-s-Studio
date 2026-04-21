// scripts/sync-letterboxd.js
// Lit le RSS Letterboxd et met à jour src/data/films.json

import fetch from 'node-fetch'
import { parseStringPromise } from 'xml2js'
import fs from 'fs'
import path from 'path'

// ── CONFIG — change ton pseudo ici ──────────────────
const LETTERBOXD_USER = 'Homelo'
const FILMS_JSON_PATH = path.resolve('./src/data/films.json')
// ────────────────────────────────────────────────────

const RSS_URL = `https://letterboxd.com/${LETTERBOXD_USER}/rss/`

async function main() {
  console.log(`Fetching RSS: ${RSS_URL}`)
  const res = await fetch(RSS_URL)
  const xml = await res.text()
  const parsed = await parseStringPromise(xml)

  const items = parsed?.rss?.channel?.[0]?.item ?? []
  console.log(`Found ${items.length} entries in RSS`)

  // Charge le films.json existant
  let existingFilms = []
  if (fs.existsSync(FILMS_JSON_PATH)) {
    existingFilms = JSON.parse(fs.readFileSync(FILMS_JSON_PATH, 'utf-8'))
  }

  // Index par titre+année pour éviter les doublons
  const existingMap = new Map(
    existingFilms.map(f => [`${f.title}__${f.year}`, f])
  )

  let newCount = 0
  let updatedCount = 0

  for (const item of items) {
    const link = item.link?.[0] ?? ''
    const filmYear = parseInt(item['letterboxd:filmYear']?.[0] ?? '0')
    if (link.includes('/list/') || filmYear === 0) continue
    // Le RSS Letterboxd utilise des namespaces letterboxd:
    const title       = item['letterboxd:filmTitle']?.[0] ?? item.title?.[0] ?? ''
    const year        = parseInt(item['letterboxd:filmYear']?.[0] ?? '0')
    const ratingRaw   = item['letterboxd:memberRating']?.[0]  // ex: "3.5"
    const note        = ratingRaw ? parseFloat(ratingRaw) : null
    const liked       = item['letterboxd:like']?.[0] === 'Yes'
    const review      = item['description']?.[0] ?? ''
    const watchedDate = item['letterboxd:watchedDate']?.[0] ?? ''

    // Extrait le lien de l'affiche depuis le contenu HTML du RSS
    const content = item['description']?.[0] ?? ''
    console.log('Content snippet:', content.substring(0, 300))
    const coverMatch = content.match(/src="(https:\/\/a\.ltrbxd\.com\/[^"]+)"/)
    const cover = coverMatch?.[1]?.replace('0-600-0-900', '0-1000-0-1500') ?? ''

    // Nettoie la review (retire les balises HTML)
    const cleanReview = review
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()

const finalReview = cleanReview || ''

    const key = `${title}__${year}`

    if (existingMap.has(key)) {
      // Met à jour uniquement les champs venant de Letterboxd
      const existing = existingMap.get(key)
      const updated = {
        ...existing,
        note:   note ?? existing.note,
        like:   liked || existing.like,
        cover:  cover || existing.cover,
        review: finalReview || existing.review,
      }
      existingMap.set(key, updated)
      updatedCount++
    } else {
      // Nouveau film — on l'ajoute avec les infos disponibles
      // genre et director restent vides (pas dans le RSS)
      const newFilm = {
        id:       existingFilms.length + newCount + 1,
        title,
        year,
        note:     note ?? 0,
        genre:    '',
        director: '',
        cover,
        review:   finalReview,
        like:     liked,
        watchedDate,
      }
      existingMap.set(key, newFilm)
      newCount++
      console.log(`  ➕ Nouveau film: ${title} (${year})`)
    }
  }
  // ── Récupère aussi les films vus sans review ──
  const filmsPageRes = await fetch(`https://letterboxd.com/${LETTERBOXD_USER}/films/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  })
  const filmsHtml = await filmsPageRes.text()
  console.log('Films page HTML length:', filmsHtml.length)
  console.log('Sample HTML:', filmsHtml.substring(0, 500))

  const filmMatches = filmsHtml.matchAll(/data-film-slug="([^"]+)"[^>]*data-film-name="([^"]+)"[^>]*data-film-year="([^"]+)"[^>]*data-owner-rating="([^"]+)"/g)

  for (const match of filmMatches) {
    const [, slug, title, yearStr, ratingStr] = match
    const year = parseInt(yearStr)
    const note = parseInt(ratingStr) / 2
    const key = `${title}__${year}`

    if (!existingMap.has(key)) {
      const newFilm = {
        id: existingFilms.length + newCount + 1,
        title,
        year,
        note,
        genre: '',
        director: '',
        cover: '',
        review: '',
        like: false,
      }
      existingMap.set(key, newFilm)
      newCount++
      console.log(`  ➕ Film noté sans review: ${title} (${year})`)
    }
  }



  // Reconstruit le tableau et trie par note décroissante
  const updatedFilms = Array.from(existingMap.values())
    .sort((a, b) => (b.note ?? 0) - (a.note ?? 0))
    .map((f, i) => ({ ...f, id: i + 1 }))

  fs.writeFileSync(FILMS_JSON_PATH, JSON.stringify(updatedFilms, null, 2), 'utf-8')
  console.log(`✅ films.json mis à jour — ${newCount} ajoutés, ${updatedCount} mis à jour`)
}

main().catch(err => {
  console.error('❌ Erreur:', err)
  process.exit(1)
})