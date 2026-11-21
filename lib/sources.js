const { get } = require('./http');

// Public search-only Algolia credentials shipped in the Raia/Drogasil storefront.
// The storefront itself is behind a bot wall; the search index is not.
const RD_APP = 'A7RGTHYMDQ';
const RD_KEY = '2136627307d7d5384f92cda9f7e5357c';

function algolia({ id, name, segment, site, index, osmQuery, aliases, priority = 0 }) {
  return {
    id, name, segment, osmQuery, aliases, priority, onlineOnly: false,
    async search(q) {
      const params = new URLSearchParams({ query: q, hitsPerPage: '40' }).toString();
      const data = await get(`https://${RD_APP}-dsn.algolia.net/1/indexes/*/queries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-algolia-application-id': RD_APP,
          'x-algolia-api-key': RD_KEY,
        },
        body: JSON.stringify({ requests: [{ indexName: index, params }] }),
        accept: 'application/json',
      });
      const hits = data.results?.[0]?.hits || [];
      const out = [];
      for (const h of hits) {
        const price = typeof h.price === 'number' ? h.price : parseFloat(String(h.price || '').replace(',', '.'));
        if (!price || price <= 0) continue;
        const slug = String(h.url || '').replace(/^\//, '');
        out.push({
          chainId: id, store: name, title: h.name, brand: typeof h.brand === 'string' ? h.brand : h.brand?.name,
          price, url: slug ? `${site}/${slug}` : site,
          image: h.images?.default || h.images?.small || null,
        });
      }
      return out;
    },
  };
}

function vtex({ id, name, segment, site, api, osmQuery, aliases, priority = 1 }) {
  const base = (api || site).replace(/\/$/, '');
  const pub = site.replace(/\/$/, '');
  return {
    id, name, segment, osmQuery, aliases, priority, onlineOnly: false,
    async search(q) {
      const data = await get(`${base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=0&_to=49`);
      if (!Array.isArray(data)) throw new Error('resposta inesperada');
      const out = [];
      for (const p of data) for (const it of p.items || []) {
        const s = (it.sellers || []).find(x => x.commertialOffer && x.commertialOffer.AvailableQuantity > 0 && x.commertialOffer.Price > 0);
        if (!s) continue;
        const url = p.linkText ? `${pub}/${p.linkText}/p` : (p.link || pub);
        out.push({
          chainId: id, store: name, title: it.nameComplete || p.productName, brand: p.brand,
          category: (p.categories || [])[0], price: s.commertialOffer.Price, listPrice: s.commertialOffer.ListPrice,
          url, image: it.images?.[0]?.imageUrl || null,
        });
      }
      return out;
    },
  };
}

const buscape = {
  id: null, name: 'Buscapé (comparador)', segment: null, onlineOnly: true, priority: 9, aliases: [],
  async search(q) {
    const h = await get(`https://www.buscape.com.br/search?q=${encodeURIComponent(q)}`, { text: true, timeout: 12000 });
    const m = h.match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) throw new Error('sem dados');
    const hits = JSON.parse(m[1]).props?.initialReduxState?.hits?.hits || [];
    return hits.filter(x => x.price).map(x => ({
      chainId: null, onlineOnly: true,
      store: (x.bestOffer?.merchantName || 'Loja') + ' (via Buscapé)',
      merchant: x.bestOffer?.merchantName,
      title: x.name, price: x.price, url: 'https://www.buscape.com.br' + x.url,
      category: x.categoryName, image: x.image,
    }));
  },
};

const CHAINS = [
  algolia({ id: 'raia', name: 'Droga Raia', segment: 'farmacia', site: 'https://www.drogaraia.com.br', index: 'drogaraia-rd-product-index', osmQuery: 'Droga Raia', aliases: ['droga raia', 'raia'], priority: 0 }),
  algolia({ id: 'drogasil', name: 'Drogasil', segment: 'farmacia', site: 'https://www.drogasil.com.br', index: 'drogasil-rd-product-index', osmQuery: 'Drogasil', aliases: ['drogasil'], priority: 0 }),
  vtex({ id: 'paguemenos', name: 'Pague Menos', segment: 'farmacia', site: 'https://www.paguemenos.com.br', osmQuery: 'Pague Menos', aliases: ['pague menos'], priority: 0 }),
  vtex({ id: 'extrafarma', name: 'Extrafarma', segment: 'farmacia', site: 'https://www.extrafarma.com.br', osmQuery: 'Extrafarma', aliases: ['extrafarma'], priority: 0 }),
  vtex({ id: 'saopaulo', name: 'Drogaria São Paulo', segment: 'farmacia', site: 'https://www.drogariasaopaulo.com.br', osmQuery: 'Drogaria São Paulo', aliases: ['drogaria sao paulo', 'drogarias sao paulo'], priority: 1 }),
  vtex({ id: 'pacheco', name: 'Drogarias Pacheco', segment: 'farmacia', site: 'https://www.drogariaspacheco.com.br', osmQuery: 'Drogarias Pacheco', aliases: ['pacheco'], priority: 1 }),
  vtex({ id: 'venancio', name: 'Drogaria Venancio', segment: 'farmacia', site: 'https://www.drogariavenancio.com.br', osmQuery: 'Drogaria Venancio', aliases: ['venancio'], priority: 1 }),
  vtex({ id: 'saojoao', name: 'São João Farmácias', segment: 'farmacia', site: 'https://www.saojoaofarmacias.com.br', osmQuery: 'São João Farmácias', aliases: ['sao joao'], priority: 1 }),
  vtex({ id: 'indiana', name: 'Farmácia Indiana', segment: 'farmacia', site: 'https://www.farmaciaindiana.com.br', osmQuery: 'Farmácia Indiana', aliases: ['farmacia indiana', 'indiana'], priority: 1 }),
  vtex({ id: 'drogal', name: 'Drogal', segment: 'farmacia', site: 'https://www.drogal.com.br', osmQuery: 'Drogal', aliases: ['drogal'], priority: 1 }),
  vtex({ id: 'catarinense', name: 'Drogaria Catarinense', segment: 'farmacia', site: 'https://www.drogariacatarinense.com.br', osmQuery: 'Drogaria Catarinense', aliases: ['catarinense'], priority: 1 }),
  vtex({ id: 'araujo', name: 'Drogaria Araujo', segment: 'farmacia', site: 'https://www.araujo.com.br', api: 'https://araujo.vtexcommercestable.com.br', osmQuery: 'Drogaria Araujo', aliases: ['araujo'], priority: 1 }),

  vtex({ id: 'carrefour', name: 'Carrefour', segment: 'mercado', site: 'https://www.carrefour.com.br', api: 'https://carrefourbr.vtexcommercestable.com.br', osmQuery: 'Carrefour', aliases: ['carrefour'], priority: 0 }),
  vtex({ id: 'atacadao', name: 'Atacadão', segment: 'mercado', site: 'https://www.atacadao.com.br', osmQuery: 'Atacadão', aliases: ['atacadao'], priority: 0 }),
  vtex({ id: 'muffato', name: 'Super Muffato', segment: 'mercado', site: 'https://www.supermuffato.com.br', osmQuery: 'Super Muffato', aliases: ['muffato'], priority: 1 }),
  vtex({ id: 'angeloni', name: 'Angeloni', segment: 'mercado', site: 'https://www.angeloni.com.br/super', osmQuery: 'Angeloni', aliases: ['angeloni'], priority: 1 }),
  vtex({ id: 'zaffari', name: 'Zaffari', segment: 'mercado', site: 'https://www.zaffari.com.br', osmQuery: 'Zaffari', aliases: ['zaffari'], priority: 1 }),
  vtex({ id: 'prezunic', name: 'Prezunic', segment: 'mercado', site: 'https://www.prezunic.com.br', osmQuery: 'Prezunic', aliases: ['prezunic'], priority: 1 }),
  vtex({ id: 'zonasul', name: 'Zona Sul', segment: 'mercado', site: 'https://www.zonasul.com.br', api: 'https://zonasul.vtexcommercestable.com.br', osmQuery: 'Zona Sul', aliases: ['zona sul'], priority: 1 }),
  vtex({ id: 'gbarbosa', name: 'GBarbosa', segment: 'mercado', site: 'https://www.gbarbosa.com.br', osmQuery: 'GBarbosa', aliases: ['gbarbosa', 'g barbosa'], priority: 1 }),
  vtex({ id: 'hortifruti', name: 'Hortifruti', segment: 'mercado', site: 'https://www.hortifruti.com.br', osmQuery: 'Hortifruti', aliases: ['hortifruti'], priority: 1 }),
  vtex({ id: 'mambo', name: 'Mambo', segment: 'mercado', site: 'https://www.mambo.com.br', osmQuery: 'Supermercado Mambo', aliases: ['mambo'], priority: 1 }),
  vtex({ id: 'savegnago', name: 'Savegnago', segment: 'mercado', site: 'https://www.savegnago.com.br', osmQuery: 'Savegnago', aliases: ['savegnago'], priority: 1 }),
  vtex({ id: 'supernosso', name: 'Super Nosso', segment: 'mercado', site: 'https://www.supernosso.com.br', osmQuery: 'Super Nosso', aliases: ['super nosso', 'supernosso'], priority: 1 }),
  vtex({ id: 'hiperideal', name: 'Hiperideal', segment: 'mercado', site: 'https://www.hiperideal.com.br', osmQuery: 'Hiperideal', aliases: ['hiperideal'], priority: 1 }),
  vtex({ id: 'bretas', name: 'Bretas', segment: 'mercado', site: 'https://www.bretas.com.br', osmQuery: 'Supermercado Bretas', aliases: ['bretas'], priority: 1 }),
  vtex({ id: 'giassi', name: 'Giassi', segment: 'mercado', site: 'https://www.giassi.com.br', osmQuery: 'Giassi', aliases: ['giassi'], priority: 1 }),
  vtex({ id: 'coop', name: 'Coop', segment: 'mercado', site: 'https://www.coopsupermercado.com.br', osmQuery: 'Coop supermercado', aliases: ['coop'], priority: 1 }),
  vtex({ id: 'formosa', name: 'Formosa', segment: 'mercado', site: 'https://www.formosa.com.br', osmQuery: 'Supermercados Formosa', aliases: ['formosa'], priority: 1 }),

  vtex({ id: 'cobasi', name: 'Cobasi', segment: 'petshop', site: 'https://www.cobasi.com.br', osmQuery: 'Cobasi', aliases: ['cobasi'], priority: 0 }),
];

const BY_ID = new Map(CHAINS.map(c => [c.id, c]));

function sourcesFor(segment) {
  return [...CHAINS.filter(c => c.segment === segment), buscape];
}

module.exports = { CHAINS, BY_ID, sourcesFor, buscape };
