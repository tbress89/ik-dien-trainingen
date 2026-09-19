const fs = require('fs');
const path = require('path');

const STOP_WORDS = new Set([
  'de', 'het', 'een', 'met', 'op', 'van', 'voor', 'naar', 'door', 'bij', 'in', 'uit', 'over', 'onder', 'en', 'of', 'te', 'tot', 'na', 'via', 'zonder', 'rechts', 'links', 'lang', 'breed', 'smal', 'plus', 'k', 'met', 'tegen', 'doel', 'doelen', 'spel', 'spelen', 'vorm', 'speler', 'spelers', 'veld', 'doel', 'grote', 'kleine', 'neutrale', 'vrij', 'makkelijker', 'moeilijker'
]);

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' en ')
    .replace(/[+]/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(title) {
  return normalizeText(title)
    .replace(/\bplus\b/g, 'plus')
    .replace(/\b(?:k|kk)\b/g, 'k');
}

function titleTokens(title) {
  return normalizeTitle(title)
    .split(' ')
    .filter(Boolean)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

function arrayUnique(items = []) {
  return [...new Set(items.filter(Boolean).map(item => String(item).trim()).filter(Boolean))];
}

function mergeMedia(primary = {}, secondary = {}) {
  return {
    images: arrayUnique([...(primary.images || []), ...(secondary.images || [])]),
    videos: arrayUnique([...(primary.videos || []), ...(secondary.videos || [])])
  };
}

function mergeDifficulty(primary = {}, secondary = {}) {
  return {
    easier: arrayUnique([...(primary.easier || []), ...(secondary.easier || [])]),
    harder: arrayUnique([...(primary.harder || []), ...(secondary.harder || [])])
  };
}

function isWithinPlayerTolerance(a, b) {
  if (!a || !b) return true;
  const minA = Number(a.min) || 0;
  const minB = Number(b.min) || 0;
  const maxA = Number(a.max) || minA;
  const maxB = Number(b.max) || minB;

  return Math.abs(minA - minB) <= 2 && Math.abs(maxA - maxB) <= 2;
}

function sameFieldProfile(a, b) {
  if (!a || !b) return true;
  const aLen = Number(a.length) || 0;
  const aWid = Number(a.width) || 0;
  const bLen = Number(b.length) || 0;
  const bWid = Number(b.width) || 0;

  return Math.abs(aLen - bLen) <= 5 && Math.abs(aWid - bWid) <= 5;
}

function titleSimilarity(left, right) {
  const a = titleTokens(left);
  const b = titleTokens(right);

  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;

  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(token => setB.has(token)).length;
  const union = new Set([...setA, ...setB]).size || 1;
  const jaccard = intersection / union;

  const normalizedA = normalizeTitle(left);
  const normalizedB = normalizeTitle(right);
  const exactNormalized = normalizedA === normalizedB ? 1 : 0;

  return Math.max(jaccard, exactNormalized);
}

function exerciseRichness(exercise) {
  return [
    exercise.description ? 15 : 0,
    exercise.objective ? 10 : 0,
    (exercise.gameRules || []).length * 2,
    (exercise.coachingPoints || []).length * 2,
    (exercise.purpose || []).length * 2,
    (exercise.media && exercise.media.images ? exercise.media.images.length * 3 : 0),
    exercise.sourceUrl ? 5 : 0
  ].reduce((total, value) => total + value, 0);
}

function mergeExercise(primary, duplicate) {
  const merged = { ...primary, ...duplicate };

  merged.title = primary.title || duplicate.title;
  merged.objective = primary.objective || duplicate.objective;
  merged.description = primary.description || duplicate.description;
  merged.sourceUrl = primary.sourceUrl || duplicate.sourceUrl;
  merged.footballAction = primary.footballAction || duplicate.footballAction;
  merged.tags = { ...(duplicate.tags || {}), ...(primary.tags || {}) };
  merged.media = mergeMedia(primary.media, duplicate.media);
  merged.difficultySteps = mergeDifficulty(primary.difficultySteps, duplicate.difficultySteps);

  merged.purpose = arrayUnique([...(primary.purpose || []), ...(duplicate.purpose || [])]);
  merged.gameRules = arrayUnique([...(primary.gameRules || []), ...(duplicate.gameRules || [])]);
  merged.coachingPoints = arrayUnique([...(primary.coachingPoints || []), ...(duplicate.coachingPoints || [])]);

  return merged;
}

function pickPrimaryRecord(group) {
  return group.reduce((best, current) => {
    return exerciseRichness(current) > exerciseRichness(best) ? current : best;
  }, group[0]);
}

function buildExactKey(exercise) {
  const title = normalizeTitle(exercise.title);
  if (title) {
    return title;
  }

  const action = normalizeText(exercise.footballAction);
  const players = exercise.playerCount || {};
  const field = exercise.fieldDimensions || {};

  return [
    action,
    `${Number(players.min) || 0}-${Number(players.max) || Number(players.min) || 0}`,
    `${Number(field.length) || 0}-${Number(field.width) || 0}`
  ].join('|');
}

function deduplicateExercises(exercises = []) {
  const exactGroups = new Map();
  const exactReport = [];

  for (const exercise of exercises) {
    const key = buildExactKey(exercise);
    if (!exactGroups.has(key)) {
      exactGroups.set(key, []);
    }
    exactGroups.get(key).push(exercise);
  }

  const deduplicated = [];
  const duplicateIdsByPrimary = new Map();

  for (const group of exactGroups.values()) {
    const primary = pickPrimaryRecord(group);
    const duplicates = group.filter(exercise => exercise.id !== primary.id).map(exercise => exercise.id);

    if (duplicates.length > 0) {
      duplicateIdsByPrimary.set(primary.id, duplicates);
      exactReport.push({
        primaryId: primary.id,
        primaryTitle: primary.title,
        duplicateIds: duplicates,
        reason: 'exact title + metadata match'
      });
    }

    deduplicated.push(primary);
  }

  const nearDuplicateReport = [];
  const final = [];
  const usedPrimaryIds = new Set();

  for (const exercise of deduplicated) {
    const existingMatch = final.find(candidate => {
      if (candidate.id === exercise.id || usedPrimaryIds.has(candidate.id)) {
        return false;
      }

      const samePhase = (candidate.tags && candidate.tags.phaseOfPlay) === (exercise.tags && exercise.tags.phaseOfPlay);
      const sameAction = (candidate.footballAction || '').toLowerCase() === (exercise.footballAction || '').toLowerCase();
      const titleScore = titleSimilarity(candidate.title, exercise.title);
      const playerMatch = isWithinPlayerTolerance(candidate.playerCount, exercise.playerCount);
      const fieldMatch = sameFieldProfile(candidate.fieldDimensions, exercise.fieldDimensions);

      return samePhase && sameAction && titleScore >= 0.75 && playerMatch && fieldMatch;
    });

    if (!existingMatch) {
      final.push(exercise);
      usedPrimaryIds.add(exercise.id);
      continue;
    }

    const merged = mergeExercise(existingMatch, exercise);
    nearDuplicateReport.push({
      primaryId: existingMatch.id,
      duplicateId: exercise.id,
      primaryTitle: existingMatch.title,
      duplicateTitle: exercise.title,
      reason: 'near-duplicate with same phase/action and similar title'
    });

    const index = final.indexOf(existingMatch);
    final[index] = merged;
  }

  const duplicateEntriesRemoved = exercises.length - final.length;

  return {
    deduplicated: final,
    report: {
      originalCount: exercises.length,
      deduplicatedCount: final.length,
      duplicateEntriesRemoved,
      exactDuplicateGroups: exactReport.length,
      nearDuplicateGroups: nearDuplicateReport.length,
      exactMatches: exactReport,
      nearMatches: nearDuplicateReport
    }
  };
}

function writeExerciseDataFile(filePath, exercises) {
  fs.writeFileSync(filePath, 'window.EXERCISES_DATA = ' + JSON.stringify(exercises, null, 2) + ';\n', 'utf-8');
}

function writeDatasetFiles(outputDir, exercises) {
  const deduped = deduplicateExercises(exercises);

  const dedupedJsonPath = path.join(outputDir, 'exercises-deduped.json');
  const sampleJsonPath = path.join(outputDir, 'sample-exercises.json');
  const jsDataPath = path.join(outputDir, 'exercises-data.js');
  const reportPath = path.join(outputDir, 'dedupe-report.json');

  fs.writeFileSync(dedupedJsonPath, JSON.stringify(deduped.deduplicated, null, 2), 'utf-8');
  fs.writeFileSync(sampleJsonPath, JSON.stringify(deduped.deduplicated, null, 2), 'utf-8');
  writeExerciseDataFile(jsDataPath, deduped.deduplicated);
  fs.writeFileSync(reportPath, JSON.stringify(deduped.report, null, 2), 'utf-8');

  return deduped;
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const dataDir = path.join(rootDir, 'data');
  const inputPath = path.join(dataDir, 'exercises.json');

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Data file not found: ${inputPath}`);
  }

  const exercises = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const result = writeDatasetFiles(dataDir, exercises);
  console.log(`Original count: ${result.report.originalCount}`);
  console.log(`Deduplicated count: ${result.report.deduplicatedCount}`);
  console.log(`Removed duplicate entries: ${result.report.duplicateEntriesRemoved}`);
  console.log(`Exact duplicate groups: ${result.report.exactDuplicateGroups}`);
  console.log(`Near-duplicate groups: ${result.report.nearDuplicateGroups}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  deduplicateExercises,
  writeDatasetFiles,
  normalizeTitle,
  titleSimilarity,
  buildExactKey,
  mergeExercise
};
