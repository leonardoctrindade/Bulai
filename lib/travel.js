const { normalize, rankMatches } = require('./fuzzy');

// Aeroportos com voo comercial relevante no Brasil. O código IATA é a chave.
const AIRPORT_ROWS = [
  ['GIG', 'Galeão', 'Rio de Janeiro', ['galeao', 'aeroporto internacional do rio', 'tom jobim']],
  ['SDU', 'Santos Dumont', 'Rio de Janeiro', ['santos dumont', 'dumont']],
  ['GRU', 'Guarulhos', 'São Paulo', ['guarulhos', 'cumbica']],
  ['CGH', 'Congonhas', 'São Paulo', ['congonhas']],
  ['VCP', 'Viracopos', 'Campinas', ['viracopos', 'campinas']],
  ['CAC', 'Cascavel', 'Cascavel', ['cascavel']],
  ['IGU', 'Foz do Iguaçu', 'Foz do Iguaçu', ['foz do iguacu', 'foz', 'cataratas']],
  ['FLN', 'Florianópolis', 'Florianópolis', ['florianopolis', 'floripa']],
  ['POA', 'Porto Alegre', 'Porto Alegre', ['porto alegre', 'salgado filho']],
  ['CWB', 'Curitiba', 'Curitiba', ['curitiba', 'afonso pena']],
  ['NVT', 'Navegantes', 'Navegantes', ['navegantes']],
  ['JOI', 'Joinville', 'Joinville', ['joinville']],
  ['XAP', 'Chapecó', 'Chapecó', ['chapeco']],
  ['LDB', 'Londrina', 'Londrina', ['londrina']],
  ['MGF', 'Maringá', 'Maringá', ['maringa']],
  ['BSB', 'Brasília', 'Brasília', ['brasilia']],
  ['SSA', 'Salvador', 'Salvador', ['salvador']],
  ['REC', 'Recife', 'Recife', ['recife', 'guararapes']],
  ['FOR', 'Fortaleza', 'Fortaleza', ['fortaleza', 'pinto martins']],
  ['NAT', 'Natal', 'Natal', ['natal']],
  ['MCZ', 'Maceió', 'Maceió', ['maceio']],
  ['AJU', 'Aracaju', 'Aracaju', ['aracaju']],
  ['JPA', 'João Pessoa', 'João Pessoa', ['joao pessoa']],
  ['SLZ', 'São Luís', 'São Luís', ['sao luis']],
  ['THE', 'Teresina', 'Teresina', ['teresina']],
  ['BEL', 'Belém', 'Belém', ['belem']],
  ['MAO', 'Manaus', 'Manaus', ['manaus', 'eduardo gomes']],
  ['PVH', 'Porto Velho', 'Porto Velho', ['porto velho']],
  ['RBR', 'Rio Branco', 'Rio Branco', ['rio branco']],
  ['MCP', 'Macapá', 'Macapá', ['macapa']],
  ['BVB', 'Boa Vista', 'Boa Vista', ['boa vista']],
  ['STM', 'Santarém', 'Santarém', ['santarem']],
  ['IMP', 'Imperatriz', 'Imperatriz', ['imperatriz']],
  ['PMW', 'Palmas', 'Palmas', ['palmas']],
  ['GYN', 'Goiânia', 'Goiânia', ['goiania']],
  ['CGB', 'Cuiabá', 'Cuiabá', ['cuiaba']],
  ['CGR', 'Campo Grande', 'Campo Grande', ['campo grande']],
  ['CNF', 'Confins', 'Belo Horizonte', ['confins', 'belo horizonte']],
  ['PLU', 'Pampulha', 'Belo Horizonte', ['pampulha']],
  ['UDI', 'Uberlândia', 'Uberlândia', ['uberlandia']],
  ['RAO', 'Ribeirão Preto', 'Ribeirão Preto', ['ribeirao preto']],
  ['SJP', 'São José do Rio Preto', 'São José do Rio Preto', ['sao jose do rio preto', 'rio preto']],
  ['VIX', 'Vitória', 'Vitória', ['vitoria']],
  ['BPS', 'Porto Seguro', 'Porto Seguro', ['porto seguro']],
  ['IOS', 'Ilhéus', 'Ilhéus', ['ilheus']],
  ['FEN', 'Fernando de Noronha', 'Fernando de Noronha', ['noronha']],
  ['JDO', 'Juazeiro do Norte', 'Juazeiro do Norte', ['juazeiro do norte']],
  ['CXJ', 'Caxias do Sul', 'Caxias do Sul', ['caxias do sul']],
  ['PFB', 'Passo Fundo', 'Passo Fundo', ['passo fundo']],
  ['PET', 'Pelotas', 'Pelotas', ['pelotas']],
  ['PPB', 'Presidente Prudente', 'Presidente Prudente', ['presidente prudente']],
  ['CFB', 'Cabo Frio', 'Cabo Frio', ['cabo frio']],
];

