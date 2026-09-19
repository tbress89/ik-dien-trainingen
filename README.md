# Ik Dien Trainingen

Een club-gebrandmerkte database van voetbaltraining oefeningen, gebaseerd op het KNVB Rinus platform.

**Club**: Ik Dien  
**Kleuren**: Paars (#4E2F75) / Wit (#FFFFFF)

---

## 📁 Project Structuur

```
ik-dien-trainingen/
├── oefeningen/          # Web applicatie (statisch HTML/CSS/JS)
│   ├── index.html       # Hoofdpagina
│   ├── style.css        # Ik Dien paars thema
│   ├── app.js           # Zoek- en filterlogica
│   ├── ikdien-logo-wit.png # Clublogo
│   └── robots.txt       # Anti-crawler configuratie
├── data/                # Oefeningen database
│   ├── exercises.json   # Onbewerkte gescrapete dataset (raw KNVB export)
│   ├── exercises-deduped.json # Deduplicated exercise export (106 unieke oefeningen)
│   ├── exercises-data.js # JavaScript dataset voor directe file:// weergave
│   ├── sample-exercises.json  # Backup dataset
│   └── dedupe-report.json    # Rapport met duplicate clusters en verwijderingen
├── scraper/             # KNVB Rinus spider scraper
│   ├── dedupe-exercises.js # Deduplicatie- en merge-logica
│   ├── package.json
│   └── scrape.js        # Playwright scraper
└── README.md
```

## 🚀 Snel Starten

### Oefeningen Bekijken

Open gewoon `oefeningen/index.html` in je browser — geen server nodig!

```bash
open oefeningen/index.html
```

De app laadt automatisch de gededupliceerde dataset uit `data/exercises-data.js`.

### Oefeningen dedupliceren

Gebruik de dedupe-script om dubbele of bijna-duplicate oefeningen te verwijderen voordat je de dataset in de app laadt:

```bash
node scraper/dedupe-exercises.js
```

De script leest de onbewerkte `data/exercises.json`, verwijdert exacte duplicaten op basis van genormaliseerde titels en schrijft een schone dataset naar `data/exercises-deduped.json` plus `data/exercises-data.js`.

### Oefeningen Scrapen van KNVB Rinus

> **Vereisten**: Node.js 18+ geïnstalleerd

1. **Installeer de scraper:**
   ```bash
   cd scraper
   npm install
   ```

2. **Run de scraper:**
   ```bash
   # Headless modus (standaard)
   npm run scrape
   
   # Met zichtbare browser (voor debugging)
   npm run scrape:headed
   ```

3. **Met KNVB login** (voor toegang tot alle oefeningen):
   ```bash
   RINUS_EMAIL=jouw@email.nl RINUS_PASSWORD=wachtwoord npm run scrape
   ```

4. **Limiteer het aantal oefeningen** (voor testen):
   ```bash
   MAX_EXERCISES=10 npm run scrape
   ```

De scraper slaat de ruwe resultaten op in `data/exercises.json`. De dedupe-script maakt daarna een schonere `data/exercises-deduped.json`.

### Dashboard koppelen aan gescrapete data

Na het scrapen, update de data-bron in `dashboard/app.js`:

```javascript
// Verander deze regel:
const DATA_URL = '../data/sample-exercises.json';
// Naar:
const DATA_URL = '../data/exercises.json';
```

## 🎯 Dashboard Functies

- **Zoekbalk**: Zoek op titel, beschrijving, doelstelling of voetbalhandeling
- **Filters**: Filter op:
  - Speelfase (Aanvallen, Verdedigen, Omschakeling)
  - Type oefening (Warming-up, Technisch, Tactisch, Partijvorm, etc.)
  - Niveau (Beginner, Gemiddeld, Gevorderd)
  - Leeftijdsgroep (O8 t/m Senioren)
- **Oefening details**: Klik op een kaart voor volledige informatie:
  - Beschrijving en spelregels
  - Veldafmetingen en aantal spelers
  - Makkelijker/moeilijker maken stappen
  - Media (afbeeldingen en video's)
  - Link naar origineel op Rinus

## 📊 Data Schema

Elke oefening in de JSON database heeft de volgende structuur:

| Veld | Type | Beschrijving |
|------|------|-------------|
| `id` | string | Uniek ID |
| `title` | string | Naam van de oefening |
| `objective` | string | Doelstelling |
| `ageGroup` | string[] | Leeftijdsgroepen (O8, O10, etc.) |
| `playerCount` | object | `{ min, max }` |
| `fieldDimensions` | object | `{ length, width, unit }` |
| `durationMinutes` | number | Duur in minuten |
| `description` | string | Beschrijving / instructies |
| `gameRules` | string[] | Spelregels |
| `difficultySteps` | object | `{ easier: [], harder: [] }` |
| `footballAction` | string | Voetbalhandeling |
| `media` | object | `{ images: [], videos: [] }` |
| `sourceUrl` | string | Link naar Rinus |
| `tags` | object | Automatische categorisering |

### Automatische Categorisering

De scraper tagt oefeningen automatisch:

**Speelfase** (vertaald van Rinus doelstellingen):
- Aanvallen → Attacking
- Verdedigen → Defending
- Omschakelen naar aanvallen → Transition to Attack
- Omschakelen naar verdedigen → Transition to Defense

**Type oefening**:
- Voetbalfit/Opstartvorm → Warm-up
- Technisch → Technical
- Positiespel → Tactical
- Partijvorm → Small-Sided Game
- Keeper → Goalkeeper

## 🎨 Theming

Het dashboard gebruikt het Ik Dien kleurenschema:

| Element | Kleur |
|---------|-------|
| Primair (header, knoppen) | `#4E2F75` |
| Achtergrond | `#F5F3F7` |
| Tekst | `#1A1A2E` |
| Hover accenten | `#6B3FA0` |

Om de kleuren aan te passen, bewerk `dashboard/style.css` — alle kleuren staan als CSS custom properties bovenaan het bestand.

## 📱 Mobiel Gebruik

Het dashboard is ontworpen voor gebruik op het trainingsveld:
- **Mobile-first** responsive design
- Grote aanraakdoelen (min. 44px)
- Snelle zoek- en filterfunctie
- Werkt offline na eerste laden (statische bestanden)

## ⚖️ Disclaimer

Dit project scraped openbaar beschikbare oefeningen van het KNVB Rinus platform. De oefeningen zijn eigendom van de KNVB. Dit project is bedoeld voor persoonlijk gebruik door clubtrainers.
