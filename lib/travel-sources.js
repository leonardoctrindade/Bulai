const { get } = require('./http');
const { hav } = require('./places');
const { flightLinks, hotelLinks, applyFlightFilters, applyHotelFilters, sortOffers } = require('./travel');

function serpapiKey() {
  return process.env.SERPAPI_KEY || '';
}
function liteapiKey() {
  return process.env.LITEAPI_KEY || '';
}
function providersConfigured() {
  return { serpapi: !!serpapiKey(), liteapi: !!liteapiKey() };
}

function serpFlightsParams(v) {
  const cabin = { economy: '1', premium: '2', business: '3', first: '4' }[v.cabin] || '1';
  const qs = new URLSearchParams({
    engine: 'google_flights',
    departure_id: v.origin.code,
    arrival_id: v.destination.code,
    outbound_date: v.depart,
    currency: 'BRL',
    hl: 'pt',
    gl: 'br',
    type: v.trip === 'oneway' ? '2' : '1',
    adults: String(v.pax.adults),
    travel_class: cabin,
    sort_by: v.sort === 'duration' ? '5' : '2',
  });
  if (v.trip === 'round') qs.set('return_date', v.ret);
  if (v.pax.children) qs.set('children', String(v.pax.children));
  if (v.pax.infants) qs.set('infants_on_lap', String(v.pax.infants));
  if (v.maxStops === 0) qs.set('stops', '1');
  else if (v.maxStops === 1) qs.set('stops', '2');
  else if (v.maxStops === 2) qs.set('stops', '3');
  return qs;
}

function serpHotelsParams(v) {
  const ages = v.childAges.map(a => (a < 1 ? 1 : a));
  const qs = new URLSearchParams({
    engine: 'google_hotels',
    q: `Hotéis em ${v.city}`,
    check_in_date: v.checkIn,
    check_out_date: v.checkOut,
    adults: String(v.adults),
    children: String(ages.length),
    currency: 'BRL',
    gl: 'br',
    hl: 'pt-BR',
    geo_search: 'true',
    sort_by: v.sort === 'rating' ? '8' : '3',
  });
  if (ages.length) qs.set('children_ages', ages.join(','));
  if (v.priceMin != null) qs.set('min_price', String(Math.round(v.priceMin)));
  if (v.priceMax != null) qs.set('max_price', String(Math.round(v.priceMax)));
  if (v.stars) qs.set('hotel_class', [3, 4, 5].filter(n => n >= v.stars).join(','));
  if (v.freeCancellation) qs.set('free_cancellation', 'true');
  if (v.ratingMin != null && v.ratingMin >= 7) {
    qs.set('rating', v.ratingMin >= 9 ? '9' : v.ratingMin >= 8 ? '8' : '7');
  }
  return qs;
}

function parseSerpFlights(data, v, bookUrl) {
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'SerpApi recusou a busca');
  const rows = [...(data.best_flights || []), ...(data.other_flights || [])];
  return rows.map(item => {
    const legs = item.flights || [];
    const first = legs[0] || {};
    const price = Number(item.price);
    if (!(price > 0)) return null;
    const number = String(first.flight_number || '');
    return {
      source: 'Google Voos',
      price,
      currency: 'BRL',
      priceBasis: 'trajeto',
      title: `${v.origin.code} → ${v.destination.code}`,
      airline: number.slice(0, 2) || '',
      airlineName: first.airline || '',
      stops: Math.max(0, legs.length - 1),
      depart: first.departure_airport?.time || null,
      arrive: legs.at(-1)?.arrival_airport?.time || null,
      durationMin: typeof item.total_duration === 'number' ? item.total_duration : null,
      baggage: null,
      url: bookUrl,
    };
  }).filter(Boolean);
}

function extractedMoney(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const n = Number(obj.extracted_lowest ?? obj.extracted_before_taxes_fees);
  return n > 0 ? n : null;
}

function amenityCodes(list) {
  const blob = (list || []).join(' ').toLowerCase();
  const out = [];
  if (/pool|piscina/.test(blob)) out.push('pool');
  if (/parking|estacionamento/.test(blob)) out.push('parking');
  if (/wi-?fi/.test(blob)) out.push('wifi');
  if (/pet/.test(blob)) out.push('pets');
  return out;
}

