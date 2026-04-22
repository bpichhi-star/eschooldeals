export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
          return new Response('Missing url param', { status: 400 })
        }

    try {
          const res = await fetch(url, {
                  headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                          },
                })

          if (!res.ok) {
                  return new Response('Image fetch failed', { status: 502 })
                }

          const contentType = res.headers.get('content-type') || 'image/jpeg'
          const buffer = await res.arrayBuffer()

          return new Response(buffer, {
                  headers: {
                            'Content-Type': contentType,
                            'Cache-Control': 'public, max-age=86400',
                          },
                })
        } catch {
          return new Response('Image fetch error', { status: 500 })
        }
  }
