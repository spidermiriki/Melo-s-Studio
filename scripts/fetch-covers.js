// scripts/fetch-covers.js
// Récupère les covers Letterboxd pour les films qui n'en ont pas encore.
// Utilise le letterboxdUri (boxd.it) sauvegardé lors de l'import CSV.
// Node 18+ requis (fetch natif). Lance depuis la racine du projet.

import fs from 'fs'
import path from 'path'

const FILMS_PATH = path.resolve('./src/data/films.json')
const DELAY_MS   = 400   // délai entre chaque requête pour ne pas se faire bloquer
const SAVE_EVERY = 20    // sauvegarde intermédiaire tous les N films

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchCover(uri) {
  try {
    const res = await fetch(uri, { headers: HEADERS, redirect: 'follow' })
    if (!res.ok) return null
    const html = await res.text()

    // Pattern 1 : poster dans /film-poster/ (films récents)
    const m1 = html.match(/https:\/\/a\.ltrbxd\.com\/resized\/film-poster\/[^"'\s]+/)
    // Pattern 2 : poster dans JSON-LD "image" (films sans poster classique)
    const m2 = html.match(/"image":"(https:\/\/a\.ltrbxd[^"]+)"/)
    const raw = m1?.[0] ?? m2?.[1]
    if (!raw) return null

    // Normalise en grande résolution
    return raw.replace(/0-\d+-0-\d+-crop/, '0-1000-0-1500-crop')
  } catch {
    return null
  }
}

async function main() {
  const films = JSON.parse(fs.readFileSync(FILMS_PATH, 'utf-8'))

  const todo = films.filter(f => !f.cover && f.letterboxdUri)
  console.log(`🎬 ${todo.length} films sans cover à traiter\n`)

  let done = 0
  let failed = 0

  for (const film of todo) {
    process.stdout.write(`[${done + 1}/${todo.length}] ${film.title} (${film.year}) ... `)

    const cover = await fetchCover(film.letterboxdUri)

    if (cover) {
      film.cover = cover
      process.stdout.write(`✅\n`)
      done++
    } else {
      process.stdout.write(`❌ (pas trouvé)\n`)
      failed++
    }

    // Sauvegarde intermédiaire
    if ((done + failed) % SAVE_EVERY === 0) {
      fs.writeFileSync(FILMS_PATH, JSON.stringify(films, null, 2), 'utf-8')
      console.log(`  💾 Sauvegarde intermédiaire (${done} covers récupérés)\n`)
    }

    await sleep(DELAY_MS)
  }

  // Sauvegarde finale
  fs.writeFileSync(FILMS_PATH, JSON.stringify(films, null, 2), 'utf-8')
  console.log(`\n✅ Terminé — ${done} covers ajoutés, ${failed} échecs`)
}

main().catch(err => {
  console.error('❌ Erreur:', err)
  process.exit(1)
})
