const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const runs = [['farmacia','losartana','50mg · 30 comp'],['farmacia','losartana','Combinações (com outro princípio ativo)'],['farmacia','dipirona','500mg · 10 comp'],['mercado','arroz','5kg'],['petshop','racao golden',null]];
  for (const [seg,q,v] of runs) {
    const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, geolocation: { latitude: -23.0187, longitude: -43.4893 }, permissions: ['geolocation'] });
    const p = await ctx.newPage(); await p.goto('http://localhost:3000');
    await p.click(`button[data-s=${seg}]`); await p.fill('#q', q); await p.click('form button');
    await p.waitForSelector('.chip', { timeout: 60000 });
    const name = q.replace(/\s+/g,'-') + (v && v.startsWith('Comb') ? '-combinacoes' : '');
    await p.screenshot({ path: `screens/${seg}-${name}-variantes.png`, fullPage: true });
    if (v) await p.click(`.chip[data-v="${v}"]`); else await p.click('.chip[data-v=""]');
    await p.waitForSelector('.card', { timeout: 90000 });
    await p.screenshot({ path: `screens/${seg}-${name}-ofertas.png`, fullPage: true });
    await ctx.close();
  }
  await b.close();
})();
