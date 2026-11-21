const express = require('express');
const path = require('path');
const { interpretQuery, selectGenericOffers, savingsBetween, classifyQuery, NO_GENERIC_MESSAGE, NONE_FOUND_MESSAGE } = require('./lib/resolve');
const { get } = require('./lib/http');
const { sourcesFor, BY_ID } = require('./lib/sources');
const { RADIUS_KM, norm, hav, shopMatchesChain, splitOffers, normalizeCep } = require('./lib/places');
const { validateHotel, validateFlight, resolveAirport } = require('./lib/travel');
const { searchHotels, searchFlights } = require('./lib/travel-sources');

const OSM_UA = 'BuscaPrecosPrototype/0.2 (prototipo pessoal; contato via Grok Bot)';
const DEFAULT = { lat: -23.0187, lon: -43.4893, label: 'Recreio, Rio de Janeiro' };
const cache = new Map();
async function cached(key, ttl, fn) {
  const c = cache.get(key); if (c && Date.now() - c.t < ttl) return c.v;
  const v = await fn(); cache.set(key, { t: Date.now(), v }); return v;
}

const SEGS = ['farmacia', 'mercado', 'petshop'];

function variantOf(title) {
  const t = norm(title).replace(/(\d),(\d)/g, '$1.$2');
  const dose = t.match(/(\d+(?:\.\d+)?)\s*(mg\/ml|mcg|mg|kg|g|ml|l)\b/);
  const qty = t.match(/(\d+)\s*(comprimidos?|comp|cps|capsulas?|caps|drageas?|unidades|un|saches?|envelopes?)\b/) || t.match(/\bc\/\s*(\d+)/);
  const form = /gotas|gts/.test(t) ? 'gotas' : /xarope/.test(t) ? 'xarope' : /injet/.test(t) ? 'injetável' : /efervescente/.test(t) ? 'efervescente' : null;
  if (!dose && !qty) return null;
  const parts = [];
  if (dose) { let n = +dose[1], u = dose[2]; if (u === 'g' && n < 1) { n *= 1000; u = 'mg'; } if (u === 'mg' && n >= 1000 && n % 1000 === 0) { n /= 1000; u = 'g'; } parts.push(n + u); }
  if (qty) { const n = qty[1]; const unit = qty[2] && /^(caps|cps|capsula)/.test(qty[2]) ? 'cáps' : qty[2] && /^(un|sache|envelope)/.test(qty[2]) ? 'un' : 'comp'; parts.push(`${n} ${unit}`); }
  if (form) parts.push(form);
  return parts.join(' · ');
}

async function searchAll(seg, q) {
  return cached(`s:${seg}:${norm(q)}`, 15 * 60e3, async () => {
    const toks = norm(q).split(/\s+/).filter(w => w.length > 1);
    const status = []; let items = [];
    await Promise.all(sourcesFor(seg).map(async src => {
      const t0 = Date.now();
      try {
        const r = await src.search(q);
        const ok = r.filter(x => toks.every(w => norm(x.title).replace(/\s/g, '').includes(w.replace(/\s/g, ''))));
        items.push(...ok);
        status.push({ source: src.name, ok: true, count: ok.length, ms: Date.now() - t0 });
      } catch (e) { status.push({ source: src.name, ok: false, error: String(e.message || e), ms: Date.now() - t0 }); }
    }));
    const nq = norm(q);
    const BAD = /panela|eletric|eletrodom|maquina|cooker|liquidific|fogao|forno|micro-?ondas|cozedor|celular|notebook|brinquedo|livro|camiseta|capinha/;
    items = items.filter(i => !BAD.test(norm(i.title + ' ' + (i.category || ''))) || BAD.test(nq));
    if (seg === 'mercado' && !/racao|caes|cachorr|gato|felin|canin|pet/.test(nq)) {
      items = items.filter(i => !/racao|caes|cachorr|gato|felin|canin|petisco/.test(norm(i.title + ' ' + (i.category || ''))));
    }
    if (seg !== 'farmacia') {
      const f = norm(q).split(/\s+/)[0];
      const head = items.filter(i => norm(i.title).startsWith(f));
      if (head.length >= 5) items = head;
    }
    const COMBO = /\+|\bassociad|hidroclorotiazida|anlodipino|cafeina|orfenadrina|escopolamina|butilbrometo|clorfeniramina|paracetamol|anlodipina|\bcomposto\b/;
    for (const i of items) {
      const t = norm(i.title); const m = t.match(COMBO);
      if (seg === 'farmacia' && m && !(m[0] !== '+' && nq.includes(m[0])) && !nq.includes('+')) i.variant = 'Combinações (com outro princípio ativo)';
      else i.variant = variantOf(i.title) || 'Outros';
    }
    const cnt = {}; items.forEach(i => cnt[i.variant] = (cnt[i.variant] || 0) + 1);
    items.forEach(i => { if (cnt[i.variant] < 2) i.variant = i.variant.startsWith('Combinações') ? i.variant : 'Outros'; });
    return { items, status };
  });
}