const CITY_ALIASES = {
  'rio de janeiro': ['GIG', 'SDU'],
  'rio': ['GIG', 'SDU'],
  'sao paulo': ['GRU', 'CGH', 'VCP'],
  'belo horizonte': ['CNF', 'PLU'],
  'bh': ['CNF', 'PLU'],
};

function uniqAirports(rows) {
  const by = new Map();
  const entries = [];
  for (const [code, name, city, aliases] of rows) {
    if (by.has(code)) continue;
    const airport = { code, name, city, display: `${name} (${code}) · ${city}` };
    by.set(code, airport);
    const terms = new Set([normalize(name), normalize(city), normalize(`${name} ${city}`), ...aliases.map(normalize)]);
    for (const term of terms) {
      if (term) entries.push({ term, display: airport.display, code });
    }
  }
  return { by, entries };
}

const { by: AIRPORTS, entries: AIRPORT_ENTRIES } = uniqAirports(AIRPORT_ROWS);

function pubAirport(a) {
  return { code: a.code, name: a.name, city: a.city, display: a.display };
}

function resolveAirport(raw) {
  const n = normalize(raw);
  if (!n) return { decision: null, suggestions: [] };
  if (/^[a-z]{3}$/.test(n)) {
    const a = AIRPORTS.get(n.toUpperCase());
    if (a) return { decision: 'auto', airport: pubAirport(a), suggestions: [pubAirport(a)] };
  }
  if (CITY_ALIASES[n]) {
    const list = CITY_ALIASES[n].map(code => pubAirport(AIRPORTS.get(code)));
    if (list.length === 1) return { decision: 'auto', airport: list[0], suggestions: list };
    return { decision: 'suggest', suggestions: list };
  }
  const exact = AIRPORT_ENTRIES.filter(e => e.term === n);
  const exactCodes = [...new Set(exact.map(e => e.code))];
  if (exactCodes.length === 1) {
    const airport = pubAirport(AIRPORTS.get(exactCodes[0]));
    return { decision: 'auto', airport, suggestions: [airport] };
  }
  if (exactCodes.length > 1) {
    return { decision: 'suggest', suggestions: exactCodes.map(code => pubAirport(AIRPORTS.get(code))) };
  }
  const ranked = rankMatches(n, AIRPORT_ENTRIES);
  const seen = new Set();
  const suggestions = [];
  for (const s of ranked.suggestions.length ? ranked.suggestions : (ranked.best ? [ranked.best] : [])) {
    const entry = AIRPORT_ENTRIES.find(e => e.term === s.term && e.display === s.display) || AIRPORT_ENTRIES.find(e => e.term === s.term);
    const code = entry && entry.code;
    if (!code || seen.has(code)) continue;
    seen.add(code);
    suggestions.push(pubAirport(AIRPORTS.get(code)));
  }
  if (ranked.decision === 'auto' && suggestions.length === 1) {
    return { decision: 'auto', airport: suggestions[0], suggestions };
  }
  if (suggestions.length) return { decision: suggestions.length === 1 && ranked.decision === 'auto' ? 'auto' : (ranked.decision === 'auto' ? 'suggest' : ranked.decision || 'suggest'), suggestions };
  return { decision: null, suggestions: [] };
}

function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
}

function parseISODate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

function nightsBetween(a, b) {
  const ms = Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z');
  return Math.round(ms / 86400000);
}

