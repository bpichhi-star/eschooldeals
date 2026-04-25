'use client'
import { useEffect, useState, useCallback } from 'react'

const API = '/api/admin/deals'

export default function AdminPage() {
  const [secret,  setSecret]  = useState('')
  const [deals,   setDeals]   = useState([])
  const [loading, setLoading] = useState(false)
  const [filter,  setFilter]  = useState('pending')
  const [msg,     setMsg]     = useState('')

  const fetchDeals = useCallback(async (f) => {
    if (!secret) return
    setLoading(true); setMsg('')
    try {
      const res  = await fetch(API + '?status=' + f, { headers: { Authorization: 'Bearer ' + secret } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDeals(Array.isArray(data) ? data : [])
    } catch (e) { setMsg('Error: ' + e.message) }
    finally { setLoading(false) }
  }, [secret])

  useEffect(() => { fetchDeals(filter) }, [filter, fetchDeals])

  async function update(id, updates) {
    setMsg('')
    const res  = await fetch(API, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret }, body: JSON.stringify({ id, ...updates }) })
    const data = await res.json()
    if (!res.ok) { setMsg('Error: ' + data.error); return }
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
    setMsg('Saved'); setTimeout(() => setMsg(''), 2000)
  }

  async function remove(id) {
    if (!confirm('Delete permanently?')) return
    const res = await fetch(API, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret }, body: JSON.stringify({ id }) })
    if (!res.ok) { const d = await res.json(); setMsg('Error: ' + d.error); return }
    setDeals(prev => prev.filter(d => d.id !== id))
  }

  const counts = { pending: deals.filter(d=>d.status==='pending').length, active: deals.filter(d=>d.status==='active').length, all: deals.length }
  const shown  = filter === 'all' ? deals : deals.filter(d => d.status === filter)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto', padding: '28px 16px', color: '#111' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>eSchoolDeals — Deal Review</h1>
      <p style={{ color: '#666', fontSize: 13, margin: '0 0 20px' }}>Review SerpApi results (Walmart + Woot) and Amazon SiteStripe deals before they go live.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="password" placeholder="CRON_SECRET" value={secret} onChange={e => setSecret(e.target.value)}
          style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: 200 }} />
        <button onClick={() => fetchDeals(filter)}
          style={{ padding: '7px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Load</button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{msg}</span>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, alignItems: 'center' }}>
        {['pending','active','all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13,
            border: filter===f ? 'none' : '1px solid #d1d5db',
            background: filter===f ? '#111' : '#fff', color: filter===f ? '#fff' : '#374151',
          }}>
            {f.charAt(0).toUpperCase()+f.slice(1)} ({counts[f]})
          </button>
        ))}
        <button onClick={() => fetchDeals(filter)}
          style={{ marginLeft: 'auto', padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 20, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#666' }}>
          ↻ Refresh
        </button>
      </div>

      {loading && <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading...</p>}
      {!loading && shown.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>
          {filter === 'pending' ? 'No pending deals. Trigger the cron to fetch new ones from SerpApi.' : 'No deals found.'}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {shown.map(d => <Card key={d.id} deal={d} onUpdate={update} onDelete={remove} />)}
      </div>
    </div>
  )
}

function Card({ deal: d, onUpdate, onDelete }) {
  const isPending = d.status === 'pending'
  const isActive  = d.status === 'active'
  const border    = isPending ? '#f59e0b' : isActive ? '#10b981' : '#e5e7eb'
  const badge     = isPending ? { bg: '#fef3c7', color: '#92400e' } : isActive ? { bg: '#d1fae5', color: '#065f46' } : { bg: '#f3f4f6', color: '#6b7280' }

  return (
    <div style={{ border: '1px solid '+border, borderRadius: 10, padding: 14, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.05)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: badge.bg, color: badge.color }}>
          {d.status.toUpperCase()} · {d.merchant}
        </span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>{d.source_key}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {d.image_url && <img src={d.image_url} alt="" style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 6, border: '1px solid #f3f4f6', flexShrink: 0 }} />}
        <p style={{ fontSize: 13, fontWeight: 500, margin: 0, lineHeight: 1.4, color: '#111', flex: 1 }}>{d.title}</p>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#111' }}>${d.sale_price?.toFixed(2)}</span>
        {d.original_price && <span style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>${d.original_price?.toFixed(2)}</span>}
        {d.discount_pct > 0 && <span style={{ fontSize: 11, fontWeight: 600, background: '#fee2e2', color: '#b91c1c', padding: '1px 7px', borderRadius: 10 }}>-{d.discount_pct}%</span>}
      </div>

      <a href={d.product_url} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none', wordBreak: 'break-all' }}>
        {(d.product_url||'').substring(0,65)}{(d.product_url||'').length>65?'…':''}
      </a>

      <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
        {isPending && (
          <button onClick={() => onUpdate(d.id, { status: 'active' })}
            style={{ padding: '5px 13px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            ✓ Approve
          </button>
        )}
        {isPending && (
          <button onClick={() => onUpdate(d.id, { status: 'expired' })}
            style={{ padding: '5px 13px', background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            ✕ Reject
          </button>
        )}
        {isActive && (
          <button onClick={() => onUpdate(d.id, { status: 'pending' })}
            style={{ padding: '5px 13px', background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            ↩ Un-publish
          </button>
        )}
        <button onClick={() => onDelete(d.id)}
          style={{ marginLeft: 'auto', padding: '5px 10px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          🗑
        </button>
      </div>
    </div>
  )
}
