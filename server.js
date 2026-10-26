const express = require('express');
const path = require('path');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const OSM_UA = 'BuscaPrecosPrototype/0.1 (prototipo pessoal; contato via Grok Bot)';
const DEFAULT = { lat: -23.0187, lon: -43.4893 };
const cache = new Map();
async function cached(key, ttl, fn) {
  const c = cache.get(key); if (c && Date.now() - c.t < ttl) return c.v;
  const v = await fn(); cache.set(key, { t: Date.now(), v }); return v;
}
const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
async function get(url, opts = {}) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': opts.ua || UA, 'Accept-Language': 'pt-BR' }, signal: ctl.signal, ...opts.fetch });
    if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status);
    return opts.text ? r.text() : r.json();
  } finally { clearTimeout(to); }
}

// ---- Sources ----
const vtex = (name, base, osm) => ({ name, osm, async search(q) {
  const data = await get(`${base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=0&_to=49`);
  const out = [];
  for (const p of data) for (const it of p.items || []) {
    const s = (it.sellers || []).find(s => s.commertialOffer && s.commertialOffer.AvailableQuantity > 0);
    if (!s) continue;
    out.push({ store: name, title: it.nameComplete || p.productName, brand: p.brand, category: (p.categories || [])[0], price: s.commertialOffer.Price,
      listPrice: s.commertialOffer.ListPrice, url: p.link || `${base}/${p.linkText}/p`, image: it.images?.[0]?.imageUrl, osm });
  }
  return out;
}});
const buscape = { name: 'Buscapé (comparador)', async search(q) {
  const h = await get(`https://www.buscape.com.br/search?q=${encodeURIComponent(q)}`, { text: true });
  const m = h.match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (!m) throw new Error('sem dados');
  const hits = JSON.parse(m[1]).props.initialReduxState.hits.hits || [];
  return hits.filter(x => x.price).map(x => ({ store: (x.bestOffer?.merchantName || 'Loja') + ' (via Buscapé)', merchant: x.bestOffer?.merchantName,
    title: x.name, price: x.price, url: 'https://www.buscape.com.br' + x.url, category: x.categoryName, image: x.image, osm: x.bestOffer?.merchantName, storeCount: x.storeCount }));
}};
const SOURCES = {
  farmacia: [vtex('Drogarias Pacheco', 'https://www.drogariaspacheco.com.br', 'Pacheco'), vtex('Drogaria Venancio', 'https://www.drogariavenancio.com.br', 'Venancio'),
    vtex('Pague Menos', 'https://www.paguemenos.com.br', 'Pague Menos'), vtex('Drogaria São Paulo', 'https://www.drogariasaopaulo.com.br', 'Drogaria São Paulo'), buscape],
  mercado: [vtex('Prezunic', 'https://www.prezunic.com.br', 'Prezunic'), vtex('Zona Sul', 'https://www.zonasul.com.br', 'Zona Sul'),
    vtex('Atacadão', 'https://www.atacadao.com.br', 'Atacadão'), buscape],
  petshop: [vtex('Cobasi', 'https://www.cobasi.com.br', 'Cobasi'), buscape],
};

// ---- Variants: extract dosage/size + quantity from titles ----
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
    await Promise.all(SOURCES[seg].map(async src => {
      const t0 = Date.now();
      try { const r = await src.search(q); const ok = r.filter(x => toks.every(w => norm(x.title).replace(/\s/g, '').includes(w.replace(/\s/g, ''))));
        items.push(...ok); status.push({ source: src.name, ok: true, count: ok.length, ms: Date.now() - t0 }); }
      catch (e) { status.push({ source: src.name, ok: false, error: String(e.message || e), ms: Date.now() - t0 }); }
    }));
    const nq = norm(q);
    const BAD = /panela|eletric|eletrodom|maquina|cooker|liquidific|fogao|forno|micro-?ondas|cozedor|celular|notebook|brinquedo|livro|camiseta|capinha/;
    items = items.filter(i => !BAD.test(norm(i.title + ' ' + (i.category || ''))) || BAD.test(nq));
    if (seg !== 'farmacia') { const f = norm(q).split(/\s+/)[0]; const head = items.filter(i => norm(i.title).startsWith(f));
      if (head.length >= 5) items = head; }
    const COMBO = /\+|\bassociad|hidroclorotiazida|anlodipino|cafeina|orfenadrina|escopolamina|butilbrometo|clorfeniramina|paracetamol|anlodipina|\bcomposto\b/;
    for (const i of items) {
      const t = norm(i.title); const m = t.match(COMBO);
      if (seg === 'farmacia' && m && !(m[0] !== '+' && nq.includes(m[0])) && !nq.includes('+')) i.variant = 'Combinações (com outro princípio ativo)';
      else i.variant = variantOf(i.title) || 'Outros';
    }
    // grupos com 1 oferta só viram "Outros"
    const cnt = {}; items.forEach(i => cnt[i.variant] = (cnt[i.variant] || 0) + 1);
    items.forEach(i => { if (cnt[i.variant] < 2) i.variant = i.variant.startsWith('Combinações') ? i.variant : 'Outros'; });
    return { items, status };
  });
}