function asInt(v, fallback = null) {
  if (v === '' || v == null) return fallback;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function asAges(list, count) {
  const ages = Array.isArray(list) ? list.map(n => asInt(n)) : [];
  if (ages.length !== count || ages.some(a => a == null || a < 0 || a > 17)) return null;
  return ages;
}

function splitPax(adults, childAges) {
  const ages = childAges || [];
  const infants = ages.filter(a => a < 2).length;
  const children = ages.filter(a => a >= 2 && a < 12).length;
  const older = ages.filter(a => a >= 12).length;
  return { adults: adults + older, children, infants, youngAges: ages.filter(a => a < 12) };
}

function validateHotel(input, now = new Date()) {
  const city = String(input.city || '').trim();
  if (city.length < 2) return { ok: false, error: 'Informe a cidade de destino.' };
  const checkIn = parseISODate(input.checkIn);
  const checkOut = parseISODate(input.checkOut);
  if (!checkIn || !checkOut) return { ok: false, error: 'Informe check-in e check-out válidos.' };
  const today = todayISO(now);
  if (checkIn < today) return { ok: false, error: 'A data de check-in não pode ser no passado.' };
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) return { ok: false, error: 'O check-out precisa ser depois do check-in.' };
  if (nights > 30) return { ok: false, error: 'A estadia máxima nesta busca é de 30 noites.' };
  let rooms = Array.isArray(input.rooms) ? input.rooms : null;
  if (!rooms || !rooms.length) {
    const adults = asInt(input.adults);
    const children = asInt(input.children, 0);
    const childAges = asAges(input.childAges || [], children == null ? -1 : children);
    if (!adults || adults < 1) return { ok: false, error: 'Informe pelo menos 1 adulto.' };
    if (children == null || childAges == null) return { ok: false, error: 'Informe a idade de cada criança (0 a 17 anos).' };
    rooms = [{ adults, childAges }];
  }
  if (rooms.length > 4) return { ok: false, error: 'No máximo 4 quartos por busca.' };
  const normRooms = [];
  for (const room of rooms) {
    const adults = asInt(room.adults);
    const ages = asAges(room.childAges || [], Array.isArray(room.childAges) ? room.childAges.length : 0);
    if (!adults || adults < 1 || adults > 6) return { ok: false, error: 'Cada quarto precisa de 1 a 6 adultos.' };
    if (ages == null || ages.length > 6) return { ok: false, error: 'Informe a idade de cada criança (0 a 17 anos).' };
    normRooms.push({ adults, childAges: ages });
  }
  const adults = normRooms.reduce((s, r) => s + r.adults, 0);
  const childAges = normRooms.flatMap(r => r.childAges);
  const priceMin = input.priceMin === '' || input.priceMin == null ? null : Number(input.priceMin);
  const priceMax = input.priceMax === '' || input.priceMax == null ? null : Number(input.priceMax);
  if (priceMin != null && (!Number.isFinite(priceMin) || priceMin < 0)) return { ok: false, error: 'Preço mínimo por noite inválido.' };
  if (priceMax != null && (!Number.isFinite(priceMax) || priceMax < 0)) return { ok: false, error: 'Preço máximo por noite inválido.' };
  if (priceMin != null && priceMax != null && priceMin > priceMax) return { ok: false, error: 'O preço mínimo não pode passar do máximo.' };
  const stars = input.stars === '' || input.stars == null ? null : asInt(input.stars);
  if (stars != null && (stars < 1 || stars > 5)) return { ok: false, error: 'Estrelas devem ficar entre 1 e 5.' };
  const ratingMin = input.ratingMin === '' || input.ratingMin == null ? null : Number(input.ratingMin);
  if (ratingMin != null && (!Number.isFinite(ratingMin) || ratingMin < 0 || ratingMin > 10)) return { ok: false, error: 'A nota mínima deve ficar entre 0 e 10.' };
  const maxDistanceKm = input.maxDistanceKm === '' || input.maxDistanceKm == null ? null : Number(input.maxDistanceKm);
  if (maxDistanceKm != null && (!Number.isFinite(maxDistanceKm) || maxDistanceKm <= 0 || maxDistanceKm > 100)) return { ok: false, error: 'A distância máxima do centro deve ficar entre 1 e 100 km.' };
  const types = ['', 'hotel', 'pousada', 'apartment', 'resort'];
  const propertyType = String(input.propertyType || '');
  if (!types.includes(propertyType)) return { ok: false, error: 'Tipo de propriedade inválido.' };
  const amenities = Array.isArray(input.amenities) ? input.amenities.filter(a => ['pool', 'parking', 'wifi', 'pets'].includes(a)) : [];
  const sort = ['price', 'rating', 'distance'].includes(input.sort) ? input.sort : 'price';
  return {
    ok: true,
    value: {
      city, checkIn, checkOut, nights, rooms: normRooms, adults, childAges,
      priceMin, priceMax, stars, ratingMin, maxDistanceKm, propertyType, amenities, sort,
      breakfast: !!input.breakfast, freeCancellation: !!input.freeCancellation,
    },
  };
}

