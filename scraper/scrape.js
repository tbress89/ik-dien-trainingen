/**
 * KNVB Rinus Recursive Spider Scraper
 * ===================================
 * Crawls exercises recursively using the "Vergelijkbare Oefeningen" graph
 * to discover and extract a large library of official KNVB exercises and SVG diagrams.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PHASE_MAP = {
  'aanvallen': 'Attacking',
  'opbouwen': 'Attacking',
  'benutten': 'Attacking',
  'scoren': 'Attacking',
  'vrijlopen': 'Attacking',
  'voorbereiden': 'Attacking',
  'verdedigen': 'Defending',
  'druk zetten': 'Defending',
  'veroveren': 'Defending',
  'voorkomen': 'Defending',
  'storen': 'Defending',
  'omschakelen naar aanval': 'Transition to Attack',
  'omschakelen naar verdedigen': 'Transition to Defense',
  'omschakeling': 'Transition to Attack',
};

const DRILL_MAP = {
  'voetbalfit': 'Warm-up',
  'opstartvorm': 'Warm-up',
  'warming': 'Warm-up',
  'lijnvoetbal': 'Small-Sided Game',
  'partij': 'Small-Sided Game',
  'positiespel': 'Tactical',
  'tactisch': 'Tactical',
  'technisch': 'Technical',
  'oversteek': 'Small-Sided Game',
  'passen': 'Technical',
  'dribbelen': 'Technical',
  'afronden': 'Technical',
  'keeper': 'Goalkeeper',
};

function mapPhase(text) {
  const t = (text || '').toLowerCase();
  for (const [k, v] of Object.entries(PHASE_MAP)) {
    if (t.includes(k)) return v;
  }
  return 'Attacking';
}

function mapType(title, obj) {
  const full = (title + ' ' + obj).toLowerCase();
  for (const [k, v] of Object.entries(DRILL_MAP)) {
    if (full.includes(k)) return v;
  }
  if (full.includes('tegen') || full.includes('v') || full.includes('+')) return 'Small-Sided Game';
  return 'Technical';
}

function mapDifficulty(age) {
  const num = parseInt((age || '').replace(/\D/g, '')) || 12;
  if (num <= 9) return 'Beginner';
  if (num <= 14) return 'Intermediate';
  return 'Advanced';
}

(async () => {
  const TARGET_EXERCISE_COUNT = process.env.MAX_EXERCISES ? parseInt(process.env.MAX_EXERCISES) : 40;
  console.log(`🕷️ Starting KNVB Rinus Spider Scraper (Target: ${TARGET_EXERCISE_COUNT} exercises)...`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'nl-NL'
  });
  const page = await context.newPage();
  
  // Seed queue with overview exercises
  console.log('Fetching seed exercises from overview...');
  await page.goto('https://rinus.knvb.nl/overview/exercises', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2500);
  
  const seedHrefs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/exercise/id/"]'))
      .map(a => a.getAttribute('href'))
      .filter(Boolean);
  });
  
  const queue = [...new Set(seedHrefs)];
  const visited = new Set();
  const extracted = [];
  
  console.log(`Starting with ${queue.length} seed links in queue.\n`);
  
  while (queue.length > 0 && extracted.length < TARGET_EXERCISE_COUNT) {
    const href = queue.shift();
    if (visited.has(href)) continue;
    visited.add(href);
    
    const exerciseUrl = href.startsWith('http') ? href : 'https://rinus.knvb.nl' + href;
    const progress = `[${extracted.length + 1}/${TARGET_EXERCISE_COUNT}]`;
    
    try {
      await page.goto(exerciseUrl, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForTimeout(1000);
      
      const parsedData = await page.evaluate(() => {
        const text = document.body.innerText;
        const title = document.querySelector('h1, h2, [class*="Title"], [class*="title"]')?.textContent?.trim() || '';
        
        // Find official KNVB SVG diagrams
        const imgs = Array.from(document.querySelectorAll('img'))
          .map(i => i.getAttribute('src') || i.currentSrc)
          .filter(s => s && s.includes('azureedge.net/images/exercise'));
        
        // Find similar exercises links to populate queue
        const similarHrefs = Array.from(document.querySelectorAll('a[href*="/exercise/id/"]'))
          .map(a => a.getAttribute('href'))
          .filter(Boolean);
        
        const detailBlocks = Array.from(document.querySelectorAll('.DetailBlock, [class*="DetailBlock"]'));
        
        let spelregels = [];
        let makkelijker = [];
        let moeilijker = [];
        let aandachtspunten = [];
        let bedoeling = [];
        let voetbalhandeling = '';
        let objective = '';
        let length = 30;
        let width = 20;
        
        // Objective
        const objBlock = document.querySelector('[class*="objective"], [class*="Objective"]');
        if (objBlock) {
          objective = objBlock.textContent.trim();
        } else {
          const match = text.match(/DOELSTELLING\s*\n+([^\n]+)/i);
          if (match) objective = match[1].trim();
        }
        
        for (const block of detailBlocks) {
          const blockText = block.innerText;
          
          // Afmetingen
          if (blockText.includes('Lengte:') || blockText.includes('Breedte:')) {
            const lMatch = blockText.match(/Lengte:\s*(\d+)\s*meter/i);
            const wMatch = blockText.match(/Breedte:\s*(\d+)\s*meter/i);
            if (lMatch) length = parseInt(lMatch[1]);
            if (wMatch) width = parseInt(wMatch[1]);
          }
          
          // Spelregels
          if (blockText.includes('SPELREGELS') || blockText.includes('Spelregels')) {
            const lists = block.querySelectorAll('ul, ol');
            lists.forEach(l => {
              const items = Array.from(l.querySelectorAll('li'))
                .map(li => li.innerText.trim())
                .filter(item => item.length > 3 && !item.includes('Lengte:') && !item.includes('Breedte:'));
              spelregels.push(...items);
            });
          }
          
          // Makkelijker / Moeilijker maken
          if (blockText.includes('Makkelijker') || blockText.includes('moeilijker')) {
            const allUls = Array.from(block.querySelectorAll('ul, ol'));
            if (allUls.length >= 2) {
              makkelijker = Array.from(allUls[0].querySelectorAll('li')).map(li => li.innerText.trim()).filter(Boolean);
              moeilijker = Array.from(allUls[1].querySelectorAll('li')).map(li => li.innerText.trim()).filter(Boolean);
            } else if (allUls.length === 1) {
              makkelijker = Array.from(allUls[0].querySelectorAll('li')).map(li => li.innerText.trim()).filter(Boolean);
            }
          }
          
          // Bedoeling van de oefening & Aandachtspunten
          if (blockText.includes('Bedoeling van de oefening')) {
            const paragraphs = Array.from(block.querySelectorAll('p, [class*="content"], [class*="text"]'))
              .map(p => p.innerText.trim())
              .filter(Boolean);
            
            bedoeling = paragraphs.filter(p => 
              !p.includes('AANDACHTSPUNTEN') && 
              !p.includes('VOETBALHANDELING') && 
              !p.includes('Doelstelling') &&
              p.length > 5
            );
            
            // Voetbalhandeling
            const vhEl = Array.from(block.querySelectorAll('div, p, span')).find(d => d.innerText.includes('VOETBALHANDELING'));
            if (vhEl) {
              voetbalhandeling = vhEl.innerText.trim().replace(/^VOETBALHANDELING\s*[-:]?\s*/i, '');
            }
            
            // Aandachtspunten
            const apLists = block.querySelectorAll('ul, ol');
            apLists.forEach(l => {
              const items = Array.from(l.querySelectorAll('li')).map(li => li.innerText.trim()).filter(Boolean);
              aandachtspunten.push(...items);
            });
          }
        }
        
        // Properties
        const playerMatch = text.match(/(\d+)\s*-\s*(\d+)\s*spelers/i) || text.match(/(\d+)\s*spelers/i);
        const ageMatch = text.match(/\b(O\d+(?:\s*&\s*O\d+)?|Senioren)\b/i);
        const durMatch = text.match(/(\d+)\s*min/i);
        
        return {
          title,
          objective,
          imgs,
          similarHrefs,
          length,
          width,
          minPlayers: playerMatch ? parseInt(playerMatch[1]) : 6,
          maxPlayers: playerMatch && playerMatch[2] ? parseInt(playerMatch[2]) : (playerMatch ? parseInt(playerMatch[1]) : 10),
          age: ageMatch ? ageMatch[1] : 'O12',
          duration: durMatch ? parseInt(durMatch[1]) : 15,
          spelregels: Array.from(new Set(spelregels)),
          makkelijker: Array.from(new Set(makkelijker)),
          moeilijker: Array.from(new Set(moeilijker)),
          bedoeling: Array.from(new Set(bedoeling)),
          voetbalhandeling,
          aandachtspunten: Array.from(new Set(aandachtspunten))
        };
      });
      
      // Enqueue new discovered links
      if (parsedData.similarHrefs) {
        for (const sHref of parsedData.similarHrefs) {
          if (!visited.has(sHref) && !queue.includes(sHref)) {
            queue.push(sHref);
          }
        }
      }
      
      if (!parsedData.title) continue;
      
      const realOfficialImage = parsedData.imgs[0] || '';
      const idMatch = href.match(/\d+/);
      const exId = idMatch ? 'rinus-' + idMatch[0] : 'rinus-' + (extracted.length + 1);
      
      const phase = mapPhase(parsedData.objective);
      const drillType = mapType(parsedData.title, parsedData.objective);
      const diff = mapDifficulty(parsedData.age);
      
      let fullDescription = '';
      if (parsedData.bedoeling.length > 0) {
        fullDescription = parsedData.bedoeling.join('\n\n');
      } else if (parsedData.spelregels.length > 0) {
        fullDescription = parsedData.spelregels.join(' ');
      } else {
        fullDescription = parsedData.objective;
      }
      
      const item = {
        id: exId,
        title: parsedData.title,
        objective: parsedData.objective || 'Voetbalhandeling verbeteren',
        ageGroup: [parsedData.age],
        playerCount: {
          min: parsedData.minPlayers,
          max: parsedData.maxPlayers
        },
        fieldDimensions: {
          length: parsedData.length,
          width: parsedData.width,
          unit: 'meter'
        },
        durationMinutes: parsedData.duration,
        description: fullDescription,
        purpose: parsedData.bedoeling.length > 0 ? parsedData.bedoeling : [parsedData.objective],
        gameRules: parsedData.spelregels.length > 0 ? parsedData.spelregels : ['Speel volgens officiële KNVB richtlijnen.'],
        coachingPoints: parsedData.aandachtspunten,
        difficultySteps: {
          easier: parsedData.makkelijker.length > 0 ? parsedData.makkelijker : ['Veld breder en/of langer maken voor meer tijd en ruimte'],
          harder: parsedData.moeilijker.length > 0 ? parsedData.moeilijker : ['Veld smaller en/of korter maken voor meer weerstand']
        },
        footballAction: parsedData.voetbalhandeling || parsedData.objective.split(' ')[0] || 'Passen',
        media: {
          images: realOfficialImage ? [realOfficialImage] : [],
          videos: []
        },
        sourceUrl: exerciseUrl,
        tags: {
          phaseOfPlay: phase,
          drillType: drillType,
          difficultyLevel: diff
        }
      };
      
      extracted.push(item);
      console.log(`${progress} ✓ Extracted: "${item.title}" (${item.tags.phaseOfPlay} / ${item.tags.drillType} / ${item.ageGroup.join(',')}) [Queue: ${queue.length}]`);
      
      // Auto-save periodically every 5 items
      if (extracted.length % 5 === 0 || extracted.length === TARGET_EXERCISE_COUNT) {
        const dataDir = path.join(__dirname, '..', 'data');
        fs.writeFileSync(path.join(dataDir, 'exercises.json'), JSON.stringify(extracted, null, 2), 'utf-8');
        fs.writeFileSync(path.join(dataDir, 'sample-exercises.json'), JSON.stringify(extracted, null, 2), 'utf-8');
        fs.writeFileSync(
          path.join(dataDir, 'exercises-data.js'),
          '// Ik Dien - KNVB Rinus Officiële Oefeningen & Diagrammen\nwindow.EXERCISES_DATA = ' + JSON.stringify(extracted, null, 2) + ';\n',
          'utf-8'
        );
      }
      
    } catch (e) {
      console.error(`${progress} ✗ Error on ${exerciseUrl}:`, e.message);
    }
  }
  
  await browser.close();
  
  console.log(`\n🎉 Spider scraping complete! Successfully stored ${extracted.length} total exercises with diagrams in database.`);
})().catch(console.error);