let nomQ = Promise.resolve();
function nominatim(url) {
  const p = nomQ.then(() => get(url, { ua: OSM_UA, timeout: 12000 }));
  nomQ = p.catch(() => {}).then(() => new Promise(r => setTimeout(r, 1100)));
  return p;
}

function placeOk(e, chain) {
  const cat = e.category || '', type = e.type || '', name = norm(e.name || '');
  if (chain.segment === 'farmacia') {
    if (type === 'pharmacy' || type === 'chemist') return true;
    return /farmacia|drogaria|drugstore|drogal|raia|drogasil|pacheco|venancio|nissei|panvel/.test(name);
  }
  if (chain.segment === 'mercado') {
    if (cat === 'shop' && /super|wholesale|mall|convenience|department/.test(type)) return true;
    return /super|atacad|mercado|hiper|carrefour|mambo|zaffari|muffato|angeloni/.test(name);
  }
  if (chain.segment === 'petshop') return type === 'pet' || /pet|cobasi/.test(name);
  return cat === 'shop' || cat === 'amenity';
}
async function branches(chain, lat, lon) {
  const key = `n:${chain.id}:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const c = cache.get(key); if (c) return c.v;
  const d = 0.45;
  const vb = [lon - d, lat + d, lon + d, lat - d].map(x => x.toFixed(4)).join(',');
  const r = await nominatim(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(chain.osmQuery)}&format=jsonv2&limit=30&bounded=1&viewbox=${vb}&addressdetails=1&accept-language=pt-BR`);
  const v = (Array.isArray(r) ? r : [])
    .filter(e => placeOk(e, chain) && shopMatchesChain(e.name || e.display_name || '', chain))
    .map(e => {
      const a = e.address || {};
      const slat = +e.lat, slon = +e.lon;
      return {
        name: e.name || chain.name, lat: slat, lon: slon,
        addr: [a.road, a.house_number].filter(Boolean).join(', ') + (a.suburb ? ' - ' + a.suburb : ''),
        km: hav(lat, lon, slat, slon),
      };
    })
    .filter(s => s.km <= 80);
  cache.set(key, { t: Date.now(), v });
  return v;
}

async function locateChains(chainIds, lat, lon) {
  const ranked = [...new Set(chainIds)].map(id => BY_ID.get(id)).filter(Boolean)
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    .slice(0, 18);
  const br = {}; let osmOk = true, osmErr, nShops = 0;
  for (const ch of ranked) {
    try { br[ch.id] = await branches(ch, lat, lon); nShops += br[ch.id].length; }
    catch (e) { osmOk = false; osmErr = String(e.message || e); br[ch.id] = []; }
  }
  return { br, osm: { ok: osmOk, shops: nShops, error: osmErr, radiusKm: RADIUS_KM } };
}

