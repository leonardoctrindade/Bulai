const test = require('node:test');
const assert = require('node:assert/strict');
const { lookupBrand, classifyQuery } = require('../lib/dictionary');
const { interpretQuery, selectGenericOffers, savingsBetween, NO_GENERIC_MESSAGE } = require('../lib/resolve');

test('reference brands map to the active ingredient', () => {
  const cases = [
    ['cozaar', 'losartana', false],
    ['tylenol', 'paracetamol', false],
    ['novalgina', 'dipirona', false],
    ['glifage', 'metformina', false],
    ['losec', 'omeprazol', false],
    ['puran t4', 'levotiroxina', false],
    ['mounjaro', 'tirzepatida', true],
    ['ozempic', 'semaglutida', true],
  ];
  for (const [brand, ingredient, noGeneric] of cases) {
    const info = classifyQuery(brand, 'farmacia').brand;
    assert.ok(info, brand);
    assert.equal(info.ingredients[0], ingredient, brand);
    assert.equal(info.hasGeneric, !noGeneric, brand);
    if (noGeneric) assert.equal(info.genericQuery, null);
    else assert.equal(info.genericQuery, ingredient);
  }
});

test('Dorflex is the combination, not plain dipirona', () => {
  const b = lookupBrand('dorflex');
  assert.equal(b.combination, true);
  assert.deepEqual(b.ingredients, ['dipirona', 'orfenadrina', 'cafeina']);
  assert.equal(b.hasGeneric, true);
  assert.equal(b.genericQuery, 'dipirona orfenadrina cafeina');
  assert.match(b.note, /não a um componente isolado/);
  const pub = classifyQuery('Dorflex', 'farmacia').brand;
  assert.equal(pub.ingredientDisplay, 'Dipirona + Orfenadrina + Cafeína');
});

test('Mounjaro reports no generic', () => {
  const b = classifyQuery('monajuro', 'farmacia');
  assert.equal(b.brand, null);
  const corrected = interpretQuery('monajuro', 'farmacia');
  assert.equal(corrected.searchQuery, 'mounjaro');
  const after = classifyQuery(corrected.searchQuery, 'farmacia').brand;
  assert.equal(after.hasGeneric, false);
  assert.equal(NO_GENERIC_MESSAGE, 'Sem genérico disponível');
});

test('a generic search lists reference brands', () => {
  const info = classifyQuery('losartana', 'farmacia');
  assert.equal(info.brand, null);
  assert.equal(info.ingredient.display, 'Losartana');
  assert.ok(info.ingredient.referenceBrands.includes('Cozaar'));
  assert.equal(info.ingredient.referenceBrands.includes('Aradois'), false);
});

test('generic offers drop the queried brand and unrelated combinations', () => {
  const brand = classifyQuery('cozaar', 'farmacia').brand;
  const items = [
    { title: 'Cozaar 50mg', brand: 'Cozaar', price: 40, variant: '50mg · 30 comp' },
    { title: 'Losartana Potássica 50mg', brand: 'EMS', price: 8, variant: '50mg · 30 comp' },
    { title: 'Losartana 50mg', brand: 'Medley', price: 6, variant: '50mg · 30 comp' },
    { title: 'Hyzaar 50/12,5mg', brand: 'Hyzaar', price: 22, variant: 'Combinações (com outro princípio ativo)' },
    { title: 'Losartana 25mg', brand: 'EMS', price: 4, variant: '25mg · 30 comp' },
  ];
  const offers = selectGenericOffers(items, brand, '50mg · 30 comp');
  assert.deepEqual(offers.map(o => o.price), [6, 8]);
  const savings = savingsBetween([{ price: 40 }], offers);
  assert.equal(savings.amount, 34);
  assert.equal(savings.pct, 85);
});

test('no savings when the generic is not cheaper', () => {
  assert.equal(savingsBetween([{ price: 5 }], [{ price: 9 }]), null);
});
