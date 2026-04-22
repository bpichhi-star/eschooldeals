const fallbackSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
  <rect width="200" height="150" fill="#f5f5f7"/>
  <rect x="75" y="45" width="50" height="50" rx="6" fill="#e0e0e0"/>
  <circle cx="88" cy="58" r="6" fill="#c7c7c7"/>
  <polygon points="75,95 95,65 110,80 125,60 150,95" fill="#d0d0d0"/>
</svg>`

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  const fallback = new Response(fallbackSvg.trim(), {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })

  if (!url) return fallback

  try {
    const res = await fetch(decodeURIComponent(url), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!res.ok) return fallback

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return fallback

    const buffer = await res.arrayBuffer()

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return fallback
  }
}
