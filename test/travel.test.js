const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveAirport, validateHotel, validateFlight, flightLinks, hotelLinks,
  applyFlightFilters, sortOffers, coldStartHint, splitPax,
} = require('../lib/travel');
const { serpFlightsParams, serpHotelsParams, parseSerpFlights, providersConfigured } = require('../lib/travel-sources');

const NOW = new Date('2026-11-21T15:00:00Z');

test('aeroportos: código, nome e typo', () => {
  assert.equal(resolveAirport('gig').airport.code, 'GIG');
  assert.equal(resolveAirport('GIG').airport.code, 'GIG');
  assert.equal(resolveAirport('galeao').airport.code, 'GIG');
  assert.equal(resolveAirport('galeão').airport.code, 'GIG');
  assert.equal(resolveAirport('santos dumont').airport.code, 'SDU');
  assert.equal(resolveAirport('cascavel').airport.code, 'CAC');
  assert.equal(resolveAirport('congonhas').airport.code, 'CGH');
  assert.equal(resolveAirport('guarulhos').airport.code, 'GRU');
  const rio = resolveAirport('rio de janeiro');
  assert.equal(rio.decision, 'suggest');
  assert.deepEqual(rio.suggestions.map(a => a.code).sort(), ['GIG', 'SDU']);
  const sp = resolveAirport('sao paulo');
  assert.equal(sp.decision, 'suggest');
  assert.ok(sp.suggestions.map(a => a.code).includes('GRU'));
  assert.ok(sp.suggestions.map(a => a.code).includes('CGH'));
});

test('typo de aeroporto ainda sugere o código certo', () => {
  const r = resolveAirport('santos dummont');
  assert.equal(r.decision, 'auto');
  assert.equal(r.airport.code, 'SDU');
  const c = resolveAirport('cascaveu');
  assert.equal(c.airport.code, 'CAC');
});

test('hotel rejeita data e idade de criança', () => {
  const badDate = validateHotel({ city: 'Foz do Iguaçu', checkIn: '2026-11-30', checkOut: '2026-11-28', adults: 2, children: 0, childAges: [] }, NOW);
  assert.equal(badDate.ok, false);
  assert.match(badDate.error, /check-out/);
  const badAge = validateHotel({ city: 'Foz', checkIn: '2026-11-28', checkOut: '2026-11-30', adults: 2, children: 1, childAges: [] }, NOW);
  assert.equal(badAge.ok, false);
  assert.match(badAge.error, /idade/);
  const past = validateHotel({ city: 'Foz', checkIn: '2026-11-01', checkOut: '2026-11-03', adults: 2, children: 0, childAges: [] }, NOW);
  assert.match(past.error, /passado/);
});

test('hotel válido e links levam adultos, idades e quartos', () => {
  const parsed = validateHotel({
    city: 'Foz do Iguaçu', checkIn: '2026-11-28', checkOut: '2026-11-30',
    rooms: [{ adults: 2, childAges: [7] }, { adults: 1, childAges: [] }],
    breakfast: true, stars: 3,
  }, NOW);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.adults, 3);
  assert.deepEqual(parsed.value.childAges, [7]);
  assert.equal(parsed.value.nights, 2);
  const links = Object.fromEntries(hotelLinks(parsed.value).map(l => [l.source, l.url]));
  assert.match(links['Booking.com'], /group_adults=3/);
  assert.match(links['Booking.com'], /group_children=1/);
  assert.match(links['Booking.com'], /age=7/);
  assert.match(links['Booking.com'], /no_rooms=2/);
  assert.match(links['Booking.com'], /checkin=2026-11-28/);
  assert.match(links['Decolar'], /childAges=7/);
  assert.match(links['Hoteis.com'], /childAge=7/);
  assert.match(decodeURIComponent(links['Google Hotéis']), /7 anos/);
  assert.match(decodeURIComponent(links['Google Hotéis']), /café da manhã/i);
});

