'use client'
import { useEffect, useState, useCallback } from 'react'

const API = '/api/admin/deals'

export default function AdminPage() {
  const [screen,   setScreen]   = useState('checking') // checking | login | dashboard
  const [password, setPassword] = useState('')
  const [token,    setToken]    = useState('')
  const [error,    setError]    = useState('')
  const [isOpen,   setIsOpen]   = useState(false)

  // On mount: ping the API with no password to see if it's open
  useEffect(() => {
    fetch(API + '?status=pending', { headers: { Authorization: 'Bearer ' } })
      .then(r => {
        if (r.ok) {
          // No password configured — open access
          setIsOpen(true)
          setToken('')
          setScreen('dashboard')
        } else {
          setScreen('login')
        }
      })
      .catch(() => setScreen('login'))
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    const res = await fetch(API + '?status=pending', { headers: { Authorization: 'Bearer ' + password } })
    if (res.ok) {
      setToken(password)
      setScreen('dashboard')
    } else {
      setError('Incorrect password — check ADMIN_PASSWORD in Vercel')
    }
  }

  if (screen === 'checking') return (
    <Wrap><p style={{ color: '#9ca3af', fontSize: 14 }}>Loading...</p></Wrap>
  )

  if (screen === 'login') return (
    <Wrap>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Admin Login</h2>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Enter your ADMIN_PASSWORD to continue.</p>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340 }}>
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoFocus
          style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 14, outline: 'none' }} />
        {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}
        <button type="submit"
          style={{ padding: '9px', background: '#111', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Log in
        </button>
      </form>
    </Wrap>
  )

  return <Dashboard token={token} isOpen={isOpen} />
}

function Dashboard({ token, isOpen }) {
  const [deals,   setDeals]   = useState([])
  const [loading, setLoading] = useState(false)
  const [filter,  setFilter]  = useState('pending')
  const [msg,     setMsg]     = useState('')

  const hdrs = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

  const load = useCallback(async (f) => {
    setLoading(true); setMsg('')
    try {
      const res  = await fetch(API + '?status=' + f, { headers: hdrs })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDeals(Array.isArray(data) ? data : [])
    } catch (e) { setMsg('Error: ' + e.message) }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { load(filter) }, [filter, load])

  async function update(id, updates) {
    setMsg('')
    const res  = await fetch(API, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ id, ...updates }) })
    const data = await res.json()
    if (!res.ok) { setMsg('Error: ' + data.error); return }
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
    setMsg('Saved'); setTimeout(() => setMsg(''), 2000)
  }

  async function remove(id) {
    if (!confirm('Delete permanently?')) return
    const res = await fetch(API, { method: 'DELETE', headers: hdrs, body: JSON.stringify({ id }) })
    if (!res.ok) { const d = await res.json(); setMsg('Error: ' + d.error); return }
    setDeals(prev => prev.filter(d => d.id !== id))
  }

  const counts = { pending: deals.filter(d => d.status==='pending').length, active: deals.filter(d => d.status==='active').length, all: deals.length }
  const shown  = filter === 'all' ? deals : deals.filter(d => d.status === filter)

  return (
    <Wrap>
      {isOpen && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
          <strong>No password set.</strong> Add <code>ADMIN_PASSWORD</code> in Vercel env vars to secure this page, then redeploy.
        </div>
      )}

      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>eSchoolDeals — Deal Review</h1>
      <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>Approve Walmart + Woot deals from SerpApi before they go live.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        {['pending', 'active', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13,
            border: filter===f ? 'none' : '1px solid #d1d5db',
            background: filter===f ? '#111' : '#fff',
            color: filter===f ? '#fff' : '#374151',
          }}>
            {f.charAt(0).toUpperCase()+f.slice(1)} ({counts[f]})
          </button>
        ))}
        <button onClick={() => load(filter)}
          style={{ marginLeft: 'auto', padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 20, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#666' }}>
          ↻ Refresh
        </button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{msg}</span>}
      </div>

      {loading && <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading...</p>}
      {!loading && shown.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>
          {filter==='pending' ? 'No pending deals — trigger the cron to pull fresh ones.' : 'No deals found.'}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {shown.map(d => <Card key={d.id} deal={d} onUpdate={update} onDelete={remove} />)}
      </div>
    </Wrap>
  )
}

function Wrap({ children }) {
  return <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto', padding: '32px 16px', color: '#111' }}>{children}</div>
}

function Card({ deal: d, onUpdate, onDelete }) {
  const isPending = d.status === 'pending'
  const isActive  = d.status === 'active'
  const border    = isPending ? '#f59e0b' : isActive ? '#10b981' : '#e5e7eb'
  const badge     = isPending ? { bg:'#fef3c7', color:'#92400e' } : isActive ? { bg:'#d1fae5', color:'#065f46' } : { bg:'#f3f4f6', color:'#6b7280' }

  return (
    <div style={{ border:'1px solid '+border, borderRadius:10, padding:14, background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,.05)', display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:badge.bg, color:badge.color }}>
          {d.status.toUpperCase()} · {d.merchant}
        </span>
        <span style={{ fontSize:10, color:'#9ca3af' }}>{d.source_key}</span>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        {d.image_url && <img src={d.image_url} alt="" style={{ width:60, height:60, objectFit:'contain', borderRadius:6, border:'1px solid #f3f4f6', flexShrink:0 }} />}
        <p style={{ fontSize:13, fontWeight:500, margin:0, lineHeight:1.4, flex:1 }}>{d.title}</p>
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <span style={{ fontSize:17, fontWeight:700 }}>${d.sale_price?.toFixed(2)}</span>
        {d.original_price && <span style={{ fontSize:12, color:'#9ca3af', textDecoration:'line-through' }}>${d.original_price?.toFixed(2)}</span>}
        {d.discount_pct > 0 && <span style={{ fontSize:11, fontWeight:600, background:'#fee2e2', color:'#b91c1c', padding:'1px 7px', borderRadius:10 }}>-{d.discount_pct}%</span>}
      </div>
      <a href={d.product_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#6366f1', textDecoration:'none', wordBreak:'break-all' }}>
        {(d.product_url||'').substring(0,65)}{(d.product_url||'').length>65?'…':''}
      </a>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {isPending && <button onClick={() => onUpdate(d.id,{status:'active'})} style={{ padding:'5px 13px', background:'#10b981', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}>✓ Approve</button>}
        {isPending && <button onClick={() => onUpdate(d.id,{status:'expired'})} style={{ padding:'5px 13px', background:'#fff', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕ Reject</button>}
        {isActive && <button onClick={() => onUpdate(d.id,{status:'pending'})} style={{ padding:'5px 13px', background:'#fff', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:6, cursor:'pointer', fontSize:12 }}>↩ Un-publish</button>}
        <button onClick={() => onDelete(d.id)} style={{ marginLeft:'auto', padding:'5px 10px', background:'#fff', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, cursor:'pointer', fontSize:12 }}>🗑</button>
      </div>
    </div>
  )
}
