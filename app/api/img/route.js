const fallbackSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
  <rect width="200" height="150" fill="#f5f5f7"/>
  <rect x="75" y="45" width="50" height="50" rx="6" fill="#e0e0e0"/>
  <circle cx="88" cy="58" r="6" fill="#c7c7c7"/>
  <polygon points="75,95 95,65 110,80 125,60 150,95" fill="#d0d0d0"/>
</svg>`

function fallbackResponse() {
  return new Response(fallbackSvg.trim(), {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

async function fetchImage(targetUrl) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: targetUrl,
        Origin: new URL(targetUrl).origin,
        Connection: 'keep-alive',
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
      },
    })

    if (!res.ok) return null

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return null

    const buffer = await res.arrayBuffer()
    if (!buffer || buffer.byteLength === 0) return null

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const rawUrl = searchParams.get('url')

  if (!rawUrl) return fallbackResponse()

  let targetUrl

  try {
    targetUrl = decodeURIComponent(rawUrl)
    const parsed = new URL(targetUrl)

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return fallbackResponse()
    }
  } catch {
    return fallbackResponse()
  }

  const direct = await fetchImage(targetUrl)
  if (direct) return direct

  return fallbackResponse()
}