function parseSerpHotels(data, v, center) {
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'SerpApi recusou a busca');
  return (data.properties || []).map(p => {
    const perNight = extractedMoney(p.rate_per_night);
    const total = extractedMoney(p.total_rate);
    const price = total || (perNight ? perNight * v.nights : null);
    if (!(price > 0) || !p.name) return null;
    const lat = p.gps_coordinates?.latitude;
    const lon = p.gps_coordinates?.longitude;
    let distanceKm = null;
    if (center && lat != null && lon != null) distanceKm = +hav(center.lat, center.lon, lat, lon).toFixed(1);
    const rating5 = p.overall_rating != null ? Number(p.overall_rating) : null;
    const type = String(p.type || '').toLowerCase();
    const propertyType = /pousada|inn/.test(type) ? 'pousada' : /apart/.test(type) ? 'apartment' : /resort/.test(type) ? 'resort' : /hotel/.test(type) ? 'hotel' : null;
    return {
      source: 'Google Hotéis',
      price,
      currency: 'BRL',
      priceBasis: total ? 'estadia' : 'noite',
      title: p.name,
      stars: p.hotel_class != null ? Number(p.hotel_class) : null,
      rating: rating5 != null && rating5 <= 5 ? +(rating5 * 2).toFixed(1) : rating5,
      distanceKm,
      propertyType,
      breakfast: null,
      freeCancellation: typeof p.free_cancellation === 'boolean' ? p.free_cancellation : null,
      amenities: amenityCodes(p.amenities),
      url: p.link || p.serpapi_property_details_link || `https://www.google.com/travel/hotels?hl=pt-BR&gl=br&curr=BRL&q=${encodeURIComponent(p.name + ' ' + v.city)}`,
    };
  }).filter(Boolean);
}

function liteAmount(rate) {
  const buckets = [rate?.retailRate?.total, rate?.offerRetailRate, rate?.retailRate?.suggestedSellingPrice];
  for (const bucket of buckets) {
    const row = Array.isArray(bucket) ? bucket[0] : bucket;
    const n = Number(row?.amount ?? row);
    if (n > 0) return n;
  }
  return null;
}

function parseLiteHotels(data, v) {
  const rows = data?.data || data?.hotels || [];
  const offers = [];
  for (const hotel of rows) {
    const name = hotel.hotelName || hotel.name || hotel.hotel?.name;
    if (!name) continue;
    let cheapest = null;
    const rooms = hotel.roomTypes || hotel.rooms || [];
    for (const room of rooms) {
      for (const rate of room.rates || room.roomRates || [room]) {
        const amount = liteAmount(rate);
        if (amount && (!cheapest || amount < cheapest)) cheapest = amount;
      }
    }
    if (!cheapest) {
      const direct = liteAmount(hotel);
      if (direct) cheapest = direct;
    }
    if (!(cheapest > 0)) continue;
    const lat = hotel.latitude ?? hotel.hotel?.latitude;
    const lon = hotel.longitude ?? hotel.hotel?.longitude;
    offers.push({
      source: 'LiteAPI',
      price: cheapest,
      currency: 'BRL',
      priceBasis: 'estadia',
      title: name,
      stars: hotel.starRating != null ? Number(hotel.starRating) : null,
      rating: hotel.rating != null ? Number(hotel.rating) : null,
      distanceKm: null,
      propertyType: null,
      breakfast: null,
      freeCancellation: null,
      amenities: amenityCodes(hotel.facilities || hotel.amenities),
      latitude: lat != null ? Number(lat) : null,
      longitude: lon != null ? Number(lon) : null,
      url: `https://www.google.com/travel/hotels?hl=pt-BR&gl=br&curr=BRL&q=${encodeURIComponent(name + ' ' + v.city)}`,
    });
  }
  return offers;
}

async function serpapiFlights(v, bookUrl) {
  const qs = serpFlightsParams(v);
  qs.set('api_key', serpapiKey());
  const data = await get(`https://serpapi.com/search.json?${qs}`, { timeout: 20000 });
  return parseSerpFlights(data, v, bookUrl);
}

async function serpapiHotels(v, center) {
  const qs = serpHotelsParams(v);
  qs.set('api_key', serpapiKey());
  const data = await get(`https://serpapi.com/search.json?${qs}`, { timeout: 20000 });
  return parseSerpHotels(data, v, center);
}

