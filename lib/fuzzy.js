// Typo tolerance: Damerau-Levenshtein, trigram Dice and a small PT-BR phonetic key.
// Comparison is accent-insensitive and case-insensitive.

function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(s) {
  return normalize(s).replace(/[^a-z0-9]/g, '').replace(/(.)\1+/g, '$1');
}

function damerauLevenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = v;
    }
  }
  return dp[m][n];
}

function trigrams(s) {
  const t = `  ${s}  `;
  const bag = new Map();
  for (let i = 0; i < t.length - 2; i++) {
    const g = t.slice(i, i + 3);
    bag.set(g, (bag.get(g) || 0) + 1);
  }
  return bag;
}

function trigramSimilarity(a, b) {
  const A = trigrams(compact(a));
  const B = trigrams(compact(b));
  let sa = 0;
  let sb = 0;
  let inter = 0;
  for (const v of A.values()) sa += v;
  for (const v of B.values()) sb += v;
  for (const [k, v] of A) if (B.has(k)) inter += Math.min(v, B.get(k));
  return sa + sb ? (2 * inter) / (sa + sb) : 0;
}

// Rough PT-BR key: silent h, c/s/z/x and ge/gi merges, vowel groups collapsed.
function phoneticKey(input) {
  let s = compact(input);
  if (!s) return '';
  const rules = [
    [/ph/g, 'f'],
    [/th/g, 't'],
    [/qu/g, 'k'],
    [/ch/g, 'x'],
    [/sh/g, 'x'],
    [/lh/g, 'l'],
    [/nh/g, 'n'],
    [/g([ei])/g, 'j$1'],
    [/c([ei])/g, 's$1'],
    [/ss/g, 's'],
    [/rr/g, 'r'],
    [/sc(?=[ei])/g, 's'],
    [/y/g, 'i'],
    [/w/g, 'v'],
    [/k/g, 'c'],
    [/q/g, 'c'],
    [/z/g, 's'],
    [/x/g, 's'],
    [/h/g, ''],
    [/[aeiou]+/g, 'a'],
    [/(.)\1+/g, '$1'],
  ];
  for (const [re, to] of rules) s = s.replace(re, to);
  return s;
}

function consonantSkeleton(input) {
  return phoneticKey(input).replace(/[aeiou]/g, '');
}

function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  const bag = new Map();
  for (const ch of a) bag.set(ch, (bag.get(ch) || 0) + 1);
  for (const ch of b) {
    const n = bag.get(ch);
    if (!n) return false;
    if (n === 1) bag.delete(ch);
    else bag.set(ch, n - 1);
  }
  return bag.size === 0;
}

function similarity(a, b) {
  const A = compact(a);
  const B = compact(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const d = damerauLevenshtein(A, B);
  const prefix = A.length >= 5 && B.startsWith(A) && (B.length - A.length) <= 8;
  if (A[0] !== B[0] && d > 1 && !prefix) return 0;
  if (Math.abs(A.length - B.length) > 3 && d > 1 && !prefix) return 0;
  const maxL = Math.max(A.length, B.length);
  const cA = consonantSkeleton(A);
  const cB = consonantSkeleton(B);
  const skEqual = cA.length >= 4 && cA === cB;
  const maxD = maxL <= 6 ? 1 : maxL <= 10 ? 2 : maxL <= 14 ? 3 : 4;
  if (d > maxD && !skEqual && !prefix) return 0;
  const dl = 1 - d / maxL;
  const tri = trigramSimilarity(A, B);
  const pA = phoneticKey(A);
  const pB = phoneticKey(B);
  const phon = pA === pB ? 1 : 1 - damerauLevenshtein(pA, pB) / Math.max(pA.length, pB.length, 1);
  const sk = skEqual ? 1 : (cA && cB ? Math.max(0, 1 - damerauLevenshtein(cA, cB) / Math.max(cA.length, cB.length)) : 0);
  let score = 0.4 * dl + 0.25 * tri + 0.15 * phon + 0.2 * sk;
  if (d === 1 && Math.min(A.length, B.length) >= 5) score = Math.max(score, 0.91);
  if (d === 2 && Math.min(A.length, B.length) >= 8 && phon >= 0.75) score = Math.max(score, 0.84);
  if (skEqual && Math.abs(A.length - B.length) <= 2 && A[0] === B[0] && d <= 2) score = Math.max(score, 0.88);
  if (skEqual && sameMultiset(A, B)) score = Math.max(score, 0.9);
  if (prefix) score = Math.max(score, 0.9);
  if (A.slice(0, 4) === B.slice(0, 4)) score += 0.02;
  return Math.min(0.99, score);
}

function rankMatches(query, dict, opts = {}) {
  const autoT = opts.auto ?? 0.86;
  const suggestT = opts.suggest ?? 0.75;
  const gapT = opts.gap ?? 0.05;
  const q = normalize(query);
  const cq = compact(q);
  if (cq.length < 4) return { decision: null, best: null, suggestions: [] };
  const scored = [];
  for (const entry of dict) {
    const ct = compact(entry.term);
    const lenDiff = Math.abs(ct.length - cq.length);
    const asPrefix = cq.length >= 5 && ct.startsWith(cq) && ct.length - cq.length <= 8;
    if (lenDiff > Math.max(4, Math.ceil(cq.length * 0.65)) && !asPrefix) continue;
    const score = similarity(q, entry.term);
    if (score >= Math.min(suggestT, 0.68) - 0.02) {
      scored.push({ term: entry.term, display: entry.display, score, lenDiff });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.lenDiff - b.lenDiff || b.term.length - a.term.length || a.term.localeCompare(b.term));
  const best = scored[0] || null;
  const second = scored[1] || null;
  if (!best) return { decision: null, best: null, suggestions: [] };
  const gap = second ? best.score - second.score : 1;
  let decision = null;
  if (best.score >= autoT && (gap >= gapT || best.score >= 0.93)) decision = 'auto';
  else if (best.score >= suggestT) decision = 'suggest';
  if (decision === 'auto' && second && best.score - second.score < 0.03 && second.score >= autoT - 0.04) decision = 'suggest';
  const suggestions = scored.filter(s => s.score >= suggestT - 0.02).slice(0, 4);
  return { decision, best, suggestions };
}

module.exports = {
  normalize,
  compact,
  damerauLevenshtein,
  trigramSimilarity,
  phoneticKey,
  consonantSkeleton,
  similarity,
  rankMatches,
};