test('voo: bebê no colo, links e sem preço inventado', () => {
  const bad = validateFlight({ origin: 'GIG', destination: 'GRU', trip: 'oneway', depart: '2026-11-28', adults: 1, children: 2, childAges: [1, 0] }, NOW);
  assert.match(bad.error, /bebê/);
  const ok = validateFlight({
    origin: 'galeao', destination: 'congonhas', trip: 'round', depart: '2026-11-28', ret: '2026-11-30',
    adults: 1, children: 1, childAges: [1], directOnly: true,
  }, NOW);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.origin.code, 'GIG');
  assert.equal(ok.value.destination.code, 'CGH');
  assert.equal(ok.value.pax.infants, 1);
  const links = Object.fromEntries(flightLinks(ok.value).map(l => [l.source, l.url]));
  assert.match(links['Google Voos'], /GIG/);
  assert.match(links['Google Voos'], /CGH/);
  assert.match(links['Kayak'], /GIG-CGH\/2026-11-28\/2026-11-30/);
  assert.match(links['Kayak'], /1children-1/);
  assert.match(links.LATAM, /inf=1/);
  assert.match(links.GOL, /bebes=1/);
  assert.equal(splitPax(1, [1, 8, 14]).adults, 2);
  assert.equal(splitPax(1, [1, 8, 14]).children, 1);
  assert.equal(splitPax(1, [1, 8, 14]).infants, 1);
  const merged = sortOffers(applyFlightFilters([
    { price: 800, url: 'https://exemplo.test/a', stops: 1, source: 'A' },
    { price: 0, url: 'https://exemplo.test/z', stops: 0, source: 'Z' },
    { price: 400, url: 'https://exemplo.test/b', stops: 0, source: 'B' },
    { source: 'C', title: 'sem preço' },
  ], { maxStops: null, maxPrice: null, baggage: false, airlines: [], departWindow: 'any' }), 'price');
  assert.deepEqual(merged.map(o => o.price), [400, 800]);
});

test('voo direto descarta escala e dica do Render só depois de alguns segundos', () => {
  const offers = applyFlightFilters([
    { price: 100, url: 'https://exemplo.test/d', stops: 0, source: 'D' },
    { price: 90, url: 'https://exemplo.test/e', stops: 2, source: 'E' },
  ], { maxStops: 0, maxPrice: null, baggage: false, airlines: [], departWindow: 'any' });
  assert.equal(offers.length, 1);
  assert.equal(offers[0].source, 'D');
  assert.equal(coldStartHint(1000), '');
  assert.match(coldStartHint(5000), /30 segundos/);
});

test('SerpApi recebe idades e ocupação e não inventa preço sem chave', () => {
  const prev = process.env.SERPAPI_KEY;
  const prevLite = process.env.LITEAPI_KEY;
  delete process.env.SERPAPI_KEY;
  delete process.env.LITEAPI_KEY;
  assert.deepEqual(providersConfigured(), { serpapi: false, liteapi: false });
  if (prev) process.env.SERPAPI_KEY = prev;
  if (prevLite) process.env.LITEAPI_KEY = prevLite;
  const hotel = validateHotel({
    city: 'Foz do Iguaçu', checkIn: '2026-11-28', checkOut: '2026-11-30',
    rooms: [{ adults: 2, childAges: [0, 7] }],
  }, NOW).value;
  const hotels = serpHotelsParams(hotel);
  assert.equal(hotels.get('adults'), '2');
  assert.equal(hotels.get('children'), '2');
  assert.equal(hotels.get('children_ages'), '1,7');
  assert.equal(hotels.get('currency'), 'BRL');
  const flight = validateFlight({
    origin: 'GIG', destination: 'GRU', trip: 'oneway', depart: '2026-11-28',
    adults: 1, children: 2, childAges: [1, 8], directOnly: true,
  }, NOW).value;
  const flights = serpFlightsParams(flight);
  assert.equal(flights.get('adults'), '1');
  assert.equal(flights.get('children'), '1');
  assert.equal(flights.get('infants_on_lap'), '1');
  assert.equal(flights.get('stops'), '1');
  assert.equal(flights.get('departure_id'), 'GIG');
  const parsed = parseSerpFlights({
    best_flights: [{ price: 350, total_duration: 70, flights: [{ airline: 'GOL', flight_number: 'G3 1234', departure_airport: { time: '2026-11-28 09:00' }, arrival_airport: { time: '2026-11-28 10:10' } }] }],
    other_flights: [{ price: null, flights: [] }, { flights: [{ airline: 'LATAM' }] }],
  }, flight, 'https://www.google.com/travel/flights');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].price, 350);
  assert.equal(parsed[0].source, 'Google Voos');
  assert.equal(parsed[0].stops, 0);
});

test('cascavel para o rio pede escolha entre GIG e SDU', () => {
  const parsed = validateFlight({ origin: 'CAC', destination: 'rio', trip: 'oneway', depart: '2026-11-28', adults: 1, children: 0, childAges: [] }, NOW);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.field, 'destination');
  assert.ok(parsed.suggestions.some(a => a.code === 'GIG'));
});
