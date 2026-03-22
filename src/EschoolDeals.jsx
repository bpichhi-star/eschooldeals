import { useState, useEffect, useRef } from "react";

// ─── Shopify Config ───────────────────────────────────────────────────────────

const SHOP = "eschooldeals.myshopify.com";
const TOKEN = "a0bbc8e255258dd255746ab4dbc1eff5";
const API_URL = `https://${SHOP}/api/2024-01/graphql.json`;

const gql = async (query, variables = {}) => {
    const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": TOKEN },
          body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    return json.data;
};

const GET_PRODUCTS = `
  query {
      products(first: 50) {
            edges {
                    node {
                              id title tags
                                        priceRange { minVariantPrice { amount currencyCode } }
                                                  compareAtPriceRange { minVariantPrice { amount } }
                                                            variants(first: 1) { edges { node { id } } }
                                                                      images(first: 1) { edges { node { url altText } } }
                                                                              }
                                                                                    }
                                                                                        }
                                                                                          }
                                                                                          `;

const CREATE_CART = `
  mutation CartCreate($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
            cart {
                    id checkoutUrl totalQuantity
                            lines(first: 20) { edges { node { id quantity merchandise { ... on ProductVariant { id product { title } priceV2 { amount } } } } } }
                                  }
                                      }
                                        }
                                        `;