function validateFlight(input, now = new Date()) {
  const origin = resolveAirport(input.origin);
  const destination = resolveAirport(input.destination);
  if (origin.decision !== 'auto') {
    return { ok: false, error: origin.suggestions.length ? 'Escolha o aeroporto de origem.' : 'Não reconheci o aeroporto de origem.', field: 'origin', suggestions: origin.suggestions };
  }
  if (destination.decision !== 'auto') {
    return { ok: false, error: destination.suggestions.length ? 'Escolha o aeroporto de destino.' : 'Não reconheci o aeroporto de destino.', field: 'destination', suggestions: destination.suggestions };
  }
  if (origin.airport.code === destination.airport.code) return { ok: false, error: 'Origem e destino precisam ser diferentes.' };
  const trip = input.trip === 'oneway' ? 'oneway' : 'round';
  const depart = parseISODate(input.depart);
  const ret = trip === 'round' ? parseISODate(input.ret) : null;
  if (!depart || (trip === 'round' && !ret)) return { ok: false, error: 'Informe as datas do voo.' };
  if (depart < todayISO(now)) return { ok: false, error: 'A data de ida não pode ser no passado.' };
  if (trip === 'round' && nightsBetween(depart, ret) < 1) return { ok: false, error: 'A volta precisa ser depois da ida.' };
  const adults = asInt(input.adults);
  const children = asInt(input.children, Array.isArray(input.childAges) ? input.childAges.length : 0);
  const childAges = asAges(input.childAges || [], children == null ? -1 : children);
  if (!adults || adults < 1 || adults > 9) return { ok: false, error: 'Informe de 1 a 9 adultos.' };
  if (children == null || childAges == null || children > 8) return { ok: false, error: 'Informe a idade de cada criança (0 a 17 anos).' };
  const pax = splitPax(adults, childAges);
  if (pax.infants > adults) return { ok: false, error: 'Cada bebê (menor de 2 anos) precisa ir no colo de um adulto.' };
  const cabins = ['economy', 'premium', 'business', 'first'];
  const cabin = cabins.includes(input.cabin) ? input.cabin : 'economy';
  const directOnly = !!input.directOnly;
  let maxStops = input.maxStops === '' || input.maxStops == null || input.maxStops === 'any' ? null : asInt(input.maxStops);
  if (maxStops != null && (maxStops < 0 || maxStops > 2)) return { ok: false, error: 'O máximo de escalas deve ser 0, 1 ou 2.' };
  if (directOnly) maxStops = 0;
  const maxPrice = input.maxPrice === '' || input.maxPrice == null ? null : Number(input.maxPrice);
  if (maxPrice != null && (!Number.isFinite(maxPrice) || maxPrice <= 0)) return { ok: false, error: 'Preço máximo inválido.' };
  const windows = ['any', 'madrugada', 'manha', 'tarde', 'noite'];
  const departWindow = windows.includes(input.departWindow) ? input.departWindow : 'any';
  const airlines = String(input.airlines || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean).slice(0, 6);
  const sort = ['price', 'duration'].includes(input.sort) ? input.sort : 'price';
  return {
    ok: true,
    value: {
      origin: origin.airport, destination: destination.airport, trip, depart, ret, adults, childAges, pax,
      flex: !!input.flex, cabin, directOnly, maxStops, baggage: !!input.baggage,
      airlines, departWindow, maxPrice, sort,
    },
  };
}

