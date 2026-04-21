// scripts/import-csv.js
// Importe tous les films notés depuis ratings.csv dans films.json
// Les films sans review auront review: "" (affiché différemment dans l'UI)

import fs from 'fs'
import path from 'path'

const CSV_PATH    = path.resolve('./ratings.csv')
const FILMS_PATH  = path.resolve('./src/data/films.json')

// Parser CSV respectant les champs entre guillemets (ex: "Monsters, Inc.")
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ ratings.csv introuvable : ${CSV_PATH}`)
    process.exit(1)
  }

  // Charge films.json existant
  let existingFilms = []
  if (fs.existsSync(FILMS_PATH)) {
    existingFilms = JSON.parse(fs.readFileSync(FILMS_PATH, 'utf-8'))
  }

  // Index par "titre__année" pour éviter les doublons
  const filmMap = new Map(
    existingFilms.map(f => [`${f.title}__${f.year}`, f])
  )

  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
  const lines = csvContent.split('\n').slice(1) // skip header

  let added = 0
  let skipped = 0

  for (const line of lines) {
    if (!line.trim()) continue

    const parts = parseCSVLine(line)
    if (parts.length < 5) continue

    const [date, title, yearStr, letterboxdUri, ratingStr] = parts
    const year = parseInt(yearStr)
    const note = parseFloat(ratingStr)

    if (!title || !year || isNaN(note)) continue

    const key = `${title}__${year}`

    if (filmMap.has(key)) {
      // Met à jour le letterboxdUri si manquant
      const existing = filmMap.get(key)
      if (!existing.letterboxdUri && letterboxdUri) {
        filmMap.set(key, { ...existing, letterboxdUri })
      }
      skipped++
      continue
    }

    filmMap.set(key, {
      id: 0,
      title,
      year,
      note,
      genre: '',
      director: '',
      cover: '',
      review: '',
      like: false,
      watchedDate: date,
      letterboxdUri,
    })
    added++
    console.log(`  ➕ ${title} (${year}) — ${note}/5`)
  }

  // Recrée le tableau trié par note décroissante, ids réassignés
  const updatedFilms = Array.from(filmMap.values())
    .sort((a, b) => (b.note ?? 0) - (a.note ?? 0))
    .map((f, i) => ({ ...f, id: i + 1 }))

  fs.writeFileSync(FILMS_PATH, JSON.stringify(updatedFilms, null, 2), 'utf-8')
  console.log(`\n✅ films.json mis à jour — ${added} ajoutés, ${skipped} déjà présents`)
}

main()
