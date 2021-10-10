const fs = require('fs')
const needle = require('needle')
const AnkiExport = require('anki-apkg-export').default
const argv = require('yargs/yargs')(process.argv.slice(2))
  .usage('Usage: $ node k2a.js -v /path/to/vocab.db')
  .demandOption(['v', 'n'])
  .describe('v', 'Path to your Kindle\'s vocab.db sqlite file')
  .describe('n', 'Name of your Anki deck')
  .argv
const db = require('better-sqlite3')(argv.v)

const checkpoint = fs.readFileSync('./checkpoint', 'utf8')

const unfetched = db.prepare('SELECT count(*) AS results FROM lookups WHERE timestamp > ?').get(checkpoint)
console.log(unfetched.results + ' lookups to fetch')

const LOOKUP_QUERY = `
SELECT words.stem, words.word, lookups.usage, lookups.timestamp, book_info.title
FROM lookups
LEFT JOIN words
ON words.id = lookups.word_key
LEFT JOIN book_info
ON lookups.book_key = book_info.id
WHERE lookups.timestamp > ?
`

const API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/'
const lookups = db.prepare(LOOKUP_QUERY).all(checkpoint)

const apkg = new AnkiExport(argv.n)
const promises = []

function getDefinitions(lookup) {
  return new Promise((resolve, reject) => {
    return needle.get(`${API_URL}${lookup.stem}`, (err, res) => {
      if (err) {
        console.log('REJECTING!')
        return reject(err)
      }
      const meaning = res.body[0]?.meanings[0]
      if (!meaning) {
        return resolve()
      }
      return resolve({
        front: lookup.stem, 
        back: `<i>(${meaning.partOfSpeech})</i> ${meaning.definitions[0].definition}`
      })
    })
  })
}

lookups.forEach(lookup => promises.push(getDefinitions(lookup)))

Promise.all(promises)
  .then(result => {
    return result.filter(e => e)
  })
  .then(result => {
    result.forEach(card => {
      apkg.addCard(card.front, card.back)
    })
    return result.length
  })
  .then(total => {
    console.log(`Generating apkg file with ${total} entries`)
    return apkg.save()
  })
  .then(zip => {
    fs.writeFileSync(`./${argv.n}.apkg`, zip, 'binary')
  })

