'use client'
import { useEffect, useState, useCallback } from 'react'

const API = '/api/admin/deals'

// ─── Placement logic ──────────────────────────────────────────────────────────
// is_featured: false → "Main Feed" (grid only)
// is_featured: true  → "ESD Recommended" (ESD strip + grid = Both by default)
// The ESD strip on the homepage shows up to 4 featured deals.
// All active deals always appear in the main grid regardless of placement.

const PLACEMENTS = [
  { value: 'feed',  label: '📋 Main Feed',               desc: 'Grid only',              is_featured: false },
  { value: 'esd',   label: '⭐ ESD Recommended',          desc: 'ESD strip + grid',       is_featured: true  },
]

function placementFromDeal(d) {
  return d.is_featured ? 'esd' : 'feed'
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [screen,   setScreen]   = useState('checking')
  const [password, setPassword] = useState('')
  const [token,    setToken]    = useState('')
  const [error,    setError]    = useState('')
  const [isOpen,   setIsOpen]   = useState(false)

  useEffect(() => {
    fetch(API + '?status=pending', { headers: { Authorization: 'Bearer ' } })
      .then(r => { if (r.ok) { setIsOpen(true); setToken(''); setScreen('dashboard') } else setScreen('login') })
      .catch(() => setScreen('login'))
  }, [])

  async function handleLogin(e) {
    e.preventDefault(); setError('')
    const res = await fetch(API + '?status=pending', { headers: { Authorization: 'Bearer ' + password } })
    if (res.ok) { setToken(password); setScreen('dashboard') }
    else setError('Incorrect password')
  }

  if (screen === 'checking') return <Wrap><p style={{ color:'#9ca3af', fontSize:14 }}>Loading...</p></Wrap>
  if (screen === 'login') return (
    <Wrap>
      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>Admin Login</h2>
      <p style={{ color:'#6b7280', fontSize:13, marginBottom:20 }}>Enter your ADMIN_PASSWORD to continue.</p>
      <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:340 }}>
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoFocus
          style={{ padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:7, fontSize:14 }} />
        {error && <p style={{ color:'#dc2626', fontSize:13, margin:0 }}>{error}</p>}
        <button type="submit" style={{ padding:'9px', background:'#111', color:'#fff', border:'none', borderRadius:7, fontSize:14, fontWeight:600, cursor:'pointer' }}>Log in</button>
      </form>
    </Wrap>
  )
  return <Dashboard token={token} isOpen={isOpen} />
}

