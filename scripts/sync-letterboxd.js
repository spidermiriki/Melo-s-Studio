// scripts/sync-letterboxd.js
// Lit les flux RSS Letterboxd et met à jour src/data/films.json

import Parser from 'rss-parser'
import fs from 'fs'
import path from 'path'

// ── CONFIG ───────────────────────────────────────────
const LETTERBOXD_USER = 'Homelo'
const FILMS_JSON_PATH = path.resolve('./src/data/films.json')
// ────────────────────────────────────────────────────

const RSS_URL         = `https://letterboxd.com/${LETTERBOXD_USER}/rss/`
const REVIEWS_RSS_URL = `https://letterboxd.com/${LETTERBOXD_USER}/reviews/rss/`

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const parser = new Parser({
  customFields: {
    item: [
      ['letterboxd:filmTitle',    'filmTitle'],
      ['letterboxd:filmYear',     'filmYear'],
      ['letterboxd:memberRating', 'memberRating'],
      ['letterboxd:like',         'liked'],
      ['letterboxd:watchedDate',  'watchedDate'],
    ]
  }
})

async function fetchFeed(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  const xml = await res.text()
  return parser.parseString(xml)
}

async function main() {
  console.log('Fetching RSS feeds...')

  const [diaryFeed, reviewsFeed] = await Promise.all([
    fetchFeed(RSS_URL),
    fetchFeed(REVIEWS_RSS_URL),
  ])

  // diary en premier, puis reviews (les reviews écrasent si elles ont du texte)
  const items = [...diaryFeed.items, ...reviewsFeed.items]
  console.log(`Found ${diaryFeed.items.length} diary + ${reviewsFeed.items.length} reviews = ${items.length} total`)

  let existingFilms = []
  if (fs.existsSync(FILMS_JSON_PATH)) {
    existingFilms = JSON.parse(fs.readFileSync(FILMS_JSON_PATH, 'utf-8'))
  }

  const existingMap = new Map(existingFilms.map(f => [`${f.title}__${f.year}`, f]))
  let newCount = 0
  let updatedCount = 0

  for (const item of items) {
    const link = item.link ?? ''
    if (link.includes('/list/')) continue

    const title = item.filmTitle ?? ''
    const year  = parseInt(item.filmYear ?? '0')
    if (!title || year === 0) continue

    const note        = item.memberRating ? parseFloat(item.memberRating) : null
    const liked       = item.liked === 'Yes'
    const watchedDate = item.watchedDate ?? ''

    // rss-parser place le HTML de <description> dans item.content
    const html = item.content ?? ''
    const coverMatch = html.match(/src="(https:\/\/a\.ltrbxd\.com\/[^"]+)"/)
    const cover = coverMatch?.[1]?.replace('0-600-0-900', '0-1000-0-1500') ?? ''

    const cleanReview = html
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()

    const key = `${title}__${year}`

    if (existingMap.has(key)) {
      const existing = existingMap.get(key)
      existingMap.set(key, {
        ...existing,
        note:   note ?? existing.note,
        like:   liked || existing.like,
        cover:  cover || existing.cover,
        review: cleanReview || existing.review,
      })
      updatedCount++
    } else {
      existingMap.set(key, {
        id:       existingFilms.length + newCount + 1,
        title,
        year,
        note:     note ?? 0,
        genre:    '',
        director: '',
        cover,
        review:   cleanReview,
        like:     liked,
        watchedDate,
      })
      newCount++
      console.log(`  ➕ Nouveau film: ${title} (${year})`)
    }
  }

  // ── Films notés sans review (scraping page films) ──
  try {
    const res = await fetch(`https://letterboxd.com/${LETTERBOXD_USER}/films/`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const html = await res.text()
    const matches = html.matchAll(/data-film-name="([^"]+)"[^>]*data-film-year="([^"]+)"[^>]*data-owner-rating="([^"]+)"/g)
    for (const [, title, yearStr, ratingStr] of matches) {
      const year = parseInt(yearStr)
      const note = parseInt(ratingStr) / 2
      const key  = `${title}__${year}`
      if (!existingMap.has(key)) {
        existingMap.set(key, {
          id: existingFilms.length + newCount + 1,
          title, year, note,
          genre: '', director: '', cover: '', review: '', like: false,
        })
        newCount++
        console.log(`  ➕ Film noté sans review: ${title} (${year})`)
      }
    }
  } catch (e) {
    console.warn('⚠️ Scraping films page failed (non-bloquant):', e.message)
  }

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
