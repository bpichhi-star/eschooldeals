import { useState } from "react";

const products = [
  { id: 1, emoji: "🎒", cat: "Travel",     name: "Travel Pouch Pack",         price: 28, badge: "new" },
  { id: 2, emoji: "🌀", cat: "Cables",     name: "Universal Braided Wires",   price: 18, oldPrice: 24, badge: "popular" },
  { id: 3, emoji: "🔌", cat: "Adapters",   name: "Universal Adaptor with USB",price: 39 },
  { id: 4, emoji: "🎵", cat: "Earbuds",    name: "Inpod Earpods",             price: 49, badge: "new" },
  { id: 5, emoji: "🎧", cat: "Headphones", name: "Over Ear Headphones",       price: 79, oldPrice: 99 },
];

const ACCENT = "#E84B2A";
const INK = "#18181A";
const BG = "#F8F7F4";
const BORDER = "rgba(24,24,26,0.08)";
const BORDER2 = "rgba(24,24,26,0.14)";
const MUTED = "#A0A0A8";
const INK2 = "#52525A";

const s = {
  root: { fontFamily: "'Outfit',sans-serif", background: BG, color: INK, minHeight: "100vh" },
  nav: { position: "sticky", top: 0, zIndex: 100, background: "rgba(248,247,244,0.94)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6vw", height: 62 },
  logo: { fontSize: 20, fontWeight: 800, color: INK, textDecoration: "none", letterSpacing: "-0.03em" },
  accent: { color: ACCENT },
  navRight: { display: "flex", alignItems: "center", gap: 10 },
  navIcon: { background: "none", border: `1px solid ${BORDER2}`, color: INK2, width: 36, height: 36, borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  cartPill: { background: INK, color: BG, border: "none", padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, textDecoration: "none" },
  cartBadge: { background: ACCENT, color: "#fff", fontSize: 10, fontWeight: 700, width: 17, height: 17, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  hero: { padding: "72px 6vw 80px", textAlign: "center", borderBottom: `1px solid ${BORDER}` },
  eyebrow: { display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(232,75,42,0.08)", border: "1px solid rgba(232,75,42,0.15)", color: ACCENT, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 100, marginBottom: 24 },
  h1: { fontSize: "clamp(36px,5vw,66px)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.0, marginBottom: 18, maxWidth: 680, marginLeft: "auto", marginRight: "auto" },
  heroSub: { color: INK2, fontSize: 17, fontWeight: 300, maxWidth: 420, margin: "0 auto 36px", lineHeight: 1.7 },
  heroBtns: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" },
  btnPrimary: { background: ACCENT, color: "#fff", border: "none", padding: "13px 28px", fontSize: 14, fontWeight: 600, borderRadius: 10, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  btnSecondary: { background: "#fff", color: INK, border: `1px solid ${BORDER2}`, padding: "13px 28px", fontSize: 14, fontWeight: 500, borderRadius: 10, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  strip: { display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 48, flexWrap: "wrap" },
  stripItem: { fontSize: 13, color: MUTED },
  stripDot: { width: 4, height: 4, background: BORDER2, borderRadius: "50%" },
  productsSec: { padding: "80px 6vw" },
  secLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 6 },
  secTitle: { fontSize: "clamp(24px,2.5vw,34px)", fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 36 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14 },
  card: { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 18, overflow: "hidden", cursor: "pointer", position: "relative" },
  badge: { position: "absolute", top: 12, left: 12, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 5 },
  badgeNew: { background: INK, color: BG },
  badgePop: { background: ACCENT, color: "#fff" },
  fav: { position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.9)", border: "none", width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" },
  cardImg: { background: BG, aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, padding: 20 },
  cardBody: { padding: 16 },
  cardCat: { fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 500, marginBottom: 4 },
  cardName: { fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 14, letterSpacing: "-0.01em" },
  cardBottom: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  price: { fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" },
  oldPrice: { fontSize: 12, color: MUTED, textDecoration: "line-through", marginRight: 3 },
  addBtn: { background: INK, color: "#fff", border: "none", width: 34, height: 34, borderRadius: 9, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" },
  addBtnAdded: { background: ACCENT },
  infoBand: { background: INK, color: BG, padding: "0 6vw", display: "grid", gridTemplateColumns: "repeat(3,1fr)" },
  infoItem: { display: "flex", alignItems: "center", gap: 14, padding: "28px 24px", borderRight: "1px solid rgba(255,255,255,0.07)" },
  infoIcon: { fontSize: 22, flexShrink: 0 },
  infoTitle: { fontSize: 14, fontWeight: 600, marginBottom: 2 },
  infoSub: { fontSize: 12, color: "rgba(248,247,244,0.45)", fontWeight: 300 },
  newsletter: { padding: "80px 6vw", textAlign: "center", borderTop: `1px solid ${BORDER}` },
  nlH2: { fontSize: "clamp(24px,2.8vw,36px)", fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 10 },
  nlSub: { color: INK2, fontSize: 15, fontWeight: 300, marginBottom: 28 },
  nlForm: { display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  nlInput: { background: "#fff", border: `1px solid ${BORDER2}`, color: INK, padding: "13px 18px", fontSize: 14, borderRadius: 10, width: 270, outline: "none", fontFamily: "inherit" },
  footer: { background: INK, color: BG, padding: "48px 6vw 28px" },
  footerInner: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 40, marginBottom: 40 },
  footerTagline: { fontSize: 13, color: "rgba(248,247,244,0.4)", fontWeight: 300, marginTop: 10, maxWidth: 200, lineHeight: 1.6 },
  footerColTitle: { fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(248,247,244,0.5)", marginBottom: 14 },
  footerList: { listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 9 },
  footerLink: { color: "rgba(248,247,244,0.4)", textDecoration: "none", fontSize: 14, fontWeight: 300 },
  footerBottom: { borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontSize: 12, color: "rgba(248,247,244,0.3)" },
  footerBottomLink: { color: "rgba(248,247,244,0.3)", textDecoration: "none" },
};

export default function EschoolDeals() {
  const [cartCount, setCartCount] = useState(0);
  const [added, setAdded] = useState({});
  const [favs, setFavs] = useState({});
  const [email, setEmail] = useState("");

  const handleAdd = (id) => {
    setCartCount(c => c + 1);
    setAdded(a => ({ ...a, [id]: true }));
    setTimeout(() => setAdded(a => ({ ...a, [id]: false })), 1400);
  };

  return (
    <div style={s.root}>
      <nav style={s.nav}>
        <a href="#" style={s.logo}>eschool<span style={s.accent}>deals</span></a>
        <div style={s.navRight}>
          <button style={s.navIcon}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
          <a href="#" style={s.cartPill}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Cart <span style={s.cartBadge}>{cartCount}</span>
          </a>
        </div>
      </nav>

      <section style={s.hero}>
        <div style={s.eyebrow}>
          <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
          Student Essentials
        </div>
        <h1 style={s.h1}>Everything You Need,<br/><span style={s.accent}>Nothing You Don't.</span></h1>
        <p style={s.heroSub}>Five carefully picked products for students. Quality gear at prices that don't hurt.</p>
        <div style={s.heroBtns}>
          <a href="#products" style={s.btnPrimary}>Shop Now</a>
          <a href="#" style={s.btnSecondary}>Student Discount</a>
        </div>
        <div style={s.strip}>
          <span style={s.stripItem}>📦 Free shipping $35+</span>
          <div style={s.stripDot}/>
          <span style={s.stripItem}>🎓 10% student discount</span>
          <div style={s.stripDot}/>
          <span style={s.stripItem}>🔄 30-day returns</span>
        </div>
      </section>

      <section style={s.productsSec} id="products">
        <div style={s.secLabel}>Our Range</div>
        <div style={s.secTitle}>The Full Collection</div>
        <div style={s.grid}>
          {products.map(p => (
            <div key={p.id} style={s.card}>
              {p.badge && <span style={{...s.badge,...(p.badge==="new"?s.badgeNew:s.badgePop)}}>{p.badge==="new"?"New":"Popular"}</span>}
              <button style={s.fav} onClick={()=>setFavs(f=>({...f,[p.id]:!f[p.id]}))}>
                {favs[p.id] ? "♥" : "♡"}
              </button>
              <div style={s.cardImg}>{p.emoji}</div>
              <div style={s.cardBody}>
                <div style={s.cardCat}>{p.cat}</div>
                <div style={s.cardName}>{p.name}</div>
                <div style={s.cardBottom}>
                  <div>
                    {p.oldPrice && <span style={s.oldPrice}>${p.oldPrice}</span>}
                    <span style={s.price}>${p.price}</span>
                  </div>
                  <button style={{...s.addBtn,...(added[p.id]?s.addBtnAdded:{})}} onClick={()=>handleAdd(p.id)}>
                    {added[p.id] ? "✓" : "+"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={s.infoBand}>
        {[
          {icon:"📦",title:"Free Shipping",sub:"On orders over $35"},
          {icon:"🎓",title:"Student Discount",sub:"10% off with .edu email"},
          {icon:"🔄",title:"Easy Returns",sub:"30-day hassle-free returns"}
        ].map((item,i)=>(
          <div key={item.title} style={{...s.infoItem,...(i===2?{borderRight:"none"}:{})}}>
            <span style={s.infoIcon}>{item.icon}</span>
            <div><div style={s.infoTitle}>{item.title}</div><div style={s.infoSub}>{item.sub}</div></div>
          </div>
        ))}
      </div>

      <section style={s.newsletter}>
        <h2 style={s.nlH2}>Get <span style={s.accent}>student deals</span> in your inbox</h2>
        <p style={s.nlSub}>No spam. Just deals, restocks, and new arrivals.</p>
        <div style={s.nlForm}>
          <input style={s.nlInput} type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)}/>
          <button style={s.btnPrimary} onClick={()=>setEmail("")}>Subscribe</button>
        </div>
      </section>

      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div>
            <a href="#" style={{...s.logo,color:"#F8F7F4",fontSize:18}}>eschool<span style={s.accent}>deals</span></a>
            <p style={s.footerTagline}>Simple gear for students. No fluff, no markup.</p>
          </div>
          <div>
            <div style={s.footerColTitle}>Products</div>
            <ul style={s.footerList}>{products.map(p=><li key={p.id}><a href="#" style={s.footerLink}>{p.name}</a></li>)}</ul>
          </div>
          <div>
            <div style={s.footerColTitle}>Help</div>
            <ul style={s.footerList}>{["Track My Order","Returns","Student Discount","Contact Us","FAQ"].map(l=><li key={l}><a href="#" style={s.footerLink}>{l}</a></li>)}</ul>
          </div>
        </div>
        <div style={s.footerBottom}>
          <span>© 2025 eschooldeals. All rights reserved.</span>
          <div style={{display:"flex",gap:20}}>
            <a href="#" style={s.footerBottomLink}>Privacy</a>
            <a href="#" style={s.footerBottomLink}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