// ─── Add Deal Form ────────────────────────────────────────────────────────────
function AddDealForm({ token, onAdded }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    title: '', product_url: '', sale_price: '', original_price: '',
    image_url: '', merchant: '', category: 'Electronics', placement: 'feed',
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    if (!form.title || !form.product_url || !form.sale_price) { setMsg('Title, URL and price are required'); return }
    setSaving(true); setMsg('')
    const p = PLACEMENTS.find(p => p.value === form.placement)
    const body = {
      title:          form.title.trim(),
      product_url:    form.product_url.trim(),
      sale_price:     parseFloat(form.sale_price),
      original_price: form.original_price ? parseFloat(form.original_price) : null,
      image_url:      form.image_url.trim() || null,
      merchant:       form.merchant.trim() || 'Manual',
      category:       form.category,
      is_featured:    p?.is_featured ?? false,
      source_key:     'manual',
      source_type:    'manual',
      in_stock:       true,
      is_student_relevant: true,
      status:         'active',
    }
    const res  = await fetch('/api/admin/deals', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token }, body: JSON.stringify(body) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg('Error: ' + data.error); return }
    setMsg('Deal added!')
    setForm({ title:'', product_url:'', sale_price:'', original_price:'', image_url:'', merchant:'', category:'Electronics', placement:'feed' })
    onAdded()
    setTimeout(() => setMsg(''), 3000)
  }

  const inp = (extra={}) => ({ style:{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13, width:'100%', boxSizing:'border-box', ...extra.style }, ...extra })

  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, marginBottom:20, overflow:'hidden' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:'100%', padding:'12px 16px', background:'#111', color:'#fff', border:'none', cursor:'pointer', fontSize:14, fontWeight:600, textAlign:'left', display:'flex', justifyContent:'space-between' }}>
        <span>+ Add Deal Manually</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <form onSubmit={submit} style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:3 }}>Title *</label>
              <input {...inp()} placeholder="Product title" value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:3 }}>Product URL *</label>
              <input {...inp()} placeholder="https://..." value={form.product_url} onChange={e => set('product_url', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:3 }}>Sale Price * ($)</label>
              <input {...inp()} type="number" step="0.01" placeholder="0.00" value={form.sale_price} onChange={e => set('sale_price', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:3 }}>Original Price ($)</label>
              <input {...inp()} type="number" step="0.01" placeholder="Optional" value={form.original_price} onChange={e => set('original_price', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:3 }}>Merchant</label>
              <input {...inp()} placeholder="e.g. Amazon, Best Buy" value={form.merchant} onChange={e => set('merchant', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:3 }}>Category</label>
              <select {...inp()} value={form.category} onChange={e => set('category', e.target.value)}>
                {['Electronics','Computers','Phones','Home','Kitchen','Fashion','Sports','Travel','Toys','Software','Books'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:3 }}>Image URL</label>
              <input {...inp()} placeholder="https://... (optional)" value={form.image_url} onChange={e => set('image_url', e.target.value)} />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:6 }}>Placement</label>
              <div style={{ display:'flex', gap:8 }}>
                {PLACEMENTS.map(p => (
                  <label key={p.value} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', padding:'7px 12px',
                    border: form.placement===p.value ? '2px solid #111' : '1px solid #e5e7eb',
                    borderRadius:7, fontSize:13, fontWeight: form.placement===p.value ? 600 : 400,
                    background: form.placement===p.value ? '#f9fafb' : '#fff' }}>
                    <input type="radio" name="placement" value={p.value} checked={form.placement===p.value} onChange={() => set('placement', p.value)} style={{ margin:0 }} />
                    <span>{p.label}</span>
                    <span style={{ color:'#9ca3af', fontSize:11 }}>{p.desc}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <button type="submit" disabled={saving}
              style={{ padding:'8px 20px', background:'#10b981', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600 }}>
              {saving ? 'Adding...' : 'Add Deal'}
            </button>
            {msg && <span style={{ fontSize:13, color: msg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{msg}</span>}
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ token, isOpen }) {
  const [deals,   setDeals]   = useState([])
  const [loading, setLoading] = useState(false)
  const [filter,  setFilter]  = useState('pending')
  const [msg,     setMsg]     = useState('')

  const hdrs = { 'Content-Type':'application/json', Authorization:'Bearer '+token }

  const load = useCallback(async (f) => {
    setLoading(true); setMsg('')
    try {
      const res  = await fetch(API+'?status='+f, { headers: hdrs })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDeals(Array.isArray(data) ? data : [])
    } catch(e) { setMsg('Error: '+e.message) }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { load(filter) }, [filter, load])

  async function update(id, updates) {
    setMsg('')
    const res  = await fetch(API, { method:'PATCH', headers: hdrs, body: JSON.stringify({ id, ...updates }) })
    const data = await res.json()
    if (!res.ok) { setMsg('Error: '+data.error); return }
    setDeals(prev => prev.map(d => d.id===id ? { ...d, ...updates } : d))
    setMsg('Saved'); setTimeout(() => setMsg(''), 2000)
  }

  async function remove(id) {
    if (!confirm('Delete permanently?')) return
    const res = await fetch(API, { method:'DELETE', headers: hdrs, body: JSON.stringify({ id }) })
    if (!res.ok) { const d = await res.json(); setMsg('Error: '+d.error); return }
    setDeals(prev => prev.filter(d => d.id!==id))
  }

  const counts = {
    pending: deals.filter(d=>d.status==='pending').length,
    active:  deals.filter(d=>d.status==='active').length,
    all:     deals.length,
  }
  const shown = filter==='all' ? deals : deals.filter(d => d.status===filter)

  return (
    <Wrap>
      {isOpen && (
        <div style={{ background:'#fef9c3', border:'1px solid #fde047', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13 }}>
          <strong>No password set.</strong> Add <code>ADMIN_PASSWORD</code> in Vercel env vars to secure this page, then redeploy.
        </div>
      )}

      <h1 style={{ fontSize:20, fontWeight:700, margin:'0 0 4px' }}>eSchoolDeals — Deal Manager</h1>
      <p style={{ color:'#6b7280', fontSize:13, margin:'0 0 16px' }}>Review SerpApi deals, add deals manually, and control placement.</p>

      <AddDealForm token={token} onAdded={() => load(filter)} />

      <div style={{ display:'flex', gap:6, marginBottom:18, alignItems:'center', flexWrap:'wrap' }}>
        {['pending','active','all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:'5px 14px', borderRadius:20, cursor:'pointer', fontSize:13,
            border: filter===f ? 'none' : '1px solid #d1d5db',
            background: filter===f ? '#111' : '#fff', color: filter===f ? '#fff' : '#374151',
          }}>
            {f.charAt(0).toUpperCase()+f.slice(1)} ({counts[f]})
          </button>
        ))}
        <button onClick={() => load(filter)} style={{ marginLeft:'auto', padding:'5px 12px', border:'1px solid #d1d5db', borderRadius:20, background:'#fff', cursor:'pointer', fontSize:12, color:'#666' }}>↻ Refresh</button>
        {msg && <span style={{ fontSize:13, color: msg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{msg}</span>}
      </div>

      {loading && <p style={{ color:'#9ca3af', fontSize:13 }}>Loading...</p>}
      {!loading && shown.length===0 && (
        <p style={{ color:'#9ca3af', fontSize:13 }}>
          {filter==='pending' ? 'No pending deals — trigger the cron to pull fresh ones.' : 'No deals found.'}
        </p>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(310px, 1fr))', gap:12 }}>
        {shown.map(d => <Card key={d.id} deal={d} onUpdate={update} onDelete={remove} />)}
      </div>
    </Wrap>
  )
}

// ─── Deal Card ────────────────────────────────────────────────────────────────
function Card({ deal: d, onUpdate, onDelete }) {
  const isPending  = d.status === 'pending'
  const isActive   = d.status === 'active'
  const isESD      = Boolean(d.is_featured)
  const placement  = isESD ? 'esd' : 'feed'
  const border     = isPending ? '#f59e0b' : isActive ? '#10b981' : '#e5e7eb'
  const badge      = isPending ? { bg:'#fef3c7', color:'#92400e' } : isActive ? { bg:'#d1fae5', color:'#065f46' } : { bg:'#f3f4f6', color:'#6b7280' }

  return (
    <div style={{ border:'1px solid '+border, borderRadius:10, padding:14, background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,.05)', display:'flex', flexDirection:'column', gap:8 }}>
      {/* Status + source */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:badge.bg, color:badge.color }}>
          {d.status.toUpperCase()} · {d.merchant}
        </span>
        <span style={{ fontSize:10, color:'#9ca3af' }}>{d.source_key}</span>
      </div>

      {/* Image + title */}
      <div style={{ display:'flex', gap:10 }}>
        {d.image_url && <img src={d.image_url} alt="" style={{ width:60, height:60, objectFit:'contain', borderRadius:6, border:'1px solid #f3f4f6', flexShrink:0 }} />}
        <p style={{ fontSize:13, fontWeight:500, margin:0, lineHeight:1.4, flex:1 }}>{d.title}</p>
      </div>

      {/* Price */}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <span style={{ fontSize:17, fontWeight:700 }}>${d.sale_price?.toFixed(2)}</span>
        {d.original_price && <span style={{ fontSize:12, color:'#9ca3af', textDecoration:'line-through' }}>${d.original_price?.toFixed(2)}</span>}
        {d.discount_pct > 0 && <span style={{ fontSize:11, fontWeight:600, background:'#fee2e2', color:'#b91c1c', padding:'1px 7px', borderRadius:10 }}>-{d.discount_pct}%</span>}
      </div>

      {/* Link */}
      <a href={d.product_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#6366f1', textDecoration:'none', wordBreak:'break-all' }}>
        {(d.product_url||'').substring(0,60)}{(d.product_url||'').length>60?'…':''}
      </a>

      {/* Placement selector — only for active deals */}
      {isActive && (
        <div style={{ background:'#f9fafb', borderRadius:7, padding:'8px 10px' }}>
          <p style={{ fontSize:11, color:'#6b7280', margin:'0 0 6px', fontWeight:600 }}>PLACEMENT</p>
          <div style={{ display:'flex', gap:6 }}>
            {PLACEMENTS.map(p => (
              <label key={p.value} style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', padding:'4px 9px',
                border: placement===p.value ? '2px solid #111' : '1px solid #e5e7eb',
                borderRadius:6, fontSize:12, fontWeight: placement===p.value ? 600 : 400,
                background: placement===p.value ? '#fff' : 'transparent' }}>
                <input type="radio" name={'placement-'+d.id} value={p.value} checked={placement===p.value}
                  onChange={() => onUpdate(d.id, { is_featured: p.is_featured })} style={{ margin:0 }} />
                {p.label}
              </label>
            ))}
          </div>
          {isESD && <p style={{ fontSize:10, color:'#6b7280', margin:'5px 0 0' }}>⭐ Showing in ESD Student Recommended strip</p>}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {isPending && <button onClick={() => onUpdate(d.id,{status:'active'})} style={{ padding:'5px 13px', background:'#10b981', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}>✓ Approve</button>}
        {isPending && <button onClick={() => onUpdate(d.id,{status:'expired'})} style={{ padding:'5px 13px', background:'#fff', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕ Reject</button>}
        {isActive  && <button onClick={() => onUpdate(d.id,{status:'pending'})} style={{ padding:'5px 13px', background:'#fff', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:6, cursor:'pointer', fontSize:12 }}>↩ Un-publish</button>}
        <button onClick={() => onDelete(d.id)} style={{ marginLeft:'auto', padding:'5px 10px', background:'#fff', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, cursor:'pointer', fontSize:12 }}>🗑</button>
      </div>
    </div>
  )
}

function Wrap({ children }) {
  return <div style={{ fontFamily:'system-ui, sans-serif', maxWidth:1100, margin:'0 auto', padding:'32px 16px', color:'#111' }}>{children}</div>
}
