// Word error rate scoring of STT output against DementiaBank CHAT (.cha) transcripts.

const FILLERS = new Set(['uh', 'um', 'er', 'erm', 'ah', 'eh', 'hm', 'hmm', 'mm', 'mhm', 'uhm', 'uhhuh']);
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
// Spelling variants with the same meaning, applied to both sides before scoring (in the spirit of
// Whisper's English text normaliser). Generic noun + 's stays as-is: it may be possessive.
const EQUIVALENTS = [
  [/\bwon't\b/g, 'will not'], [/\bcan't\b/g, 'can not'], [/\bcannot\b/g, 'can not'], [/\bshan't\b/g, 'shall not'],
  [/\blet's\b/g, 'let us'], [/\bain't\b/g, 'aint'], [/n't\b/g, ' not'],
  [/\b(it|that|there|here|what|where|who|how|he|she)'s\b/g, '$1 is'],
  [/'re\b/g, ' are'], [/'ll\b/g, ' will'], [/'ve\b/g, ' have'], [/'m\b/g, ' am'], [/'d\b/g, ' would'],
  [/\bgonna\b/g, 'going to'], [/\bwanna\b/g, 'want to'], [/\bgotta\b/g, 'got to'], [/\boutta\b/g, 'out of'],
  [/\bkinda\b/g, 'kind of'], [/\bsorta\b/g, 'sort of'], [/\blotta\b/g, 'lot of'], [/\bdunno\b/g, 'do not know'],
  [/\b(cuz|coz|cos)\b/g, 'because'], [/\bok\b/g, 'okay'], [/\balright\b/g, 'all right'],
];
// CHAT media bullets use NAK (U+0015); some exports render them as "•".
const BULLET = /[\u0015•](\d+)_(\d+)[\u0015•]/;

function numberToWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numberToWords(n % 100) : '');
  if (n < 10000) return numberToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numberToWords(n % 1000) : '');
  return String(n);
}

// Parses a .cha file into speaker tiers, joining tab-indented continuation lines.
export function parseCha(text) {
  const utterances = [];
  const ids = {};
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('\t') && utterances.length && !utterances.at(-1).closed) {
      utterances.at(-1).raw += ' ' + line.trim();
    } else if (line.startsWith('*')) {
      const match = line.match(/^\*(\w+):\s*(.*)$/);
      if (match) utterances.push({ speaker: match[1], raw: match[2] });
    } else {
      if (utterances.length) utterances.at(-1).closed = true;
      // @ID: language|corpus|code|age|sex|group|SES|role|education|custom|
      const id = line.match(/^@ID:\s*(.*)$/);
      if (id) {
        const fields = id[1].split('|');
        ids[fields[2]] = { group: fields[5] || '', age: fields[3]?.replace(/;$/, '') || '', sex: fields[4] || '' };
      }
    }
  }
  return {
    ids,
    utterances: utterances.map(({ speaker, raw }) => {
      const bullet = raw.match(BULLET);
      return {
        speaker,
        raw: raw.replace(new RegExp(BULLET.source, 'g'), '').trim(),
        startMs: bullet ? Number(bullet[1]) : null,
        endMs: bullet ? Number(bullet[2]) : null,
      };
    }),
  };
}

// Converts a CHAT utterance to plain words. Both modes keep retraced (repeated or self-corrected)
// words, because they were spoken and STT models usually transcribe them.
// verbatim also keeps fillers (uh, um) and word fragments; clean drops them.
export function cleanChatUtterance(raw, { mode = 'clean' } = {}) {
  let text = raw;
  text = text.replace(/\(\d*\.+\d*\)/g, ' ');                 // pauses: (.) (..) (2.5)
  text = text.replace(/&=\S+/g, ' ');                         // events: &=laughs
  if (mode === 'clean') {
    text = text.replace(/&[-+~]?\S+/g, ' ');                  // fillers and fragments
    text = text.replace(/(\w*)\((\w+)\)(\w*)/g, '$1$2$3');    // (be)cause -> because
  } else {
    text = text.replace(/&[-+~]?(\S+)/g, '$1');
    text = text.replace(/\(\w+\)/g, '');                      // (be)cause -> cause, as spoken
  }
  text = text.replace(/\[[^\]]*\]/g, ' ');                    // remaining [codes]
  text = text.replace(/[<>]/g, ' ');
  text = text.replace(/(^|\s)(xxx|yyy|www)(?=\s|$)/g, ' ');   // unintelligible or untranscribed
  text = text.replace(/(^|\s)0\S+/g, ' ');                    // omitted words: 0is
  text = text.replace(/(^|\s)\+\S*/g, ' ');                   // +... +/. +< linkers and terminators
  text = text.replace(/@\w+(:\w+)?/g, '');                    // word@l special-form markers
  text = text.replace(/_/g, ' ');                             // ice_cream
  text = text.replace(/[:ˈˌ↑↓^≠‡„]/g, '');                    // lengthening, stress, intonation
  return text.replace(/\s+/g, ' ').trim();
}

