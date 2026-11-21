const test = require('node:test');
const assert = require('node:assert/strict');
const { splitOffers, shopMatchesChain, includesTerm, normalizeCep, hav, RADIUS_KM } = require('../lib/places');

const raia = { id: 'raia', aliases: ['droga raia', 'raia'] };
const pacheco = { id: 'pacheco', aliases: ['pacheco'] };

test('raia matches the store name and not praia', () => {
  assert.equal(shopMatchesChain('Droga Raia', raia), true);
  assert.equal(shopMatchesChain('Nissei Drugstore', { aliases: ['nissei'] }), true);
  assert.equal(includesTerm('praia de copacabana', 'raia'), false);
  assert.equal(shopMatchesChain('Drogaria São Paulo', { aliases: ['drogaria sao paulo'] }), true);
  assert.equal(shopMatchesChain('São Paulo', { aliases: ['drogaria sao paulo'] }), false);
});

test('offers inside 30 km stay nearby and Rio chains do not rank in Medianeira', () => {
  const medianeira = { lat: -25.2872, lon: -54.0934 };
  const shops = {
    raia: [{ name: 'Droga Raia', lat: -25.2963, lon: -54.0932, addr: 'Centro' }],
    pacheco: [{ name: 'Drogarias Pacheco', lat: -23.0187, lon: -43.4893, addr: 'Recreio' }],
  };
  const items = [
    { chainId: 'raia', store: 'Droga Raia', title: 'Losartana 50mg', price: 3.43 },
    { chainId: 'pacheco', store: 'Drogarias Pacheco', title: 'Losartana 50mg', price: 2.10 },
    { chainId: null, onlineOnly: true, store: 'Loja (via Buscapé)', title: 'Losartana 50mg', price: 1.99 },
  ];
  const { nearby, online } = splitOffers(items, shops, medianeira.lat, medianeira.lon, RADIUS_KM);
  assert.deepEqual(nearby.map(o => o.store), ['Droga Raia']);
  assert.ok(nearby[0].nearest.km < 2);
  assert.ok(online.map(o => o.store).includes('Drogarias Pacheco'));
  assert.ok(online.map(o => o.store).includes('Loja (via Buscapé)'));
  const far = online.find(o => o.chainId === 'pacheco');
  assert.ok(far.nearest.km > 100);
  assert.ok(hav(medianeira.lat, medianeira.lon, -23.0187, -43.4893) > 1000);
});

test('cep normalization', () => {
  assert.equal(normalizeCep('85884-000'), '85884000');
  assert.equal(normalizeCep('Medianeira'), null);
  assert.equal(normalizeCep('123'), null);
});

test('pacheco chain object is accepted by the matcher', () => {
  assert.equal(shopMatchesChain('Drogarias Pacheco', pacheco), true);
});
