const { normalize, compact, damerauLevenshtein, rankMatches } = require('./fuzzy');
const { termsFor, classifyQuery } = require('./dictionary');

const NO_GENERIC_MESSAGE = 'Sem genérico disponível';
const NONE_FOUND_MESSAGE = 'Nenhum genérico ou similar encontrado nas fontes agora.';

function suggestCorrection(typed, ranked) {
  const suggestions = (ranked.suggestions?.length ? ranked.suggestions : ranked.best ? [ranked.best] : [])
    .slice(0, 4)
    .map(s => ({ term: s.term, display: s.display, score: s.score }));
  return { type: 'suggest', typed, suggestions };
}

function compatible(query, term) {
  const qt = normalize(query).split(' ').filter(Boolean);
  const tt = normalize(term).split(' ').filter(Boolean);
  if (qt.length === tt.length) return true;
  const A = compact(query);
  const B = compact(term);
  return Math.abs(A.length - B.length) <= 1 && damerauLevenshtein(A, B) <= 2;
}

function autoFrom(typed, best) {
  return {
    searchQuery: best.term,
    correction: { type: 'auto', typed, term: best.term, display: best.display },
    zeroResult: null,
  };
}

function interpretQuery(raw, segment) {
  const typed = String(raw || '').trim().replace(/\s+/g, ' ');
  const normalized = normalize(typed);
  const dict = termsFor(segment);
  if (!normalized) return { searchQuery: '', correction: null, zeroResult: null };

  if (dict.some(d => d.term === normalized)) {
    return { searchQuery: typed, correction: null, zeroResult: null };
  }

  const full = rankMatches(normalized, dict.filter(d => compatible(normalized, d.term)));
  if (full.decision === 'auto') return autoFrom(typed, full.best);

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length > 1) {
    let changed = false;
    let amb = null;
    const next = tokens.map(tok => {
      if (tok.length < 5 || /\d/.test(tok)) return tok;
      if (dict.some(d => d.term === tok)) return tok;
      const r = rankMatches(tok, dict.filter(d => !d.term.includes(' ') || compatible(tok, d.term)));
      if (r.decision === 'auto') { changed = true; return r.best.term; }
      if (r.decision === 'suggest' && !amb) amb = r;
      return tok;
    });
    if (changed && !amb) {
      const term = next.join(' ');
      const display = next.map(tok => dict.find(d => d.term === tok)?.display || tok).join(' ');
      return { searchQuery: term, correction: { type: 'auto', typed, term, display }, zeroResult: null };
    }
    if (amb) return { searchQuery: typed, correction: suggestCorrection(typed, amb), zeroResult: null };
  }

  if (full.decision === 'suggest') return { searchQuery: typed, correction: suggestCorrection(typed, full), zeroResult: null };

  const loose = rankMatches(normalized, dict.filter(d => compatible(normalized, d.term)), { auto: 0.8, suggest: 0.68, gap: 0.04 });
  let zeroResult = null;
  if (loose.decision === 'auto') {
    zeroResult = { decision: 'auto', searchQuery: loose.best.term, correction: { type: 'auto', typed, term: loose.best.term, display: loose.best.display } };
  } else if (loose.best && loose.best.score >= 0.68) {
    zeroResult = { decision: 'suggest', correction: suggestCorrection(typed, { suggestions: loose.suggestions.length ? loose.suggestions : [loose.best] }) };
  }
  return { searchQuery: typed, correction: null, zeroResult };
}

function selectGenericOffers(items, brand, variant) {
  if (!brand) return [];
  const aliases = [...new Set([brand.term, normalize(brand.display)].filter(Boolean))];
  let list = (items || []).filter(i => {
    const t = normalize(`${i.title || ''} ${i.brand || ''}`);
    return !aliases.some(a => t.includes(a));
  });
  if (!brand.combination) list = list.filter(i => !(i.variant || '').startsWith('Combinações'));
  if (variant && variant !== 'Outros' && !String(variant).startsWith('Combinações')) {
    const same = list.filter(i => i.variant === variant);
    if (same.length) list = same;
  }
  return [...list].sort((a, b) => a.price - b.price);
}

function savingsBetween(brandOffers, genericOffers) {
  const b = brandOffers?.[0]?.price;
  const g = genericOffers?.[0]?.price;
  if (b == null || g == null || !(b > g)) return null;
  return { amount: +((b - g).toFixed(2)), pct: Math.round((1 - g / b) * 100) };
}

module.exports = {
  interpretQuery,
  selectGenericOffers,
  savingsBetween,
  classifyQuery,
  NO_GENERIC_MESSAGE,
  NONE_FOUND_MESSAGE,
};