// Lowercases, strips punctuation, spells out numbers and expands contractions and casual
// spellings so both sides use the same conventions.
export function normalizeWords(text, { dropFillers = true } = {}) {
  const words = EQUIVALENTS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text
    .toLowerCase()
    .replace(/[‘’]/g, "'"))
    .replace(/\d+/g, digits => ' ' + numberToWords(Number(digits)) + ' ')
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .map(word => word.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
  return dropFillers ? words.filter(word => !FILLERS.has(word)) : words;
}

// Word-level Levenshtein alignment.
export function wordErrorRate(reference, hypothesis) {
  const ref = Array.isArray(reference) ? reference : normalizeWords(reference);
  const hyp = Array.isArray(hypothesis) ? hypothesis : normalizeWords(hypothesis);
  const rows = ref.length + 1, cols = hyp.length + 1;
  const cost = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      cost[i][j] = Math.min(
        cost[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1),
        cost[i - 1][j] + 1,
        cost[i][j - 1] + 1,
      );
    }
  }
  let i = ref.length, j = hyp.length, substitutions = 0, deletions = 0, insertions = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1)) {
      if (ref[i - 1] !== hyp[j - 1]) substitutions++;
      i--; j--;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      deletions++; i--;
    } else {
      insertions++; j--;
    }
  }
  const errors = substitutions + deletions + insertions;
  return {
    referenceWords: ref.length, hypothesisWords: hyp.length,
    substitutions, deletions, insertions, errors,
    wer: ref.length ? errors / ref.length : (hyp.length ? 1 : 0),
  };
}

// Deterministic PRNG so confidence intervals are reproducible run to run.
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 95% CI for corpus WER (or a paired WER difference) by resampling speakers, not clips:
// clips from one speaker are correlated, so clip-level resampling would overstate confidence.
// speakers: [{ errors, words }] or, for a paired difference, [{ errors, words, errorsB, wordsB }].
export function bootstrapWer(speakers, { iterations = 2000, seed = 1 } = {}) {
  const random = mulberry32(seed);
  const statistic = sample => {
    const sum = key => sample.reduce((total, s) => total + s[key], 0);
    const wer = sum('errors') / sum('words');
    return 'errorsB' in sample[0] ? sum('errorsB') / sum('wordsB') - wer : wer;
  };
  const estimates = Array.from({ length: iterations }, () =>
    statistic(Array.from(speakers, () => speakers[Math.floor(random() * speakers.length)]))).sort((a, b) => a - b);
  return { estimate: statistic(speakers), low: estimates[Math.floor(0.025 * iterations)], high: estimates[Math.ceil(0.975 * iterations) - 1] };
}

// Corpus WER is total errors over total reference words, so long clips weigh more than short ones.
export function summarizeWer(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    if (row.status !== 'ok') continue;
    const key = keyOf(row);
    const group = groups.get(key) ?? { key, clips: 0, referenceWords: 0, errors: 0, verbatimReferenceWords: 0, verbatimErrors: 0,
      substitutions: 0, deletions: 0, insertions: 0, latencies: [] };
    group.clips++;
    group.referenceWords += row.referenceWords;
    group.errors += row.errors;
    group.substitutions += row.substitutions;
    group.deletions += row.deletions;
    group.insertions += row.insertions;
    group.verbatimReferenceWords += row.verbatimReferenceWords;
    group.verbatimErrors += row.verbatimErrors;
    group.latencies.push(row.latencyMs);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ latencies, ...group }) => {
    const sorted = latencies.sort((a, b) => a - b);
    return {
      ...group,
      wer: group.referenceWords ? group.errors / group.referenceWords : null,
      verbatimWer: group.verbatimReferenceWords ? group.verbatimErrors / group.verbatimReferenceWords : null,
      medianLatencyMs: sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null,
    };
  });
}