async function resolvePlace(raw) {
  const q = String(raw || '').trim();
  const cep = normalizeCep(q);
  if (cep) {
    try {
      const j = await get(`https://brasilapi.com.br/api/cep/v2/${cep}`, { timeout: 8000 });
      const c = j.location && j.location.coordinates;
      const lat = parseFloat(c && c.latitude), lon = parseFloat(c && c.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon, label: `${j.city} - ${j.state}`, cep };
    } catch { /* tenta ViaCEP + Nominatim */ }
    const j = await get(`https://viacep.com.br/ws/${cep}/json/`, { timeout: 8000 });
    if (j.erro) throw new Error('CEP não encontrado');
    const hits = await nominatim(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${j.localidade}, ${j.uf}, Brasil`)}&format=jsonv2&limit=1&countrycodes=br`);
    if (!hits.length) throw new Error('CEP não encontrado');
    return { lat: +hits[0].lat, lon: +hits[0].lon, label: `${j.localidade} - ${j.uf}`, cep };
  }
  const hits = await nominatim(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&countrycodes=br&addressdetails=1`);
  if (!Array.isArray(hits) || !hits.length) throw new Error('local não encontrado');
  const a = hits[0].address || {};
  const city = a.city || a.town || a.village || a.municipality || hits[0].name;
  const label = [city, a.state].filter(Boolean).join(' - ') || hits[0].display_name;
  return { lat: +hits[0].lat, lon: +hits[0].lon, label };
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '32kb' }));
const rank = v => v === 'Outros' ? 2 : v.startsWith('Combinações') ? 1 : 0;
const hits = new Map();
app.set('trust proxy', true);
app.use('/api', (req, res, next) => {
  const ip = req.ip, now = Date.now();
  const h = (hits.get(ip) || []).filter(t => now - t < 60e3);
  h.push(now); hits.set(ip, h);
  if (h.length > 30) return res.status(429).json({ error: 'Muitas buscas. Aguarde um minuto.' });
  next();
});

function variantSummary(items) {
  const g = {};
  for (const i of items) {
    (g[i.variant] ||= { variant: i.variant, count: 0, min: Infinity });
    g[i.variant].count++;
    g[i.variant].min = Math.min(g[i.variant].min, i.price);
  }
  return { variants: Object.values(g).sort((a, b) => rank(a.variant) - rank(b.variant) || b.count - a.count).slice(0, 16), total: items.length };
}
function correctionPayload(correction) {
  if (!correction) return null;
  if (correction.type === 'auto') return { type: 'auto', typed: correction.typed, term: correction.term, display: correction.display };
  return { type: 'suggest', typed: correction.typed, suggestions: (correction.suggestions || []).map(s => ({ term: s.term, display: s.display })) };
}
async function resolveAndSearch(seg, rawQ) {
  const interp = interpretQuery(rawQ, seg);
  let searchQ = interp.searchQuery;
  let correction = interp.correction;
  let commerce = classifyQuery(searchQ, seg);
  const parallelGeneric = interp.zeroResult?.decision === 'auto' ? null : (commerce.brand?.hasGeneric && commerce.brand.genericQuery);
  const [data0, gen0] = await Promise.all([
    searchAll(seg, searchQ),
    parallelGeneric ? searchAll(seg, parallelGeneric) : Promise.resolve(null),
  ]);
  let data = data0;
  let genericRaw = gen0;
  const reachable = data.status.some(s => s.ok);
  if (!data.items.length && reachable && interp.zeroResult?.decision === 'auto' && norm(interp.zeroResult.searchQuery) !== norm(searchQ)) {
    const retry = await searchAll(seg, interp.zeroResult.searchQuery);
    if (retry.items.length) {
      data = retry;
      searchQ = interp.zeroResult.searchQuery;
      correction = interp.zeroResult.correction;
      commerce = classifyQuery(searchQ, seg);
      genericRaw = (commerce.brand?.hasGeneric && commerce.brand.genericQuery) ? await searchAll(seg, commerce.brand.genericQuery) : null;
    }
  } else if (!data.items.length && reachable && !correction && interp.zeroResult?.decision === 'suggest') {
    correction = interp.zeroResult.correction;
  }
  let generic = null;
  if (commerce.brand) {
    generic = commerce.brand.hasGeneric
      ? { unavailable: false, q: commerce.brand.genericQuery, items: genericRaw?.items || [], status: genericRaw?.status || [] }
      : { unavailable: true, message: NO_GENERIC_MESSAGE, q: null, items: [], status: [] };
  }
  return { searchQ, correction, commerce, data, generic };
}

app.get('/api/airports', (req, res) => {
  const found = resolveAirport(req.query.q || '');
  res.json({ decision: found.decision, airport: found.airport || null, suggestions: found.suggestions || [] });
});
app.post('/api/hotels', async (req, res) => {
  const parsed = validateHotel(req.body || {});
  if (!parsed.ok) return res.status(400).json(parsed);
  let center = null;
  try { center = await resolvePlace(parsed.value.city); } catch { center = null; }
  try {
    const out = await searchHotels(parsed.value, center);
    res.json({ ...out, center });
  } catch (e) {
    res.status(502).json({ error: 'Não foi possível consultar os hotéis agora.', offers: [], sources: [], message: String(e.message || e) });
  }
});
app.post('/api/flights', async (req, res) => {
  const parsed = validateFlight(req.body || {});
  if (!parsed.ok) return res.status(400).json(parsed);
  try {
    const out = await searchFlights(parsed.value);
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: 'Não foi possível consultar as passagens agora.', offers: [], sources: [], message: String(e.message || e) });
  }
});
app.get('/api/geo', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Informe um CEP ou cidade' });
  try { res.json(await resolvePlace(q)); }
  catch (e) { res.status(404).json({ error: String(e.message || e) }); }
});

app.get('/api/variants', async (req, res) => {
  const seg = SEGS.includes(req.query.seg) ? req.query.seg : 'farmacia';
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Digite um produto' });
  const found = await resolveAndSearch(seg, q);
  const summary = variantSummary(found.data.items);
  let generic = null;
  if (found.generic) {
    const picked = found.generic.unavailable ? [] : selectGenericOffers(found.generic.items, found.commerce.brand, null);
    const gs = variantSummary(picked);
    generic = {
      unavailable: !!found.generic.unavailable,
      message: found.generic.unavailable ? NO_GENERIC_MESSAGE : (picked.length ? null : NONE_FOUND_MESSAGE),
      q: found.generic.q, variants: gs.variants, total: gs.total, min: picked[0]?.price ?? null,
    };
  }
  res.json({
    q, resolvedQ: found.searchQ, seg, correction: correctionPayload(found.correction),
    brand: found.commerce.brand, ingredient: found.commerce.ingredient, generic,
    variants: summary.variants, total: summary.total, status: found.data.status, radiusKm: RADIUS_KM,
  });
});

app.get('/api/offers', async (req, res) => {
  const seg = SEGS.includes(req.query.seg) ? req.query.seg : 'farmacia';
  const q = (req.query.q || '').trim();
  const lat = parseFloat(req.query.lat) || DEFAULT.lat, lon = parseFloat(req.query.lon) || DEFAULT.lon;
  const label = (req.query.label || '').trim() || null;
  const found = await resolveAndSearch(seg, q);
  let list = req.query.variant ? found.data.items.filter(i => i.variant === req.query.variant) : found.data.items;
  list = [...list].sort((a, b) => a.price - b.price);
  const genericItems = (found.generic && !found.generic.unavailable)
    ? selectGenericOffers(found.generic.items, found.commerce.brand, req.query.variant || null) : [];
  const ids = [...list, ...genericItems].map(i => i.chainId).filter(Boolean);
  const located = await locateChains(ids, lat, lon);
  const main = splitOffers(list, located.br, lat, lon);
  const genSplit = splitOffers(genericItems, located.br, lat, lon);
  const offers = main.nearby.slice(0, 40);
  const online = main.online.slice(0, 20);
  const genericOffers = genSplit.nearby.slice(0, 12);
  const genericOnline = genSplit.online.slice(0, 8);
  let generic = null;
  if (found.generic) {
    const priceBase = offers.length ? offers : online;
    const genBase = genericOffers.length ? genericOffers : genericOnline;
    generic = {
      unavailable: !!found.generic.unavailable,
      message: found.generic.unavailable ? NO_GENERIC_MESSAGE : (genBase.length ? null : NONE_FOUND_MESSAGE),
      q: found.generic.q, offers: genericOffers, online: genericOnline,
      min: genBase[0]?.price ?? null,
      savings: found.generic.unavailable ? null : savingsBetween(priceBase, genBase),
      status: found.generic.status,
    };
  }
  res.json({
    q, resolvedQ: found.searchQ, seg, variant: req.query.variant || null,
    location: { lat, lon, label, radiusKm: RADIUS_KM },
    correction: correctionPayload(found.correction), brand: found.commerce.brand, ingredient: found.commerce.ingredient,
    generic, offers, online, status: found.data.status, osm: located.osm,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Busca Preços em http://localhost:' + PORT));
