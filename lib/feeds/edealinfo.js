// lib/feeds/edealinfo.js
// Tries multiple proxy services in sequence to get past IP-based blocking.
// Logs exactly which proxy works and which fails so we can see in Vercel logs.
import { categorize, mapExternalCategory } from '@/lib/utils/categorize'
import { buildAffiliateUrl } from '@/lib/utils/affiliateUrl'

const FEEDS = [
  { url: 'https://www.edealinfo.com/deals-rss.php',             label: 'edealinfo-all' },
  { url: 'https://www.edealinfo.com/deals-rss.php?s=top',       label: 'edealinfo-top' },
  { url: 'https://www.edealinfo.com/deals-rss.php?cat=comp',    label: 'edealinfo-tech' },
  { url: 'https://www.edealinfo.com/deals-rss.php?cat=nontech', label: 'edealinfo-nontech' },
]

// Try multiple proxies in order
const PROXIES = [
  { name: 'rss2json',   build: (url) => 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url), type: 'json' },
  { name: 'allorigins', build: (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),            type: 'xml' },
  { name: 'cors.sh',    build: (url) => 'https://cors.sh/' + url,                                                  type: 'xml' },
]

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/xml,text/xml,*/*',
  'Referer': 'https://www.google.com/',
}

const OTHER_AGGREGATORS = new Set(['slickdeals.net','dealnews.com','dealsea.com','dealsplus.com'])
function isOtherAggregator(url='') { try { return OTHER_AGGREGATORS.has(new URL(url).hostname.replace('www.','')); } catch { return false } }

function unwrapEdiUrl(href='') {
  if (!href.includes('edealinfo.com')) return href
  try {
    const u = new URL(href)
    for (const p of ['u','url','dest','destination','target','link','goto','out','to']) {
      const val = u.searchParams.get(p)
      if (val) { const d = decodeURIComponent(val); if (d.startsWith('http')) return d }
    }
  } catch {}
  return null
}

function extractMerchantUrl(html='') {
  const decoded = html.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  const hrefRe = /href=["']([^"']+)["']/gi; let m
  while ((m = hrefRe.exec(decoded)) !== null) {
    let href = m[1].trim()
    if (!href.startsWith('http')) continue
    if (/\.(jpg|jpeg|png|gif|webp|svg)|pixel|beacon/i.test(href)) continue
    if (href.includes('edealinfo.com')) { href = unwrapEdiUrl(href); if (!href) continue }
    if (isOtherAggregator(href)) continue
    return href
  }
  return null
}

function extractAsin(t='') { const m = t.match(/amazon\.com\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i); return m?.[1]||null }
function merchantName(url='') {
  try {
    const h = new URL(url).hostname.replace('www.','')
    const map = {'amazon.com':'AMAZON','walmart.com':'WALMART','woot.com':'WOOT','bestbuy.com':'BEST BUY','target.com':'TARGET','ebay.com':'EBAY','homedepot.com':'HOME DEPOT','newegg.com':'NEWEGG','costco.com':'COSTCO','dell.com':'DELL','lenovo.com':'LENOVO','apple.com':'APPLE'}
    return map[h] || h.split('.')[0].toUpperCase()
  } catch { return 'STORE' }
}

function parseSalePrice(t='') {
  const a = t.match(/only\s+\$\s*([\d,]+\.?\d*)/i); if (a) return parseFloat(a[1].replace(/,/g,''))
  const b = t.match(/\$\s*([\d,]+\.?\d*)/); return b ? parseFloat(b[1].replace(/,/g,'')) : null
}
function parseOriginalPrice(d='') {
  const m = d.match(/Compare.*?\(\$\s*([\d,]+\.?\d*)\)/i) || d.match(/(?:was|reg|list)\s*:?\s*\$\s*([\d,]+\.?\d*)/i)
  return m ? parseFloat(m[1].replace(/,/g,'')) : null
}
function computeDiscount(s,o) { if (!o||!s||o<=s) return 0; return Math.round((1-s/o)*100) }

function parseJsonItem(item, feedLabel) {
  const title = (item.title||'').trim(), ediLink = item.link||'', desc = item.description||item.content||''
  const category = (item.categories||[])[0]||'', guid = item.guid||ediLink
  if (!title) return null
  const sale_price = parseSalePrice(title); if (!sale_price) return null
  const descText = desc.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
  const original_price = parseOriginalPrice(descText)||null
  const discount_pct = computeDiscount(sale_price, original_price)
  const image = item.thumbnail||null
  const asin = extractAsin(desc+' '+ediLink)
  const rawUrl = asin ? 'https://www.amazon.com/dp/'+asin : extractMerchantUrl(desc)||unwrapEdiUrl(ediLink)
  if (!rawUrl||rawUrl.includes('edealinfo.com')) return null
  const product_url = buildAffiliateUrl(rawUrl, asin||null)
  const merchant = asin ? 'AMAZON' : merchantName(rawUrl)
  const mappedCategory = mapExternalCategory ? mapExternalCategory(category,title) : categorize(title,descText)
  const score = Math.min(discount_pct,50)+(image?10:0)+(desc.includes('Super Hot')?8:0)
  return { source_key:feedLabel, external_id:guid, merchant, source_type:'rss', title:title.replace(/\s+only\s+\$[\d.,]+\s*$/i,'').trim(), category:mappedCategory, sale_price, original_price, discount_pct, product_url, image_url:image, currency:'USD', in_stock:true, is_student_relevant:discount_pct>=20&&['Electronics','Computers','Phones'].includes(mappedCategory), is_featured:false, score, fetched_at:new Date().toISOString(), status:'active' }
}

function parseXmlItems(xml, feedLabel) {
  const items=[]; const re=/<item>([\s\S]*?)<\/item>/gi; let m
  while((m=re.exec(xml))!==null) {
    try {
      const getC = (tag) => { const r=new RegExp('<'+tag+'[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></'+tag+'>|<'+tag+'[^>]*>([^<]*)</'+tag+'>','i'); const x=m[1].match(r); return x?(x[1]||x[2]||'').trim():'' }
      const title=getC('title'), link=(m[1].match(/<link>([^<]+)<\/link>/)||[])[1]?.trim()||'', desc=getC('description'), guid=getC('guid')
      if(!title) continue
      const sale_price=parseSalePrice(title); if(!sale_price) continue
      const descText=desc.replace(/<[^>]+>/g,' ').trim()
      const original_price=parseOriginalPrice(descText)||null, discount_pct=computeDiscount(sale_price,original_price)
      const imgM=desc.match(/<img[^>]+src=["']([^"']+)["']/i); const image=imgM?imgM[1]:null
      const asin=extractAsin(desc+' '+link)
      const rawUrl=asin?'https://www.amazon.com/dp/'+asin:extractMerchantUrl(desc)||unwrapEdiUrl(link)
      if(!rawUrl||rawUrl.includes('edealinfo.com')) continue
      items.push({ source_key:feedLabel, external_id:guid||link, merchant:asin?'AMAZON':merchantName(rawUrl), source_type:'rss', title, category:categorize(title,descText), sale_price, original_price, discount_pct, product_url:buildAffiliateUrl(rawUrl,asin||null), image_url:image, currency:'USD', in_stock:true, is_student_relevant:discount_pct>=20, is_featured:false, score:Math.min(discount_pct,50)+(image?10:0), fetched_at:new Date().toISOString(), status:'active' })
    } catch(e) { console.warn('[edealinfo] xml parse err:',e.message) }
  }
  return items
}

async function fetchWithProxy(feedUrl, label) {
  for (const proxy of PROXIES) {
    const pUrl = proxy.build(feedUrl)
    try {
      const res = await fetch(pUrl, { headers: proxy.name==='allorigins'?{}:BROWSER_HEADERS, next:{revalidate:0} })
      if (!res.ok) { console.warn('[edealinfo] '+proxy.name+' HTTP '+res.status+' for '+label); continue }
      if (proxy.type === 'json') {
        const data = await res.json()
        if (data.status !== 'ok') { console.warn('[edealinfo] '+proxy.name+' status='+data.status+' msg='+data.message+' for '+label); continue }
        const items = (data.items||[]).map(i=>parseJsonItem(i,label)).filter(Boolean)
        console.log('[edealinfo] '+proxy.name+' SUCCESS for '+label+': '+items.length+' deals from '+(data.items||[]).length+' items')
        return items
      } else {
        const xml = await res.text()
        if (!xml.includes('<item>')) { console.warn('[edealinfo] '+proxy.name+' no items in response for '+label+', start: '+xml.slice(0,100)); continue }
        const items = parseXmlItems(xml, label)
        console.log('[edealinfo] '+proxy.name+' SUCCESS for '+label+': '+items.length+' deals')
        return items
      }
    } catch(e) { console.warn('[edealinfo] '+proxy.name+' error for '+label+': '+e.message) }
  }
  console.error('[edealinfo] ALL PROXIES FAILED for '+label)
  return []
}

export async function fetchEDealInfoDeals() {
  console.log('[edealinfo] Fetching', FEEDS.length, 'feeds, trying', PROXIES.map(p=>p.name).join(', '))
  const results = await Promise.allSettled(FEEDS.map(f => fetchWithProxy(f.url, f.label)))
  results.forEach((r,i) => { if(r.status==='rejected') console.error('[edealinfo]',FEEDS[i].label,'rejected:',r.reason?.message) })
  const all = results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value)
  const seen = new Set()
  return all.filter(d => { const k=d.external_id||d.title?.slice(0,60); if(seen.has(k)) return false; seen.add(k); return true })
}
