import Link from 'next/link'
import NavBar from '@/components/NavBar'

// Catalog of student perks, grouped by section. The homepage StudentHub
// shows the top 11 of these; this page surfaces the long tail. To add a
// new perk, drop it into the relevant category — no other plumbing needed.
//
// Every perk should have:
//   - brand     : display name on the tile and brand-dot initial
//   - color     : brand-color for the dot background
//   - offer     : one-line description of the deal
//   - price     : the student price ('Free' / '$X.XX/mo' / 'Discount' etc.)
//   - origPrice : optional regular price for the strikethrough
//   - url       : signup / info link (opens in new tab)
const PERKS = [
  {
    title: 'Software & Productivity',
    items: [
      { brand: 'Microsoft', color: '#00A4EF', offer: 'Office 365 Education (Word, Excel, PowerPoint)', price: 'Free', origPrice: '$9.99/mo', url: 'https://www.microsoft.com/en-us/education/products/office' },
      { brand: 'Notion',    color: '#000000', offer: 'Notion Plus for students',                       price: 'Free', origPrice: '$16/mo',   url: 'https://www.notion.so/students' },
      { brand: 'Adobe',     color: '#FF0000', offer: 'Creative Cloud — All Apps',                      price: '$19.99/mo', origPrice: '$59.99/mo', url: 'https://www.adobe.com/creativecloud/buy/students.html' },
      { brand: 'Canva',     color: '#00C4CC', offer: 'Pro for Education',                              price: 'Free', origPrice: '$14.99/mo', url: 'https://www.canva.com/education/' },
      { brand: 'Figma',     color: '#F24E1E', offer: 'Education plan — full Figma + FigJam',           price: 'Free', origPrice: '$15/mo',   url: 'https://www.figma.com/education/' },
      { brand: 'Grammarly', color: '#15C39A', offer: 'Premium discount with .edu email',               price: 'Discount', origPrice: '',     url: 'https://www.grammarly.com/edu' },
    ],
  },
  {
    title: 'Streaming & Entertainment',
    items: [
      { brand: 'Spotify',    color: '#1DB954', offer: 'Premium Student + Hulu (with ads)',  price: '$6.99/mo', origPrice: '$11.99/mo', url: 'https://www.spotify.com/us/student/' },
      { brand: 'Apple',      color: '#1d1d1f', offer: 'Apple Music Student',                price: '$5.99/mo', origPrice: '$10.99/mo', url: 'https://music.apple.com/us/student' },
      { brand: 'YouTube',    color: '#FF0000', offer: 'YouTube Premium Student',            price: '$7.99/mo', origPrice: '$13.99/mo', url: 'https://www.youtube.com/premium/student' },
      { brand: 'Hulu',       color: '#1CE783', offer: 'Hulu Student (with ads)',            price: '$1.99/mo', origPrice: '$9.99/mo',  url: 'https://www.hulu.com/student' },
      { brand: 'Paramount+', color: '#0064FF', offer: "Paramount+ Essential — student rate", price: '$4.99/mo', origPrice: '$7.99/mo',  url: 'https://www.paramountplus.com/account/signup/student/' },
      { brand: 'Peacock',    color: '#000000', offer: 'Peacock Premium Student',            price: '$1.99/mo', origPrice: '$7.99/mo',  url: 'https://www.peacocktv.com/student' },
    ],
  },
  {
    title: 'Career & Developer Tools',
    items: [
      { brand: 'GitHub',       color: '#181717', offer: 'Student Developer Pack — $200K+ in tools',       price: 'Free',         origPrice: '',           url: 'https://education.github.com/pack' },
      { brand: 'LinkedIn',     color: '#0A66C2', offer: 'Premium — 1 month free trial',                   price: 'Free trial',   origPrice: '$39.99/mo',  url: 'https://www.linkedin.com/premium/products/' },
      { brand: 'JetBrains',    color: '#000000', offer: 'IntelliJ, PyCharm, etc. — all IDEs',            price: 'Free',         origPrice: '$249/yr',    url: 'https://www.jetbrains.com/community/education/' },
      { brand: 'DigitalOcean', color: '#0080FF', offer: '$200 platform credit (via GitHub Student Pack)', price: '$200 credit',  origPrice: '',           url: 'https://www.digitalocean.com/github-students' },
      { brand: 'Notion AI',    color: '#000000', offer: 'AI add-on free with Notion student account',     price: 'Free',         origPrice: '$10/mo',     url: 'https://www.notion.so/students' },
      { brand: 'Asana',        color: '#F06A6A', offer: 'Premium free for students',                      price: 'Free',         origPrice: '$10.99/mo',  url: 'https://asana.com/education' },
    ],
  },
  {
    title: 'Hardware & Tech',
    items: [
      { brand: 'Apple',    color: '#1d1d1f', offer: 'Mac & iPad Education Pricing',         price: 'Up to $200 off', origPrice: '', url: 'https://www.apple.com/us-edu/store' },
      { brand: 'Amazon',   color: '#FF9900', offer: 'Prime for Young Adults — 6 mo free',   price: '$7.49/mo after', origPrice: '$14.99/mo', url: 'https://www.amazon.com/youngadult' },
      { brand: 'HP',       color: '#0096D6', offer: 'HP Education Store discounts',         price: 'Up to 35% off',  origPrice: '', url: 'https://www.hp.com/us-en/shop/cv/edu' },
      { brand: 'Dell',     color: '#007DB8', offer: 'Dell Student & Member Purchase Plan',  price: 'Discount',       origPrice: '', url: 'https://www.dell.com/en-us/shop/scc/sc/member-purchase-program' },
      { brand: 'Lenovo',   color: '#E2231A', offer: 'Lenovo Student Discount Program',      price: 'Up to 20% off',  origPrice: '', url: 'https://www.lenovo.com/us/en/education/' },
      { brand: 'Samsung',  color: '#1428A0', offer: 'Samsung Education Store',              price: 'Up to 30% off',  origPrice: '', url: 'https://www.samsung.com/us/shop/offer-program/education-offers-program/' },
    ],
  },
  {
    title: 'News & Reading',
    items: [
      { brand: 'NYT',       color: '#000000', offer: 'New York Times — Student rate',  price: '$4/mo',     origPrice: '$17/mo',   url: 'https://www.nytimes.com/subscription/edu' },
      { brand: 'WSJ',       color: '#000000', offer: 'Wall Street Journal — Student',  price: 'Discount',  origPrice: '$36.99/mo', url: 'https://store.wsj.com/student' },
      { brand: 'Audible',   color: '#F8991C', offer: 'Audible Premium Plus discount',  price: '$9.95/mo',  origPrice: '$14.95/mo', url: 'https://www.audible.com/ep/students' },
      { brand: 'Kindle',    color: '#FF9900', offer: 'Kindle Unlimited — free trial',  price: '6 mo free', origPrice: '$11.99/mo', url: 'https://www.amazon.com/kindle-dbs/hz/signup' },
    ],
  },
  {
    title: 'Wellness',
    items: [
      { brand: 'Headspace', color: '#F47D31', offer: 'Headspace Student Plan',         price: '$9.99/yr',  origPrice: '$69.99/yr', url: 'https://www.headspace.com/studentplan' },
      { brand: 'Calm',      color: '#2A82FF', offer: 'Calm — student discount',        price: '$8.99/yr',  origPrice: '$69.99/yr', url: 'https://www.calm.com/blog/calm-students' },
    ],
  },
]