// ---- Store locations via Overpass (one query per segment+area, cached 24h) ----
const _unused = {
  farmacia: ['nwr["amenity"="pharmacy"]', 'nwr["shop"="chemist"]'],
  mercado: ['nwr["shop"="supermarket"]', 'nwr["shop"="wholesale"]'],
  petshop: ['nwr["shop"="pet"]'],
};
function hav(a, b, c, d) { const R = 6371, r = x => x * Math.PI / 180; const x = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
let nomQ = Promise.resolve();
function nominatim(url) { // fila: no máx. 1 req/s (política do Nominatim)
  const p = nomQ.then(() => get(url, { ua: OSM_UA })); nomQ = p.catch(() => {}).then(() => new Promise(r => setTimeout(r, 1100))); return p;
}
async function branches(chain, lat, lon) {
  const d = 0.15, key = `n:${norm(chain)}:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const c = cache.get(key); if (c) return c.v;
  const vb = [lon - d, lat + d, lon + d, lat - d].map(x => x.toFixed(4)).join(',');
  const r = await nominatim(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(chain)}&format=jsonv2&limit=40&bounded=1&viewbox=${vb}&addressdetails=1&accept-language=pt-BR`);
  const v = r.filter(e => e.category === 'shop' || e.category === 'amenity').map(e => { const a = e.address || {};
    return { name: e.name || chain, lat: +e.lat, lon: +e.lon, addr: [a.road, a.house_number].filter(Boolean).join(', ') + (a.suburb ? ' - ' + a.suburb : '') }; });
  cache.set(key, { t: Date.now(), v }); return v;
}
function hav(a, b, c, d) { const R = 6371, r = x => x * Math.PI / 180; const x = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
function nearest(shops, lat, lon) {
  if (!shops || !shops.length) return null;
  return shops.map(s => ({ ...s, km: hav(lat, lon, s.lat, s.lon) })).sort((a, b) => a.km - b.km)[0];
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const SEGS = Object.keys(SOURCES);
const rank = v => v === 'Outros' ? 2 : v.startsWith('Combinações') ? 1 : 0;
// rate limit simples por IP: 30 req/min na API
const hits = new Map();
app.set('trust proxy', true);
app.use('/api', (req, res, next) => { const ip = req.ip, now = Date.now(); const h = (hits.get(ip) || []).filter(t => now - t < 60e3); h.push(now); hits.set(ip, h);
  if (h.length > 30) return res.status(429).json({ error: 'Muitas buscas. Aguarde um minuto.' }); next(); });
app.get('/api/variants', async (req, res) => {
  const seg = SEGS.includes(req.query.seg) ? req.query.seg : 'farmacia'; const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Digite um produto' });
  const { items, status } = await searchAll(seg, q);
  const g = {}; for (const i of items) { (g[i.variant] ||= { variant: i.variant, count: 0, min: Infinity }); g[i.variant].count++; g[i.variant].min = Math.min(g[i.variant].min, i.price); }
  const variants = Object.values(g).sort((a, b) => rank(a.variant) - rank(b.variant) || b.count - a.count).slice(0, 16);
  res.json({ q, seg, variants, total: items.length, status });
});
app.get('/api/offers', async (req, res) => {
  const seg = SEGS.includes(req.query.seg) ? req.query.seg : 'farmacia'; const q = (req.query.q || '').trim();
  const lat = parseFloat(req.query.lat) || DEFAULT.lat, lon = parseFloat(req.query.lon) || DEFAULT.lon;
  const { items, status } = await searchAll(seg, q);
  let list = req.query.variant ? items.filter(i => i.variant === req.query.variant) : items;
  list = [...list].sort((a, b) => a.price - b.price).slice(0, 40);
  const chains = [...new Set(list.map(i => i.osm).filter(Boolean))].slice(0, 8); const br = {}; let osmOk = true, osmErr, nShops = 0;
  for (const ch of chains) { try { br[ch] = await branches(ch, lat, lon); nShops += br[ch].length; } catch (e) { osmOk = false; osmErr = String(e.message); } }
  const offers = list.map(i => { const n = nearest(br[i.osm], lat, lon);
    return { ...i, osm: undefined, nearest: n ? { name: n.name, address: n.addr || null, km: +n.km.toFixed(1), lat: n.lat, lon: n.lon } : null }; });
  res.json({ q, seg, variant: req.query.variant || null, location: { lat, lon }, offers, status, osm: { ok: osmOk, shops: nShops, error: osmErr } });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Busca Preços em http://localhost:' + PORT));