async function liteapiHotels(v) {
  const data = await get('https://api.liteapi.travel/v3.0/hotels/rates', {
    method: 'POST',
    headers: { 'X-API-Key': liteapiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cityName: v.city,
      countryCode: 'BR',
      checkin: v.checkIn,
      checkout: v.checkOut,
      currency: 'BRL',
      guestNationality: 'BR',
      occupancies: v.rooms.map(room => ({ adults: room.adults, children: room.childAges })),
      maxRatesPerHotel: 1,
      limit: 15,
      timeout: 8,
    }),
    timeout: 15000,
  });
  return parseLiteHotels(data, v);
}

async function probe(url) {
  await get(url, { text: true, timeout: 7000, accept: 'text/html,application/json' });
}

function sourceResult(source, url, status, note, offers = []) {
  return { source, url, status, note, offers };
}

async function runLinkSource(item) {
  try {
    await probe(item.url);
    return sourceResult(item.source, item.url, 'sem_dados', 'O site abre, mas o preço só aparece no navegador. Nada foi inventado.');
  } catch (e) {
    const msg = String(e.message || e);
    const blocked = /HTTP 40[0139]|HTTP 429|HTTP 5|aborted|Timeout|ENOTFOUND|EAI_AGAIN|certificate/i.test(msg);
    return sourceResult(item.source, item.url, blocked ? 'bloqueado' : 'erro', msg);
  }
}

async function pricedSource(source, url, fn, emptyNote) {
  try {
    const offers = await fn();
    return sourceResult(source, url, offers.length ? 'ok' : 'sem_dados', offers.length ? null : emptyNote, offers);
  } catch (e) {
    return sourceResult(source, url, 'erro', String(e.message || e).slice(0, 180));
  }
}

async function searchFlights(v) {
  const links = flightLinks(v);
  const book = links.find(l => l.source === 'Google Voos').url;
  const jobs = links.map(link => runLinkSource(link));
  if (serpapiKey()) {
    jobs.push(pricedSource('Google Voos (SerpApi)', book, () => serpapiFlights(v, book), 'SerpApi não devolveu tarifa para este trecho.'));
  }
  const results = await Promise.all(jobs);
  const offers = sortOffers(applyFlightFilters(results.flatMap(r => r.offers), v), v.sort).slice(0, 30);
  const needsKey = !serpapiKey();
  return {
    offers,
    sources: results.map(({ offers: _o, ...rest }) => rest),
    configured: providersConfigured(),
    message: offers.length ? null : (needsKey
      ? 'Sem a chave SERPAPI_KEY não há tarifa automática. Os links abaixo abrem a pesquisa já preenchida. Não mostramos valor inventado.'
      : 'Nenhum preço automático nesta busca. Os links abaixo abrem a pesquisa já preenchida. Não mostramos valor inventado.'),
  };
}

async function searchHotels(v, center) {
  const links = hotelLinks(v);
  const book = links.find(l => l.source === 'Google Hotéis').url;
  const jobs = links.map(link => runLinkSource(link));
  if (serpapiKey()) {
    jobs.push(pricedSource('Google Hotéis (SerpApi)', book, () => serpapiHotels(v, center), 'SerpApi não devolveu hotel para esta cidade.'));
  }
  if (liteapiKey()) {
    jobs.push(pricedSource('LiteAPI', book, () => liteapiHotels(v), 'LiteAPI não devolveu hotel para esta cidade.'));
  }
  const results = await Promise.all(jobs);
  const offers = sortOffers(applyHotelFilters(results.flatMap(r => r.offers), v), v.sort).slice(0, 30);
  const needsKey = !serpapiKey() && !liteapiKey();
  return {
    offers,
    sources: results.map(({ offers: _o, ...rest }) => rest),
    configured: providersConfigured(),
    center: center || null,
    message: offers.length ? null : (needsKey
      ? 'Sem SERPAPI_KEY ou LITEAPI_KEY não há diária automática. Os links abaixo abrem a pesquisa já preenchida (adultos, idades e quartos). Não mostramos valor inventado.'
      : 'Nenhum preço automático nesta busca. Os links abaixo abrem a pesquisa já preenchida. Não mostramos valor inventado.'),
  };
}

module.exports = {
  searchFlights, searchHotels, providersConfigured, serpFlightsParams, serpHotelsParams, parseSerpFlights, parseSerpHotels, parseLiteHotels,
};