export const metadata = {
  title:       'Student Perks — Software, Streaming & More | eSchoolDeals',
  description: 'Free and discounted software, streaming services, dev tools, and more for students. Spotify, Microsoft 365, GitHub Pack, Adobe Creative Cloud, and more.',
}

export default function PerksPage() {
  return (
    <>
      <NavBar />
      <main style={{ maxWidth:1200, margin:'0 auto', padding:'24px 20px 64px' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <Link href="/" style={{ fontSize:13, color:'var(--text-secondary, #6b7280)', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:4 }}>
            ← Back to deals
          </Link>
          <h1 style={{ fontSize:32, fontWeight:800, margin:'12px 0 6px', color:'var(--text-primary, #111827)' }}>
            Student Perks
          </h1>
          <p style={{ fontSize:15, color:'var(--text-secondary, #6b7280)', margin:0 }}>
            Free and discounted software, subscriptions, and tools for students. Most require a verified .edu email or signup through the linked program.
          </p>
        </div>

        {/* Perk sections */}
        {PERKS.map(section => (
          <section key={section.title} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize:18, fontWeight:700, margin:'0 0 12px', color:'var(--text-primary, #111827)' }}>
              {section.title}
            </h2>
            <div className="student-grid">
              {section.items.map((item, idx) => (
                <a
                  key={section.title + ':' + idx}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="student-card"
                >
                  <div className="student-brand-dot" style={{ background: item.color }}>
                    {item.brand.charAt(0)}
                  </div>
                  <div className="student-brand-name">{item.brand}</div>
                  <div className="student-offer">{item.offer}</div>
                  <div className="student-price">{item.price}</div>
                  {item.origPrice && <div className="student-price-orig">{item.origPrice}</div>}
                </a>
              ))}
            </div>
          </section>
        ))}

        {/* Footer note */}
        <div style={{ marginTop:48, padding:'20px 24px', background:'#f9fafb', borderRadius:12, border:'1px solid #e5e7eb' }}>
          <p style={{ fontSize:13, color:'#6b7280', margin:0, lineHeight:1.6 }}>
            Most perks require a verified <strong>.edu email</strong> or signup through services like SheerID, UNiDAYS, or the program's own verification. Pricing and eligibility set by each provider — eSchoolDeals only links to the official signup page. If you spot an outdated price or broken link, hit the contact link in the footer.
          </p>
        </div>
      </main>
    </>
  )
}
