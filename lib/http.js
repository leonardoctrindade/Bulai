const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';

async function get(url, opts = {}) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), opts.timeout || 10000);
  try {
    const r = await fetch(url, {
      method: opts.method || 'GET',
      headers: {
        'User-Agent': opts.ua || UA,
        'Accept-Language': 'pt-BR',
        Accept: opts.accept || (opts.text ? 'text/html' : 'application/json'),
        ...(opts.headers || {}),
      },
      body: opts.body,
      signal: ctl.signal,
    });
    if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status);
    return opts.text ? r.text() : r.json();
  } finally { clearTimeout(to); }
}

module.exports = { get, UA };