function slugCity(city) {
  return normalize(city).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function yyMMdd(iso) {
  return iso.slice(2).replace(/-/g, '');
}

function cabinWord(cabin) {
  return { economy: 'econômica', premium: 'premium economy', business: 'executiva', first: 'primeira classe' }[cabin] || 'econômica';
}

function paxPhrase(adults, childAges) {
  const a = `${adults} adulto${adults > 1 ? 's' : ''}`;
  if (!childAges.length) return a;
  const ages = childAges.map(n => (n === 0 ? 'menos de 1 ano' : `${n} anos`)).join(', ');
  return `${a}, ${childAges.length} criança${childAges.length > 1 ? 's' : ''} (${ages})`;
}

function googleFlightQuery(v) {
  const route = v.trip === 'oneway'
    ? `Voos de ${v.origin.code} para ${v.destination.code} em ${v.depart}`
    : `Voos de ${v.origin.code} para ${v.destination.code} saindo ${v.depart} voltando ${v.ret}`;
  const bits = [route, paxPhrase(v.adults, v.childAges), cabinWord(v.cabin)];
  if (v.flex) bits.push('datas flexíveis ±3 dias');
  if (v.directOnly || v.maxStops === 0) bits.push('somente voos diretos');
  else if (v.maxStops != null) bits.push(`no máximo ${v.maxStops} escala${v.maxStops > 1 ? 's' : ''}`);
  if (v.baggage) bits.push('com bagagem despachada');
  if (v.airlines.length) bits.push('companhias ' + v.airlines.join(', '));
  if (v.departWindow && v.departWindow !== 'any') bits.push('saída de ' + v.departWindow);
  return bits.join(', ');
}

function googleHotelQuery(v) {
  const bits = [
    `Hotéis em ${v.city}`,
    `check-in ${v.checkIn}`,
    `check-out ${v.checkOut}`,
    paxPhrase(v.adults, v.childAges),
    `${v.rooms.length} quarto${v.rooms.length > 1 ? 's' : ''}`,
  ];
  if (v.stars) bits.push(`a partir de ${v.stars} estrelas`);
  if (v.breakfast) bits.push('com café da manhã');
  if (v.freeCancellation) bits.push('cancelamento grátis');
  if (v.propertyType) bits.push({ hotel: 'hotel', pousada: 'pousada', apartment: 'apartamento', resort: 'resort' }[v.propertyType]);
  for (const a of v.amenities) bits.push({ pool: 'piscina', parking: 'estacionamento', wifi: 'wifi', pets: 'aceita pets' }[a]);
  return bits.filter(Boolean).join(', ');
}

function flightLinks(v) {
  const o = v.origin.code, d = v.destination.code;
  const pax = v.pax;
  const kids = v.childAges.length ? `/${v.childAges.length}children-${v.childAges.join('-')}` : '';
  const kayakDates = v.trip === 'oneway' ? v.depart : `${v.depart}/${v.ret}`;
  const skyBack = v.trip === 'round' ? `/${yyMMdd(v.ret)}` : '';
  const skyKids = v.childAges.length ? `&childrenv2=${v.childAges.join('|')}` : '';
  const cabinSky = { economy: 'economy', premium: 'premiumeconomy', business: 'business', first: 'first' }[v.cabin];
  const latamTrip = v.trip === 'oneway' ? 'OW' : 'RT';
  const latamIn = v.trip === 'round' ? `&inbound=${v.ret}` : '';
  const golVolta = v.trip === 'round' ? `&volta=${v.ret.split('-').reverse().join('-')}` : '';
  return [
    { source: 'Google Voos', url: `https://www.google.com/travel/flights?hl=pt-BR&curr=BRL&q=${encodeURIComponent(googleFlightQuery(v))}` },
    { source: 'Kayak', url: `https://www.kayak.com.br/flights/${o}-${d}/${kayakDates}/${v.adults}adults${kids}?sort=price_a` },
    { source: 'Skyscanner', url: `https://www.skyscanner.com.br/transporte/passagens-aereas/${o.toLowerCase()}/${d.toLowerCase()}/${yyMMdd(v.depart)}${skyBack}/?adultsv2=${pax.adults}&cabinclass=${cabinSky}&rtn=${v.trip === 'round' ? 1 : 0}${skyKids}` },
    { source: 'Decolar', url: `https://www.decolar.com/shop/flights/results/${v.trip === 'round' ? 'roundtrip' : 'oneway'}/${o}/${d}/${v.depart}${v.trip === 'round' ? '/' + v.ret : ''}/${pax.adults}/${pax.children}/${pax.infants}/NA/NA/NA/NA?from=SB` },
    { source: 'MaxMilhas', url: v.trip === 'round'
      ? `https://www.maxmilhas.com.br/busca-passagens-aereas/RT/${o}/${d}/${v.depart}/${v.ret}/${pax.adults}/${pax.children}/${pax.infants}`
      : `https://www.maxmilhas.com.br/busca-passagens-aereas/OW/${o}/${d}/${v.depart}/${pax.adults}/${pax.children}/${pax.infants}` },
    { source: '123milhas', url: `https://123milhas.com/v2/busca?de=${o}&para=${d}&ida=${v.depart}${v.trip === 'round' ? '&volta=' + v.ret : ''}&adultos=${pax.adults}&criancas=${pax.children}&bebes=${pax.infants}` },
    { source: 'ViajaNet', url: `https://www.viajanet.com.br/shop/flights/results/${v.trip === 'round' ? 'roundtrip' : 'oneway'}/${o}/${d}/${v.depart}${v.trip === 'round' ? '/' + v.ret : ''}/${pax.adults}/${pax.children}/${pax.infants}/NA/NA/NA/NA?from=SB` },
    { source: 'Submarino Viagens', url: `https://www.submarinoviagens.com.br/passagens-aereas/?origem=${o}&destino=${d}&ida=${v.depart}${v.trip === 'round' ? '&volta=' + v.ret : ''}&adultos=${pax.adults}&criancas=${pax.children}` },
    { source: 'LATAM', url: `https://www.latamairlines.com/br/pt/oferta-voos?origin=${o}&destination=${d}&outbound=${v.depart}${latamIn}&adt=${pax.adults}&chd=${pax.children}&inf=${pax.infants}&cabin=${v.cabin === 'business' || v.cabin === 'first' ? 'J' : 'Y'}&trip=${latamTrip}` },
    { source: 'GOL', url: `https://b2c.voegol.com.br/compra?de=${o}&para=${d}&ida=${v.depart.split('-').reverse().join('-')}${golVolta}&adultos=${pax.adults}&criancas=${pax.children}&bebes=${pax.infants}` },
    { source: 'Azul', url: `https://www.voeazul.com.br/br/pt/home/selecao-voo?c[0].or=${o}&c[0].ds=${d}&c[0].std=${v.depart.slice(5, 7)}/${v.depart.slice(8, 10)}/${v.depart.slice(0, 4)}&p[0].t=ADT&p[0].c=${pax.adults}&p[1].t=CHD&p[1].c=${pax.children}&p[2].t=INF&p[2].c=${pax.infants}` },
  ];
}

function hotelLinks(v) {
  const city = encodeURIComponent(v.city);
  const ages = v.childAges.map(a => `age=${a}`).join('&');
  const ageQ = ages ? `&${ages}` : '';
  const slug = slugCity(v.city);
  const kids = v.childAges.length ? `/${v.childAges.length}children-${v.childAges.join('-')}` : '';
  return [
    { source: 'Google Hotéis', url: `https://www.google.com/travel/hotels?hl=pt-BR&gl=br&curr=BRL&q=${encodeURIComponent(googleHotelQuery(v))}` },
    { source: 'Booking.com', url: `https://www.booking.com/searchresults.pt-br.html?ss=${city}&checkin=${v.checkIn}&checkout=${v.checkOut}&group_adults=${v.adults}&group_children=${v.childAges.length}&no_rooms=${v.rooms.length}${ageQ}&selected_currency=BRL` },
    { source: 'Decolar', url: `https://www.decolar.com/accommodations/results/C:${city}/${v.checkIn}/${v.checkOut}/${v.adults}?rooms=${v.rooms.length}${v.childAges.length ? '&childAges=' + v.childAges.join(',') : ''}` },
    { source: 'Hoteis.com', url: `https://www.hoteis.com/Hotel-Search?destination=${city}&startDate=${v.checkIn}&endDate=${v.checkOut}&adults=${v.adults}&children=${v.childAges.length}&rooms=${v.rooms.length}${v.childAges.map(a => `&childAge=${a}`).join('')}&sort=PRICE_LOW_TO_HIGH` },
    { source: 'Expedia', url: `https://www.expedia.com.br/Hotel-Search?destination=${city}&startDate=${v.checkIn}&endDate=${v.checkOut}&adults=${v.adults}&children=${v.childAges.length}&rooms=${v.rooms.length}${ageQ}` },
    { source: 'Kayak', url: `https://www.kayak.com.br/hotels/${slug},Brasil/${v.checkIn}/${v.checkOut}/${v.adults}adults${kids}/${v.rooms.length}rooms?sort=price_a` },
    { source: 'Trivago', url: `https://www.trivago.com.br/pt-BR/srl?search=100-${encodeURIComponent(slug)};dr-${v.checkIn.replace(/-/g, '')}-${v.checkOut.replace(/-/g, '')}` },
    { source: 'Hurb', url: `https://www.hurb.com/search?q=${city}&type=hotel&checkin=${v.checkIn}&checkout=${v.checkOut}&adults=${v.adults}&children=${v.childAges.length}` },
  ];
}

function applyFlightFilters(offers, v) {
  return offers.filter(o => {
    if (typeof o.price !== 'number' || !(o.price > 0) || !o.url) return false;
    if (v.maxPrice != null && o.price > v.maxPrice) return false;
    if (v.maxStops != null && o.stops != null && o.stops > v.maxStops) return false;
    if (v.baggage && o.baggage === false) return false;
    if (v.airlines.length && o.airline) {
      const blob = normalize(`${o.airline} ${o.airlineName || ''}`);
      if (!v.airlines.some(a => blob.includes(normalize(a)))) return false;
    }
    if (v.airlines.length && !o.airline) return false;
    if (v.departWindow && v.departWindow !== 'any' && o.depart) {
      const h = Number(String(o.depart).slice(11, 13));
      if (Number.isFinite(h)) {
        const win = { madrugada: [0, 5], manha: [5, 12], tarde: [12, 18], noite: [18, 24] }[v.departWindow];
        if (win && (h < win[0] || h >= win[1])) return false;
      }
    }
    return true;
  });
}

function applyHotelFilters(offers, v) {
  return offers.filter(o => {
    if (typeof o.price !== 'number' || !(o.price > 0) || !o.url) return false;
    const perNight = o.priceBasis === 'noite' ? o.price : o.price / v.nights;
    if (v.priceMin != null && perNight < v.priceMin) return false;
    if (v.priceMax != null && perNight > v.priceMax) return false;
    if (v.stars != null && o.stars != null && o.stars < v.stars) return false;
    if (v.ratingMin != null && o.rating != null && o.rating < v.ratingMin) return false;
    if (v.maxDistanceKm != null && o.distanceKm != null && o.distanceKm > v.maxDistanceKm) return false;
    if (v.propertyType && o.propertyType && o.propertyType !== v.propertyType) return false;
    if (v.breakfast && o.breakfast === false) return false;
    if (v.freeCancellation && o.freeCancellation === false) return false;
    if (v.amenities.length && Array.isArray(o.amenities)) {
      if (!v.amenities.every(a => o.amenities.includes(a))) return false;
    }
    return true;
  });
}

function sortOffers(offers, sort) {
  const copy = [...offers];
  const num = (v) => (typeof v === 'number' ? v : Infinity);
  if (sort === 'duration') copy.sort((a, b) => num(a.durationMin) - num(b.durationMin) || a.price - b.price);
  else if (sort === 'rating') copy.sort((a, b) => num(b.rating) - num(a.rating) || a.price - b.price);
  else if (sort === 'distance') copy.sort((a, b) => num(a.distanceKm) - num(b.distanceKm) || a.price - b.price);
  else copy.sort((a, b) => a.price - b.price);
  return copy;
}

function coldStartHint(elapsedMs) {
  if (elapsedMs < 4000) return '';
  return 'Se o serviço acabou de acordar no plano gratuito do Render, a primeira resposta pode levar cerca de 30 segundos.';
}

module.exports = {
  AIRPORTS, resolveAirport, validateHotel, validateFlight, flightLinks, hotelLinks,
  applyFlightFilters, applyHotelFilters, sortOffers, splitPax, todayISO, coldStartHint, nightsBetween,
};