const ADD_TO_CART = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
            cart {
                    id checkoutUrl totalQuantity
                            lines(first: 20) { edges { node { id quantity merchandise { ... on ProductVariant { id product { title } priceV2 { amount } } } } } }
                                  }
                                      }
                                        }
                                        `;

const TAG_EMOJI = { travel: "🎒", cables: "🌀", adapters: "🔌", earbuds: "🎵", headphones: "🎧" };
const getEmoji = (tags) => { for (const t of tags) { const e = TAG_EMOJI[t.toLowerCase()]; if (e) return e; } return "📦"; };

const FALLBACK = [
  { id: "1", variantId: null, emoji: "🎒", cat: "Travel",     name: "Travel Pouch Pack",         desc: "Organized. Lightweight. Always ready.", price: 28, oldPrice: null, badge: "New",     image: null },
  { id: "2", variantId: null, emoji: "🌀", cat: "Cables",     name: "Universal Braided Wires",    desc: "One cable. Every device.",              price: 18, oldPrice: 24,   badge: "Popular", image: null },
  { id: "3", variantId: null, emoji: "🔌", cat: "Adapters",   name: "Universal Adaptor with USB", desc: "Plug in anywhere on campus.",           price: 39, oldPrice: null, badge: null,      image: null },
  { id: "4", variantId: null, emoji: "🎵", cat: "Earbuds",    name: "Inpod Earpods",              desc: "Study. Focus. Block out the world.",    price: 49, oldPrice: null, badge: "New",     image: null },
  { id: "5", variantId: null, emoji: "🎧", cat: "Headphones", name: "Over Ear Headphones",        desc: "Full sound. Zero distractions.",        price: 79, oldPrice: 99,   badge: null,      image: null },
  ];

export default function EschoolDeals() {
    const [products, setProducts] = useState(FALLBACK);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState(null);
    const [cartOpen, setCartOpen] = useState(false);
    const [added, setAdded] = useState({});
    const [email, setEmail] = useState("");
    const [toast, setToast] = useState(null);
    const [activeFilter, setActiveFilter] = useState("All");
    const [scrolled, setScrolled] = useState(false);
    const [hovered, setHovered] = useState(null);

  useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
        gql(GET_PRODUCTS).then((data) => {
                const edges = data?.products?.edges || [];
                if (edges.length > 0) {
                          const mapped = edges.map(({ node }) => {
                                      const tags = node.tags || [];
                                      const price = parseFloat(node.priceRange.minVariantPrice.amount);
                                      const compareAt = parseFloat(node.compareAtPriceRange?.minVariantPrice?.amount || 0);
                                      const cat = tags.find((t) => TAG_EMOJI[t.toLowerCase()]) || tags[0] || "General";
                                      const badgeTag = tags.find((t) => ["new", "popular"].includes(t.toLowerCase()));
                                      return {
                                                    id: node.id, variantId: node.variants.edges[0]?.node.id || null,
                                                    emoji: getEmoji(tags), cat, name: node.title, desc: "",
                                                    price, oldPrice: compareAt > price ? compareAt : null,
                                                    badge: badgeTag ? (badgeTag[0].toUpperCase() + badgeTag.slice(1).toLowerCase()) : null,
                                                    image: node.images.edges[0]?.node.url || null,
                                      };
                          });
                          setProducts(mapped);
                }
        }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const cats = ["All", ...new Set(products.map((p) => p.cat))];
    const filtered = activeFilter === "All" ? products : products.filter((p) => p.cat === activeFilter);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2800); };
    const parseLines = (c) => c.lines.edges.map((e) => e.node);

  const handleAdd = async (product) => {
        if (!product.variantId) { showToast("Add this product in Shopify Admin first"); return; }
        setAdded((a) => ({ ...a, [product.id]: true }));
        setTimeout(() => setAdded((a) => ({ ...a, [product.id]: false })), 1600);
        try {
                const line = { merchandiseId: product.variantId, quantity: 1 };
                                                                              if (!cart) {
                                                                                        const data = await gql(CREATE_CART, { lines: [line] });
                                                                                        const c = data.cartCreate.cart;
                                                                                        setCart({ id: c.id, checkoutUrl: c.checkoutUrl, totalQuantity: c.totalQuantity, lines: parseLines(c) });
                                                                              } else {
                                                                                        const data = await gql(ADD_TO_CART, { cartId: cart.id, lines: [line] });
                                                                                        const c = data.cartLinesAdd.cart;
                                                                                        setCart({ id: c.id, checkoutUrl: c.checkoutUrl, totalQuantity: c.totalQuantity, lines: parseLines(c) });
                                                                              }
                showToast(`${product.name} added`);
                setCartOpen(true);
        } catch { showToast("Something went wrong"); }
  };

  const cartCount = cart?.totalQuantity || 0;
    const cartTotal = cart?.lines?.reduce((s, l) => s + parseFloat(l.merchandise.priceV2.amount) * l.quantity, 0) || 0;

  return (
        <>
              <style>{`
                      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');
                              *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                                      html { scroll-behavior: smooth; }
                                              body { background: #fff; }
                                                      @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
                                                              @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
                                                                      @keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
                                                                              .card-wrap { animation: fadeUp 0.5s ease both; }
                                                                                      .card-wrap:nth-child(1) { animation-delay: 0ms; }
                                                                                              .card-wrap:nth-child(2) { animation-delay: 60ms; }
                                                                                                      .card-wrap:nth-child(3) { animation-delay: 120ms; }
                                                                                                              .card-wrap:nth-child(4) { animation-delay: 180ms; }
                                                                                                                      .card-wrap:nth-child(5) { animation-delay: 240ms; }
                                                                                                                              .product-card { transition: transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.4s ease; cursor: pointer; }
                                                                                                                                      .product-card:hover { transform: translateY(-6px); box-shadow: 0 24px 64px rgba(0,0,0,0.10); }
                                                                                                                                              .add-btn { transition: all 0.2s ease; }
                                                                                                                                                      .add-btn:hover { background: #000 !important; transform: scale(1.04); }
                                                                                                                                                              .filter-pill { transition: all 0.2s ease; }
                                                                                                                                                                      .filter-pill:hover { background: #f0f0f0 !important; }
                                                                                                                                                                              .nav-btn { transition: opacity 0.2s; }
                                                                                                                                                                                      .nav-btn:hover { opacity: 0.6; }
                                                                                                                                                                                              .hero-tag { animation: fadeUp 0.6s ease 0.1s both; }
                                                                                                                                                                                                      .hero-h1 { animation: fadeUp 0.7s ease 0.2s both; }
                                                                                                                                                                                                              .hero-sub { animation: fadeUp 0.6s ease 0.35s both; }
                                                                                                                                                                                                                      .hero-btns { animation: fadeUp 0.6s ease 0.5s both; }
                                                                                                                                                                                                                              .hero-strip { animation: fadeUp 0.6s ease 0.65s both; }
                                                                                                                                                                                                                                      .checkout-btn { transition: all 0.2s ease; }
                                                                                                                                                                                                                                              .checkout-btn:hover { background: #1a1a1a !important; }
                                                                                                                                                                                                                                                    `}</style>style>
        
              <div style={{ fontFamily: "'Sora', sans-serif", background: "#fff", color: "#000", minHeight: "100vh" }}>
              
                {/* TOAST */}
                {toast && (
                    <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "#000", color: "#fff", padding: "12px 24px", borderRadius: 100, fontSize: 13, fontWeight: 500, zIndex: 9999, animation: "toastIn 0.3s ease", whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
                      {toast}
                    </div>div>
                      )}
              
                {/* CART DRAWER */}
                {cartOpen && (
                    <div style={{ position: "fixed", inset: 0, zIndex: 500 }} onClick={() => setCartOpen(false)}>
                                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }} />
                                <div
                                                style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 420, maxWidth: "92vw", background: "#fff", animation: "drawerIn 0.35s cubic-bezier(0.25,0.46,0.45,0.94)", display: "flex", flexDirection: "column" }}
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 32px 20px", borderBottom: "1px solid #f0f0f0" }}>
                                                              <div>
                                                                                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>Cart</div>div>
                                                                {cartCount > 0 && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{cartCount} item{cartCount !== 1 ? "s" : ""}</div>div>}
                                                              </div>div>
                                                              <button onClick={() => setCartOpen(false)} className="nav-btn" style={{ background: "#f5f5f5", border: "none", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#000" }}>✕</button>button>
                                              </div>div>
                                  {!cart || cart.lines.length === 0 ? (
                                                                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#999" }}>
                                                                                  <div style={{ fontSize: 40 }}>🛒</div>div>
                                                                                  <div style={{ fontSize: 15, fontWeight: 500, color: "#000" }}>Your cart is empty</div>div>
                                                                                  <div style={{ fontSize: 13 }}>Add some gear to get started</div>div>
                                                                </div>div>
                                                              ) : (
                                                                <>
                                                                                  <div style={{ flex: 1, overflowY: "auto", padding: "20px 32px" }}>
                                                                                    {cart.lines.map((line) => (
                                                                                        <div key={line.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid #f5f5f5" }}>
                                                                                                                <div>
                                                                                                                                          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>{line.merchandise.product.title}</div>div>
                                                                                                                                          <div style={{ fontSize: 12, color: "#888" }}>Qty {line.quantity}</div>div>
                                                                                                                  </div>div>
                                                                                                                <div style={{ fontSize: 15, fontWeight: 700 }}>${(parseFloat(line.merchandise.priceV2.amount) * line.quantity).toFixed(2)}</div>div>
                                                                                          </div>div>
                                                                                      ))}
                                                                                    </div>div>
                                                                                  <div style={{ padding: "20px 32px 32px", borderTop: "1px solid #f0f0f0" }}>
                                                                                                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                                                                                                                            <span style={{ fontSize: 14, color: "#666" }}>Subtotal</span>span>
                                                                                                                            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>${cartTotal.toFixed(2)}</span>span>
                                                                                                        </div>div>
                                                                                                      <a href={cart.checkoutUrl} target="_blank" rel="noreferrer" className="checkout-btn" style={{ display: "block", background: "#000", color: "#fff", textAlign: "center", padding: "16px", borderRadius: 14, fontWeight: 600, fontSize: 15, textDecoration: "none", letterSpacing: "-0.01em" }}>
                                                                                                                            Checkout
                                                                                                        </a>a>
                                                                                                      <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#aaa" }}>Free shipping on orders over $35</div>div>
                                                                                    </div>div>
                                                                </>>
                                                              )}
                                </div>div>
                    </div>div>
                      )}
              
                {/* NAV */}
                      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", background: scrolled ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.72)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: scrolled ? "1px solid rgba(0,0,0,0.08)" : "1px solid transparent", transition: "all 0.3s ease" }}>
                                <a href="#" style={{ fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 700, color: "#000", textDecoration: "none", letterSpacing: "-0.04em" }}>
                                            eschool<span style={{ color: "#555" }}>deals</span>span>
                                </a>a>
                                <div style={{ display: "none", gap: 32, position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
                                  {["Products", "About", "Support"].map((item) => (
                        <a key={item} href="#" style={{ fontSize: 13, fontWeight: 500, color: "#000", textDecoration: "none", opacity: 0.7 }}>{item}</a>a>
                      ))}
                                </div>div>
                                <button onClick={() => setCartOpen(true)} className="nav-btn" style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0f0f0", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#000", padding: "8px 16px", borderRadius: 100 }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>svg>
                                            Bag
                                  {cartCount > 0 && <span style={{ background: "#000", color: "#fff", fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{cartCount}</span>span>}
                                </button>button>
                      </nav>nav>
              
                {/* HERO */}
                      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "120px 32px 80px", background: "linear-gradient(180deg, #fafafa 0%, #fff 100%)", position: "relative", overflow: "hidden" }}>
                                <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,0,0,0.03) 0%, transparent 70%)", pointerEvents: "none" }} />
                                <div className="hero-tag" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f0f0f0", color: "#555", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 14px", borderRadius: 100, marginBottom: 32 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#000", display: "inline-block" }} />
                                            Student Essentials
                                </div>div>
                                <h1 className="hero-h1" style={{ fontSize: "clamp(48px, 7vw, 96px)", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 0.96, marginBottom: 28, maxWidth: 760 }}>
                                            Everything<br />
                                            <span style={{ color: "#999" }}>you actually need.</span>span>
                                </h1>h1>
                                <p className="hero-sub" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "clamp(16px, 2vw, 20px)", color: "#666", fontWeight: 300, maxWidth: 480, lineHeight: 1.65, marginBottom: 48 }}>
                                            Five carefully chosen products for students who want quality without the markup.
                                </p>p>
                                <div className="hero-btns" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <a href="#products" style={{ background: "#000", color: "#fff", padding: "14px 32px", borderRadius: 100, fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: "-0.01em" }}>
                                                          Shop the collection
                                            </a>a>
                                            <a href="#" style={{ background: "transparent", color: "#000", padding: "14px 28px", borderRadius: 100, fontSize: 14, fontWeight: 500, textDecoration: "none", border: "1px solid rgba(0,0,0,0.15)" }}>
                                                          Student discount
                                            </a>a>
                                </div>div>
                                <div className="hero-strip" style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 64, flexWrap: "wrap", justifyContent: "center" }}>
                                  {[["Free shipping", "$35+"], ["Student discount", "10% off"], ["Easy returns", "30 days"]].map(([title, sub]) => (
                        <div key={title} style={{ textAlign: "center" }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</div>div>
                                        <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{sub}</div>div>
                        </div>div>
                      ))}
                                </div>div>
                      </section>section>
              
                {/* PRODUCTS */}
                      <section id="products" style={{ padding: "100px 48px" }}>
                                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                                            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 48, flexWrap: "wrap", gap: 24 }}>
                                                          <div>
                                                                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaa", marginBottom: 8 }}>The Collection</div>div>
                                                                          <h2 style={{ fontSize: "clamp(28px, 3vw, 44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>Our picks for students.</h2>h2>
                                                          </div>div>
                                                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                                            {cats.map((cat) => (
                            <button key={cat} className="filter-pill" onClick={() => setActiveFilter(cat)} style={{ background: activeFilter === cat ? "#000" : "#f5f5f5", color: activeFilter === cat ? "#fff" : "#666", border: "none", padding: "8px 18px", borderRadius: 100, fontSize: 13, fontWeight: 500, cursor: "pointer", letterSpacing: "-0.01em", transition: "all 0.2s ease" }}>
                              {cat}
                            </button>button>
                          ))}
                                                          </div>div>
                                            </div>div>
                                  {loading ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                          {[1,2,3,4,5].map((i) => (
                                            <div key={i} style={{ borderRadius: 24, background: "linear-gradient(90deg, #f5f5f5 25%, #ebebeb 50%, #f5f5f5 75%)", height: 340, backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                                          ))}
                        </div>div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                          {filtered.map((p) => (
                                            <div key={p.id} className="card-wrap">
                                                                <div
                                                                                        className="product-card"
                                                                                        style={{ borderRadius: 24, background: "#fafafa", overflow: "hidden", position: "relative" }}
                                                                                        onMouseEnter={() => setHovered(p.id)}
                                                                                        onMouseLeave={() => setHovered(null)}
                                                                                      >
                                                                  {p.badge && (
                                                                                                                <div style={{ position: "absolute", top: 16, left: 16, zIndex: 2, background: "#000", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 6 }}>
                                                                                                                  {p.badge}
                                                                                                                  </div>div>
                                                                                      )}
                                                                                      <div style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", position: "relative", overflow: "hidden" }}>
                                                                                        {p.image
                                                                                                                    ? <img src={p.image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s ease", transform: hovered === p.id ? "scale(1.04)" : "scale(1)" }} />
                                                                                                                    : <span style={{ fontSize: 80, filter: "grayscale(20%)", transition: "transform 0.4s ease", transform: hovered === p.id ? "scale(1.08)" : "scale(1)" }}>{p.emoji}</span>span>
                                                                                        }
                                                                                        </div>div>
                                                                                      <div style={{ padding: "20px 20px 20px" }}>
                                                                                                              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaa", marginBottom: 6 }}>{p.cat}</div>div>
                                                                                                              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 6 }}>{p.name}</div>div>
                                                                                        {p.desc && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#999", fontWeight: 300, marginBottom: 16, lineHeight: 1.5 }}>{p.desc}</div>div>}
                                                                                                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: p.desc ? 0 : 16 }}>
                                                                                                                                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                                                                                                                          {p.oldPrice && <span style={{ fontSize: 12, color: "#bbb", textDecoration: "line-through" }}>${p.oldPrice}</span>span>}
                                                                                                                                                                    <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>${p.price}</span>span>
                                                                                                                                          </div>div>
                                                                                                                                        <button
                                                                                                                                                                      className="add-btn"
                                                                                                                                                                      onClick={() => handleAdd(p)}
                                                                                                                                                                      style={{ background: added[p.id] ? "#000" : "#ebebeb", color: added[p.id] ? "#fff" : "#000", border: "none", width: 40, height: 40, borderRadius: "50%", cursor: "pointer", fontSize: added[p.id] ? 16 : 22, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 400 }}
                                                                                                                                                                    >
                                                                                                                                          {added[p.id] ? "✓" : "+"}
                                                                                                                                          </button>button>
                                                                                                                </div>div>
                                                                                        </div>div>
                                                                </div>div>
                                            </div>div>
                                          ))}
                        </div>div>
                                            )}
                                </div>div>
                      </section>section>
              
                {/* FEATURE STRIP */}
                      <section style={{ background: "#000", color: "#fff", padding: "80px 48px" }}>
                                <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 48 }}>
                                  {[
          { icon: "↗", title: "Free Shipping", body: "On every order above $35. No hidden fees." },
          { icon: "◎", title: "Student Discount", body: "10% off with a verified .edu email address." },
          { icon: "↺", title: "30-Day Returns", body: "Not happy? Send it back, no questions asked." },
                      ].map((item) => (
                                      <div key={item.title}>
                                                      <div style={{ fontSize: 28, marginBottom: 16, opacity: 0.4 }}>{item.icon}</div>div>
                                                      <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>{item.title}</div>div>
                                                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, fontWeight: 300 }}>{item.body}</div>div>
                                      </div>div>
                                    ))}
                                </div>div>
                      </section>section>
              
                {/* NEWSLETTER */}
                      <section style={{ padding: "100px 48px", textAlign: "center", background: "#fafafa" }}>
                                <div style={{ maxWidth: 540, margin: "0 auto" }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaa", marginBottom: 20 }}>Stay in the loop</div>div>
                                            <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 16, lineHeight: 1.05 }}>Get deals before<br />everyone else.</h2>h2>
                                            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#888", marginBottom: 36, lineHeight: 1.65, fontWeight: 300 }}>New arrivals, restocks, and student promos — delivered to your inbox.</p>p>
                                            <div style={{ display: "flex", gap: 8, maxWidth: 420, margin: "0 auto", flexWrap: "wrap", justifyContent: "center" }}>
                                                          <input
                                                                            type="email"
                                                                            placeholder="you@university.edu"
                                                                            value={email}
                                                                            onChange={(e) => setEmail(e.target.value)}
                                                                            style={{ flex: 1, minWidth: 200, background: "#fff", border: "1px solid #e8e8e8", color: "#000", padding: "14px 20px", fontSize: 14, borderRadius: 100, outline: "none", fontFamily: "'Sora', sans-serif" }}
                                                                          />
                                                          <button
                                                                            onClick={() => { setEmail(""); showToast("You're in 🎉"); }}
                                                                            style={{ background: "#000", color: "#fff", border: "none", padding: "14px 28px", fontSize: 14, fontWeight: 600, borderRadius: 100, cursor: "pointer", letterSpacing: "-0.01em" }}
                                                                          >
                                                                          Subscribe
                                                          </button>button>
                                            </div>div>
                                            <div style={{ marginTop: 14, fontSize: 11, color: "#bbb" }}>No spam. Unsubscribe anytime.</div>div>
                                </div>div>
                      </section>section>
              
                {/* FOOTER */}
                      <footer style={{ background: "#000", color: "#fff", padding: "64px 48px 40px" }}>
                                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 48, marginBottom: 64 }}>
                                                          <div style={{ maxWidth: 260 }}>
                                                                          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "-0.04em", marginBottom: 14 }}>
                                                                                            eschool<span style={{ color: "#555" }}>deals</span>span>
                                                                          </div>div>
                                                                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.7, fontWeight: 300 }}>
                                                                                            Quality gear for students who refuse to overpay.
                                                                          </p>p>
                                                          </div>div>
                                                          <div style={{ display: "flex", gap: 64, flexWrap: "wrap" }}>
                                                                          <div>
                                                                                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>Products</div>div>
                                                                                            <ul style={{ listStyle: "none" }}>
                                                                                              {products.map((p) => <li key={p.id} style={{ marginBottom: 10 }}><a href="#products" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "none", fontWeight: 300 }}>{p.name}</a>a></li>li>)}
                                                                                              </ul>ul>
                                                                          </div>div>
                                                                          <div>
                                                                                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>Help</div>div>
                                                                                            <ul style={{ listStyle: "none" }}>
                                                                                              {["Track Order", "Returns", "Student Discount", "Contact", "FAQ"].map((l) => (
                                <li key={l} style={{ marginBottom: 10 }}><a href="#" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "none", fontWeight: 300 }}>{l}</a>a></li>li>
                              ))}
                                                                                              </ul>ul>
                                                                          </div>div>
                                                          </div>div>
                                            </div>div>
                                            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                                                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>© 2025 eschooldeals</span>span>
                                                          <div style={{ display: "flex", gap: 24 }}>
                                                            {["Privacy", "Terms"].map((l) => <a key={l} href="#" style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>{l}</a>a>)}
                                                          </div>div>
                                            </div>div>
                                </div>div>
                      </footer>footer>
              
              </div>div>
        </>>
      );
}</></>
