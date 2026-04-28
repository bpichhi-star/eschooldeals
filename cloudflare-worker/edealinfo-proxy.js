// cloudflare-worker/edealinfo-proxy.js
//
// Cloudflare Worker that fetches eDealInfo RSS feeds from inside Cloudflare's
// own network. Workers run on CF edge nodes whose IPs have high reputation
// scores in CF's bot detection — much more likely to pass than Vercel egress
// IPs (which the public-internet "Just a moment..." challenge already proved
// are blocked).
//
// Deploy:
//   1. https://dash.cloudflare.com → Workers & Pages → Create → "Edit code"
//   2. Paste this file, click Deploy
//   3. Note the URL (e.g. https://edealinfo-proxy.<your-subdomain>.workers.dev)
//   4. Add a secret in Worker → Settings → Variables → Add:
//        Name:  PROXY_SECRET
//        Value: <generate a long random string, e.g. `openssl rand -hex 32`>
//   5. In Vercel project → Settings → Environment Variables → add BOTH:
//        EDEALINFO_PROXY_URL    = https://edealinfo-proxy.<sub>.workers.dev
//        EDEALINFO_PROXY_SECRET = <same secret as in step 4>
//   6. Redeploy Vercel (or push any commit) so the env vars take effect
//
// Free tier: 100,000 requests/day. Our cron uses ~8/day. Plenty of headroom.

const ALLOWED_HOSTS = new Set(['www.edealinfo.com', 'edealinfo.com'])

const BROWSER_HEADERS = {
  'User-Agent':                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language':           'en-US,en;q=0.9',
  'Accept-Encoding':           'gzip, deflate, br',
  'Cache-Control':             'no-cache',
  'Pragma':                    'no-cache',
  'Sec-Ch-Ua':                 '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile':          '?0',
  'Sec-Ch-Ua-Platform':        '"Windows"',
  'Sec-Fetch-Dest':            'document',
  'Sec-Fetch-Mode':            'navigate',
  'Sec-Fetch-Site':            'none',
  'Sec-Fetch-User':            '?1',
  'Upgrade-Insecure-Requests': '1',
  'Referer':                   'https://www.google.com/',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Health check — `GET /` returns ok so we can confirm the Worker is live
    if (url.pathname === '/' && !url.searchParams.has('url')) {
      return new Response(JSON.stringify({ ok: true, service: 'edealinfo-proxy' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Auth — require shared secret to prevent randos hammering this Worker
    if (env.PROXY_SECRET) {
      const provided = request.headers.get('x-proxy-secret') || url.searchParams.get('secret')
      if (provided !== env.PROXY_SECRET) {
        return new Response('Unauthorized', { status: 401 })
      }
    }

    // Validate target URL — only edealinfo.com hosts allowed
    const target = url.searchParams.get('url')
    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400 })
    }

    let parsed
    try { parsed = new URL(target) }
    catch { return new Response('Bad url', { status: 400 }) }

    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return new Response('Host not in allowlist', { status: 403 })
    }
    if (parsed.protocol !== 'https:') {
      return new Response('https only', { status: 400 })
    }

    // Fetch upstream from inside Cloudflare's network
    let upstream
    try {
      upstream = await fetch(parsed.toString(), {
        headers: BROWSER_HEADERS,
        cf: {
          // Cache aggressively at CF edge — eDealInfo updates ~hourly
          cacheTtl: 300,
          cacheEverything: true,
        },
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: 'upstream fetch failed', message: e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await upstream.text()

    // Detect if upstream still served a Cloudflare challenge despite Worker IP
    const isChallenge = /just a moment|cf-browser-verification|cf-chl-bypass/i.test(body.slice(0, 2000))

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type':         upstream.headers.get('content-type') || 'application/xml',
        'Cache-Control':        'public, max-age=300',
        'X-Upstream-Status':    String(upstream.status),
        'X-Upstream-Size':      String(body.length),
        'X-Upstream-Challenge': isChallenge ? 'yes' : 'no',
      },
    })
  },
}
