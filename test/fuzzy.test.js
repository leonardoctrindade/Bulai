const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalize, damerauLevenshtein, trigramSimilarity, phoneticKey, consonantSkeleton, similarity, rankMatches,
} = require('../lib/fuzzy');
const { interpretQuery } = require('../lib/resolve');
const { stats } = require('../lib/dictionary');

test('damerau-levenshtein counts an adjacent transposition as one edit', () => {
  assert.equal(damerauLevenshtein('losartana', 'losatrana'), 1);
  assert.equal(damerauLevenshtein('dipirona', 'dipirona'), 0);
  assert.equal(damerauLevenshtein('dipirona', 'diprona'), 1);
});

test('trigram similarity is 1 for the same string and lower for a distant word', () => {
  assert.equal(trigramSimilarity('dipirona', 'dipirona'), 1);
  assert.ok(trigramSimilarity('diprona', 'dipirona') > trigramSimilarity('diprona', 'paracetamol'));
});

test('pt-BR phonetic key collapses silent h, sibilants and double letters', () => {
  assert.equal(phoneticKey('dipirona'), phoneticKey('dipironna'));
  assert.equal(consonantSkeleton('monajuro'), consonantSkeleton('mounjaro'));
  assert.equal(consonantSkeleton('losartan'), consonantSkeleton('losartana'));
});

test('dictionary covers a few hundred medicine names and grocery/pet terms', () => {
  const s = stats();
  assert.ok(s.ingredients >= 220, JSON.stringify(s));
  assert.ok(s.brands >= 150, JSON.stringify(s));
  assert.ok(s.mercado >= 40, JSON.stringify(s));
  assert.ok(s.pet >= 15, JSON.stringify(s));
});

function expectAuto(typed, term, segment = 'farmacia') {
  const r = interpretQuery(typed, segment);
  assert.equal(r.correction && r.correction.type, 'auto', `${typed} → ${JSON.stringify(r.correction)}`);
  assert.equal(r.correction.term, term, `${typed} resolved to ${r.correction.term}`);
  assert.equal(r.searchQuery, term);
  assert.ok(normalize(r.correction.display).includes(term.split(' ')[0]));
}

test('diprona corrects to dipirona', () => expectAuto('diprona', 'dipirona'));
test('monajuro corrects to mounjaro', () => expectAuto('monajuro', 'mounjaro'));
test('monjaro corrects to mounjaro', () => expectAuto('monjaro', 'mounjaro'));
test('losartan corrects to losartana', () => expectAuto('losartan', 'losartana'));

test('amoxicilina typos correct to amoxicilina', () => {
  for (const typo of ['amoxilina', 'amoxicilin', 'amoxisilina', 'amoxacilina', 'amoxicilna', 'amoxcilina']) {
    expectAuto(typo, 'amoxicilina');
  }
});

test('exact and accented names are not rewritten', () => {
  for (const q of ['dipirona', 'Dipirona', 'losartana', 'mounjaro', 'amoxicilina']) {
    const r = interpretQuery(q, 'farmacia');
    assert.equal(r.correction, null, q);
  }
});

test('dosage token is kept when the drug name is misspelled', () => {
  const r = interpretQuery('diprona 500mg', 'farmacia');
  assert.equal(r.correction.type, 'auto');
  assert.equal(r.searchQuery, 'dipirona 500mg');
  assert.match(r.correction.display, /Dipirona/);
});

test('banner text can be built from the auto correction', () => {
  const r = interpretQuery('diprona', 'farmacia');
  const msg = `Mostrando resultados para ${r.correction.display} (você digitou ${r.correction.typed})`;
  assert.equal(msg, 'Mostrando resultados para Dipirona (você digitou diprona)');
});

test('a short grocery word is not pulled into a medicine', () => {
  const r = interpretQuery('cafe', 'farmacia');
  assert.equal(r.correction, null);
  assert.equal(r.searchQuery, 'cafe');
});

test('a clipped ingredient is not replaced by an unrelated brand', () => {
  expectAuto('paracet', 'paracetamol');
  const r = interpretQuery('amoxi', 'farmacia');
  const names = r.correction?.type === 'auto'
    ? [r.correction.term]
    : (r.correction?.suggestions || []).map(s => s.term);
  assert.ok(names.includes('amoxicilina'), JSON.stringify(r.correction));
  assert.notEqual(r.correction?.type === 'auto' && r.correction.term, 'pressat');
});

test('an ambiguous prefix offers chips instead of guessing', () => {
  const r = interpretQuery('vitamina', 'farmacia');
  assert.equal(r.correction.type, 'suggest');
  const names = r.correction.suggestions.map(s => s.term);
  assert.ok(names.includes('vitamina c') && names.includes('vitamina d'));
});

test('mercado and pet typos stay in their catalogs', () => {
  expectAuto('aroz', 'arroz', 'mercado');
  expectAuto('papel igienico', 'papel higienico', 'mercado');
  expectAuto('racao goldem', 'racao golden', 'petshop');
});

test('ambiguous neighbors are suggested instead of auto-corrected', () => {
  const dict = [
    { term: 'abacaxi', display: 'Abacaxi' },
    { term: 'abacati', display: 'Abacati' },
  ];
  const ranked = rankMatches('abacay', dict, { auto: 0.99, suggest: 0.5, gap: 0.2 });
  assert.ok(ranked.suggestions.length >= 1);
  assert.ok(similarity('abacay', 'abacaxi') > 0.5);
});
