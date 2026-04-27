'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'

const API = '/api/admin/deals'
const INGEST_API = '/api/ingest/run'

// ─── Constants ────────────────────────────────────────────────────────────────
const ESD_CAP = 6

const PLACEMENTS = [
  { value: 'feed', label: '📋 Main Feed',       desc: 'Grid only',         is_featured: false },
  { value: 'esd',  label: '⭐ ESD Recommended',  desc: 'ESD strip + grid',  is_featured: true  },
]

const STATUS_OPTS = [
  { value: 'pending', label: 'Pending', color: '#f59e0b', bg: '#fef3c7' },
  { value: 'active',  label: 'Active',  color: '#10b981', bg: '#d1fae5' },
  { value: 'expired', label: 'Expired', color: '#6b7280', bg: '#f3f4f6' },
]

const CATEGORIES = [
  'All', 'Electronics', 'Computers', 'Phones', 'Home', 'Kitchen',
  'Fashion', 'Sports', 'Travel', 'Toys', 'Software', 'Books',
]

const SORT_OPTS = [
  { value: 'score',     label: 'Score (high → low)' },
  { value: 'fetched',   label: 'Date (newest first)' },
  { value: 'price-asc', label: 'Price (low → high)' },
  { value: 'price-desc',label: 'Price (high → low)' },
  { value: 'discount',  label: 'Discount % (high → low)' },
]

// ─── Auth wrapper ─────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [screen,   setScreen]   = useState('checking')
  const [password, setPassword] = useState('')
  const [token,    setToken]    = useState('')
  const [error,    setError]    = useState('')
  const [isOpen,   setIsOpen]   = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('esd_admin_secret') || ''
    fetch(API + '?status=pending', { headers: { Authorization: 'Bearer ' + saved } })
      .then(r => {
        if (r.ok) { setToken(saved); setIsOpen(true); setScreen('dashboard') }
        else { localStorage.removeItem('esd_admin_secret'); setScreen('login') }
      })
      .catch(() => setScreen('login'))
  }, [])

  async function handleLogin(e) {
    e.preventDefault(); setError('')
    const res = await fetch(API + '?status=pending', { headers: { Authorization: 'Bearer ' + password } })
    if (res.ok) {
      localStorage.setItem('esd_admin_secret', password)
      setToken(password); setScreen('dashboard')
    }
    else setError('Incorrect password')
  }

  if (screen === 'checking') return <Wrap><p style={S.muted}>Loading…</p></Wrap>
  if (screen === 'login') return (
    <Wrap>
      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>Admin Login</h2>
      <p style={S.muted}>Enter your ADMIN_PASSWORD to continue.</p>
      <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:340, marginTop:16 }}>
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoFocus
          style={{ padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:7, fontSize:14 }} />
        {error && <p style={{ color:'#dc2626', fontSize:13, margin:0 }}>{error}</p>}
        <button type="submit" style={S.primaryBtn}>Log in</button>
      </form>
    </Wrap>
  )
  return <Dashboard token={token} isOpen={isOpen} />
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ token, isOpen }) {
  const [deals,    setDeals]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [filter,   setFilter]   = useState('pending')
  const [category, setCategory] = useState('All')
  const [sort,     setSort]     = useState('score')
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(new Set())
  const [msg,      setMsg]      = useState('')
  const [ingesting,setIngesting]= useState(false)

  const hdrs = useMemo(() => ({ 'Content-Type':'application/json', Authorization:'Bearer '+token }), [token])

  const load = useCallback(async () => {
    setLoading(true); setMsg('')
    try {
      const res  = await fetch(API + '?status=all', { headers: hdrs })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDeals(Array.isArray(data) ? data : [])
      setSelected(new Set())
    } catch (e) { setMsg('Error: '+e.message) }
    finally { setLoading(false) }
  }, [hdrs])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => ({
    total:   deals.length,
    pending: deals.filter(d => d.status === 'pending').length,
    active:  deals.filter(d => d.status === 'active').length,
    esd:     deals.filter(d => d.status === 'active' && d.is_featured).length,
    expired: deals.filter(d => d.status === 'expired').length,
  }), [deals])

  const overCap = stats.esd > ESD_CAP

  // ESD featured deals for the panel
  const esdDeals = useMemo(() =>
    deals
      .filter(d => d.status === 'active' && d.is_featured)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  , [deals])

  const shown = useMemo(() => {
    let list = deals
    if (filter   !== 'all')  list = list.filter(d => d.status === filter)
    if (category !== 'All')  list = list.filter(d => (d.category || '').toLowerCase() === category.toLowerCase())
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(d =>
        (d.title    || '').toLowerCase().includes(q) ||
        (d.merchant || '').toLowerCase().includes(q)
      )
    }
    const sorted = [...list]
    switch (sort) {
      case 'fetched':    sorted.sort((a,b) => new Date(b.fetched_at||0) - new Date(a.fetched_at||0)); break
      case 'price-asc':  sorted.sort((a,b) => (a.sale_price ?? Infinity) - (b.sale_price ?? Infinity)); break
      case 'price-desc': sorted.sort((a,b) => (b.sale_price ?? -1) - (a.sale_price ?? -1)); break
      case 'discount':   sorted.sort((a,b) => (b.discount_pct ?? 0) - (a.discount_pct ?? 0)); break
      default:           sorted.sort((a,b) => (b.score ?? 0) - (a.score ?? 0))
    }
    return sorted
  }, [deals, filter, category, sort, search])

  async function update(id, updates) {
    setMsg('')
    const res  = await fetch(API, { method:'PATCH', headers: hdrs, body: JSON.stringify({ id, ...updates }) })
    const data = await res.json()
    if (!res.ok) { setMsg('Error: '+data.error); return }
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
    flash('Saved')
  }

  async function remove(id) {
    if (!confirm('Delete this deal permanently?')) return
    const res = await fetch(API, { method:'DELETE', headers: hdrs, body: JSON.stringify({ id }) })
    if (!res.ok) { const d = await res.json(); setMsg('Error: '+d.error); return }
    setDeals(prev => prev.filter(d => d.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  async function bulk(action) {
    const ids = [...selected]
    if (!ids.length) return
    const verb = action === 'delete'   ? 'Delete' :
                 action === 'activate' ? 'Activate' :
                 action === 'pending'  ? 'Move to pending' :
                 action === 'expire'   ? 'Expire' :
                 action === 'feature'   ? 'ESD Recommend' :
                 action === 'unfeature' ? 'Remove from ESD' : action
    if (!confirm(`${verb} ${ids.length} deal${ids.length>1?'s':''}?`)) return

    setMsg(`${verb}ing ${ids.length}…`)
    let ok = 0, fail = 0
    for (const id of ids) {
      try {
        if (action === 'delete') {
          const r = await fetch(API, { method:'DELETE', headers: hdrs, body: JSON.stringify({ id }) })
          r.ok ? ok++ : fail++
        } else if (action === 'feature' || action === 'unfeature') {
          const r = await fetch(API, { method:'PATCH', headers: hdrs, body: JSON.stringify({ id, is_featured: action === 'feature', ...(action === 'feature' && { status: 'active' }) }) })
          r.ok ? ok++ : fail++
        } else {
          const status = action === 'activate' ? 'active' : action === 'pending' ? 'pending' : 'expired'
          const r = await fetch(API, { method:'PATCH', headers: hdrs, body: JSON.stringify({ id, status }) })
          r.ok ? ok++ : fail++
        }
      } catch { fail++ }
    }
    setMsg(`${verb}d ${ok}${fail ? ` · ${fail} failed` : ''}`)
    setSelected(new Set())
    await load()
    setTimeout(() => setMsg(''), 4000)
  }

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAllShown() {
    const allIds = shown.map(d => d.id)
    const allSelected = allIds.every(id => selected.has(id))
    setSelected(allSelected ? new Set() : new Set(allIds))
  }

  function flash(text) { setMsg(text); setTimeout(() => setMsg(''), 2000) }

  async function approveAllPending() {
    const pending = deals.filter(d => d.status === 'pending')
    if (!pending.length) return
    if (!confirm(`Activate all ${pending.length} pending deals?`)) return
    setMsg(`Activating ${pending.length} deals…`)
    let ok = 0, fail = 0
    for (const d of pending) {
      try {
        const r = await fetch(API, { method:'PATCH', headers: hdrs, body: JSON.stringify({ id: d.id, status: 'active' }) })
        r.ok ? ok++ : fail++
      } catch { fail++ }
    }
    setMsg(`Activated ${ok}${fail ? ` · ${fail} failed` : ''} ✅`)
    await load()
    setTimeout(() => setMsg(''), 4000)
  }

  async function runIngest() {
    if (!confirm('Run ingest now? This will fetch fresh deals from all RSS sources (Walmart, Slickdeals, eDealInfo, DealNews).')) return
    setIngesting(true); setMsg('Running ingest — this may take 30 seconds…')
    try {
      const res  = await fetch(INGEST_API, { method:'POST', headers: hdrs })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ingest failed')
      setMsg(`Ingest done. New: ${data.upserted ?? data.count ?? '?'}`)
      await load()
    } catch (e) { setMsg('Ingest error: ' + e.message) }
    finally {
      setIngesting(false)
      setTimeout(() => setMsg(''), 6000)
    }
  }

  return (
    <Wrap>
      {isOpen && (
        <div style={{ background:'#fef9c3', border:'1px solid #fde047', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13 }}>
          <strong>No password set.</strong> Add <code>ADMIN_PASSWORD</code> in Vercel env vars to secure this page, then redeploy.
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:6 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, margin:'0 0 4px' }}>eSchoolDeals — Deal Manager</h1>
          <p style={{ color:'#6b7280', fontSize:13, margin:0 }}>Review RSS deals, add deals manually, and control placement.</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={approveAllPending} disabled={stats.pending === 0}
            style={{ ...S.secondaryBtn, background:'#10b981', color:'#fff', opacity: stats.pending === 0 ? 0.4 : 1, cursor: stats.pending === 0 ? 'default' : 'pointer' }}>
            ✅ Approve All Pending ({stats.pending})
          </button>
          <button onClick={runIngest} disabled={ingesting}
            style={{ ...S.secondaryBtn, opacity: ingesting ? 0.6 : 1, cursor: ingesting ? 'wait' : 'pointer' }}>
            {ingesting ? '⏳ Running…' : '🔄 Run Ingest Now'}
          </button>
        </div>
      </div>

      {/* ── Stats cards ─────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10, margin:'16px 0' }}>
        <StatCard label="Pending" value={stats.pending} color="#f59e0b" />
        <StatCard label="Active" value={stats.active} color="#10b981" />
        <StatCard label="ESD Recommended" value={`${stats.esd} / ${ESD_CAP}`} color={overCap ? '#dc2626' : '#6366f1'} />
        <StatCard label="Total Deals" value={stats.total} color="#374151" />
      </div>

      {overCap && (
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#991b1b' }}>
          <strong>⚠️ Over ESD cap.</strong> The strip shows max {ESD_CAP} deals — you have {stats.esd} marked.
          The 6 with the highest score will display; the rest are hidden until you un-flag them.
        </div>
      )}

      {/* ── ESD Recommended Panel ───────────────────────────────────────────── */}
      <ESDPanel deals={esdDeals} onUpdate={update} onDelete={remove} />

      {/* ── Add Deal form ───────────────────────────────────────────────────── */}
      <AddDealForm token={token} onAdded={load} />

      {/* ── Filters / search / sort ─────────────────────────────────────────── */}
      <div style={{ display:'grid', gap:8, marginBottom:14 }}>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          {['pending','active','expired','all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding:'5px 14px', borderRadius:20, cursor:'pointer', fontSize:13,
              border: filter===f ? 'none' : '1px solid #d1d5db',
              background: filter===f ? '#111' : '#fff', color: filter===f ? '#fff' : '#374151',
            }}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase()+f.slice(1)}
              {' '}({f === 'all' ? stats.total : f === 'active' ? stats.active : f === 'pending' ? stats.pending : stats.expired})
            </button>
          ))}
          <button onClick={load} style={S.refreshBtn}>↻ Refresh</button>
          {msg && <span style={{ fontSize:13, color: msg.startsWith('Error') || msg.startsWith('Ingest error') ? '#dc2626' : '#16a34a', marginLeft:'auto' }}>{msg}</span>}
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <input
            type="text" placeholder="Search title or merchant…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex:'1 1 220px', padding:'7px 12px', border:'1px solid #d1d5db', borderRadius:7, fontSize:13 }}
          />
          <select value={category} onChange={e => setCategory(e.target.value)} style={S.select}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} style={S.select}>
            {SORT_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Bulk action bar */}
        {shown.length > 0 && (
          <div style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 12px', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:7, fontSize:13, flexWrap:'wrap' }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
              <input type="checkbox"
                checked={shown.length > 0 && shown.every(d => selected.has(d.id))}
                onChange={selectAllShown} />
              Select all ({shown.length})
            </label>
            {selected.size > 0 && (
              <>
                <span style={{ color:'#6b7280' }}>{selected.size} selected</span>
                <span style={{ color:'#d1d5db' }}>|</span>
                <button onClick={() => bulk('activate')} style={S.bulkBtn('#10b981')}>Activate</button>
                <button onClick={() => bulk('pending')}  style={S.bulkBtn('#f59e0b')}>Move to Pending</button>
                <button onClick={() => bulk('expire')}   style={S.bulkBtn('#6b7280')}>Expire</button>
                <button onClick={() => bulk('delete')}   style={S.bulkBtn('#dc2626')}>Delete</button>
                <button onClick={() => bulk('feature')}  style={S.bulkBtn('#6366f1')}>⭐ ESD Recommend</button>
                <button onClick={() => bulk('unfeature')} style={S.bulkBtn('#6b7280')}>Remove from ESD</button>
                <button onClick={() => setSelected(new Set())} style={{ ...S.bulkBtn('#6b7280'), background:'transparent', color:'#6b7280' }}>Clear</button>
              </>
            )}
          </div>
        )}
      </div>

      {loading && <p style={S.muted}>Loading…</p>}
      {!loading && shown.length === 0 && (
        <p style={S.muted}>
          {filter === 'pending' ? 'No pending deals — trigger ingest to pull fresh ones.' : 'No deals match these filters.'}
        </p>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(330px, 1fr))', gap:12 }}>
        {shown.map(d => (
          <Card key={d.id} deal={d}
            selected={selected.has(d.id)}
            onSelect={() => toggleSelect(d.id)}
            onUpdate={update}
            onDelete={remove}
          />
        ))}
      </div>
    </Wrap>
  )
}

// ─── ESD Recommended Panel ────────────────────────────────────────────────────
function ESDPanel({ deals, onUpdate, onDelete }) {
  const [editingId,    setEditingId]    = useState(null)
  const [editTitle,    setEditTitle]    = useState('')
  const [editScore,    setEditScore]    = useState('')
  const [saving,       setSaving]       = useState(false)

  if (!deals.length) return (
    <div style={{ border:'1px dashed #e5e7eb', borderRadius:10, padding:'16px 20px', marginBottom:20, background:'#fafafa' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
        <span style={{ fontSize:15, fontWeight:700 }}>⭐ ESD Recommended</span>
        <span style={{ fontSize:11, color:'#9ca3af', background:'#f3f4f6', padding:'2px 8px', borderRadius:10 }}>0 / 6</span>
      </div>
      <p style={{ fontSize:13, color:'#9ca3af', margin:0 }}>No featured deals yet. Mark deals as ⭐ ESD Recommended to add them here.</p>
    </div>
  )

  function startEdit(deal) {
    setEditingId(deal.id)
    setEditTitle(deal.title)
    setEditScore(String(deal.score ?? 0))
  }

  async function saveEdit(deal) {
    setSaving(true)
    const updates = {}
    if (editTitle.trim() && editTitle.trim() !== deal.title) updates.title = editTitle.trim()
    const newScore = parseFloat(editScore)
    if (Number.isFinite(newScore) && newScore !== deal.score) updates.score = newScore
    if (Object.keys(updates).length) await onUpdate(deal.id, updates)
    setEditingId(null)
    setSaving(false)
  }

  function cancelEdit() { setEditingId(null) }

  async function removeFromESD(id) {
    await onUpdate(id, { is_featured: false })
  }

  return (
    <div style={{ border:'1px solid #e0e7ff', borderRadius:10, marginBottom:20, overflow:'hidden', background:'#fafbff' }}>
      {/* Header */}
      <div style={{ padding:'12px 16px', borderBottom:'1px solid #e0e7ff', display:'flex', alignItems:'center', gap:10, background:'#fff' }}>
        <span style={{ fontSize:15, fontWeight:700 }}>⭐ ESD Recommended</span>
        <span style={{
          fontSize:11, fontWeight:700,
          background: deals.length > ESD_CAP ? '#fef2f2' : '#ede9fe',
          color: deals.length > ESD_CAP ? '#dc2626' : '#6366f1',
          padding:'2px 9px', borderRadius:10,
        }}>
          {deals.length} / {ESD_CAP}
        </span>
        <span style={{ fontSize:12, color:'#6b7280', marginLeft:4 }}>
          Showing in the ESD strip on homepage · sorted by score
        </span>
      </div>

      {/* Deal rows */}
      <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
        {deals.map((deal, idx) => {
          const isEditing = editingId === deal.id
          const proxySrc = deal.image_url ? `/api/img?url=${encodeURIComponent(deal.image_url)}` : ''
          return (
            <div key={deal.id} style={{
              display:'flex', gap:12, alignItems:'flex-start',
              background:'#fff', border: idx < ESD_CAP ? '1px solid #e0e7ff' : '1px solid #fecaca',
              borderRadius:8, padding:'10px 12px',
            }}>
              {/* Rank */}
              <div style={{ fontSize:11, fontWeight:800, color: idx < ESD_CAP ? '#6366f1' : '#dc2626', width:18, flexShrink:0, paddingTop:2 }}>
                {idx < ESD_CAP ? `#${idx+1}` : '✕'}
              </div>

              {/* Image */}
              {proxySrc ? (
                <img src={proxySrc} alt="" loading="lazy"
                  style={{ width:52, height:52, objectFit:'contain', borderRadius:5, border:'1px solid #f3f4f6', flexShrink:0, background:'#fafafa' }}
                  onError={e => { e.currentTarget.style.display='none' }} />
              ) : (
                <div style={{ width:52, height:52, borderRadius:5, border:'1px dashed #e5e7eb', flexShrink:0, background:'#fafafa' }} />
              )}

              {/* Title + score — editable */}
              <div style={{ flex:1, minWidth:0 }}>
                {isEditing ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      style={{ padding:'5px 8px', border:'1px solid #6366f1', borderRadius:5, fontSize:12, width:'100%', boxSizing:'border-box' }}
                    />
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <label style={{ fontSize:11, color:'#6b7280' }}>Score:</label>
                      <input type="number" step="1"
                        value={editScore}
                        onChange={e => setEditScore(e.target.value)}
                        style={{ width:70, padding:'3px 6px', border:'1px solid #d1d5db', borderRadius:5, fontSize:12 }}
                      />
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => saveEdit(deal)} disabled={saving}
                        style={{ padding:'4px 12px', background:'#6366f1', color:'#fff', border:'none', borderRadius:5, fontSize:12, cursor:'pointer' }}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={cancelEdit}
                        style={{ padding:'4px 10px', background:'#f3f4f6', color:'#374151', border:'none', borderRadius:5, fontSize:12, cursor:'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize:12, fontWeight:500, margin:'0 0 3px', lineHeight:1.4, wordBreak:'break-word' }}>{deal.title}</p>
                    <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ fontSize:13, fontWeight:700 }}>${Number(deal.sale_price ?? 0).toFixed(2)}</span>
                      <span style={{ fontSize:11, color:'#6b7280' }}>Score: <strong>{Number(deal.score ?? 0).toFixed(0)}</strong></span>
                      <span style={{ fontSize:11, color:'#9ca3af' }}>{deal.merchant}</span>
                      {idx >= ESD_CAP && (
                        <span style={{ fontSize:10, color:'#dc2626', fontWeight:600 }}>Over cap — hidden</span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              {!isEditing && (
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => startEdit(deal)}
                    style={{ padding:'5px 10px', background:'#f3f4f6', color:'#374151', border:'1px solid #e5e7eb', borderRadius:6, cursor:'pointer', fontSize:12 }}>
                    ✎ Edit
                  </button>
                  <button onClick={() => removeFromESD(deal.id)}
                    style={{ padding:'5px 10px', background:'#fff', color:'#6366f1', border:'1px solid #c7d2fe', borderRadius:6, cursor:'pointer', fontSize:12 }}>
                    Remove
                  </button>
                  <button onClick={() => onDelete(deal.id)}
                    style={{ padding:'5px 10px', background:'#fff', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, cursor:'pointer', fontSize:12 }}>
                    🗑
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, padding:'12px 14px' }}>
      <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, textTransform:'uppercase', letterSpacing:0.3, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, color }}>{value}</div>
    </div>
  )
}

// ─── Deal card ────────────────────────────────────────────────────────────────
function Card({ deal: d, selected, onSelect, onUpdate, onDelete }) {
  const [editingScore, setEditingScore] = useState(false)
  const [scoreInput,   setScoreInput]   = useState(d.score ?? 0)

  const isPending = d.status === 'pending'
  const isActive  = d.status === 'active'
  const isESD     = Boolean(d.is_featured)
  const placement = isESD ? 'esd' : 'feed'
  const border    = selected ? '#6366f1' : isPending ? '#f59e0b' : isActive ? '#10b981' : '#e5e7eb'
  const statusOpt = STATUS_OPTS.find(s => s.value === d.status) || STATUS_OPTS[0]

  function commitScore() {
    setEditingScore(false)
    const newScore = parseFloat(scoreInput)
    if (!Number.isFinite(newScore) || newScore === d.score) return
    onUpdate(d.id, { score: newScore })
  }

  return (
    <div style={{
      border: `${selected ? '2px' : '1px'} solid ${border}`,
      borderRadius:10, padding:14, background:'#fff',
      boxShadow:'0 1px 3px rgba(0,0,0,.05)',
      display:'flex', flexDirection:'column', gap:10,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
        <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
          <input type="checkbox" checked={selected} onChange={onSelect} />
          <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:statusOpt.bg, color:statusOpt.color }}>
            {statusOpt.label.toUpperCase()} · {d.merchant || '—'}
          </span>
        </label>
        <span style={{ fontSize:10, color:'#9ca3af' }}>{d.source_key || '—'}</span>
      </div>

      <div style={{ display:'flex', gap:12 }}>
        {d.image_url ? (
          <img src={d.image_url} alt="" loading="lazy"
            style={{ width:88, height:88, objectFit:'contain', borderRadius:6, border:'1px solid #f3f4f6', flexShrink:0, background:'#fafafa' }}
            onError={(e) => { e.currentTarget.style.display = 'none' }} />
        ) : (
          <div style={{ width:88, height:88, borderRadius:6, border:'1px dashed #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#9ca3af', flexShrink:0 }}>no image</div>
        )}
        <p style={{ fontSize:13, fontWeight:500, margin:0, lineHeight:1.4, flex:1, wordBreak:'break-word' }}>{d.title}</p>
      </div>

      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:18, fontWeight:700 }}>${Number(d.sale_price ?? 0).toFixed(2)}</span>
        {d.original_price != null && Number(d.original_price) > 0 && (
          <span style={{ fontSize:12, color:'#9ca3af', textDecoration:'line-through' }}>${Number(d.original_price).toFixed(2)}</span>
        )}
        {d.discount_pct > 0 && (
          <span style={{ fontSize:11, fontWeight:600, background:'#fee2e2', color:'#b91c1c', padding:'2px 8px', borderRadius:10 }}>
            -{d.discount_pct}%
          </span>
        )}
        <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#6b7280' }}>
          score:
          {editingScore ? (
            <input type="number" step="1" autoFocus
              value={scoreInput}
              onChange={e => setScoreInput(e.target.value)}
              onBlur={commitScore}
              onKeyDown={e => { if (e.key === 'Enter') commitScore(); if (e.key === 'Escape') { setEditingScore(false); setScoreInput(d.score ?? 0) } }}
              style={{ width:56, padding:'1px 5px', border:'1px solid #d1d5db', borderRadius:4, fontSize:11 }}
            />
          ) : (
            <button onClick={() => { setScoreInput(d.score ?? 0); setEditingScore(true) }}
              style={{ background:'transparent', border:'1px dashed transparent', padding:'1px 4px', borderRadius:4, fontSize:11, color:'#374151', fontWeight:600, cursor:'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#d1d5db'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
              {Number(d.score ?? 0).toFixed(0)} ✎
            </button>
          )}
        </span>
      </div>

      <a href={d.product_url} target="_blank" rel="noopener noreferrer"
        style={{ fontSize:11, color:'#6366f1', textDecoration:'none', wordBreak:'break-all' }}>
        {(d.product_url || '').substring(0, 80)}{(d.product_url || '').length > 80 ? '…' : ''}
      </a>

      <div style={{ background:'#f9fafb', borderRadius:7, padding:'8px 10px' }}>
        <p style={S.fieldLabel}>STATUS</p>
        <div style={{ display:'flex', gap:6 }}>
          {STATUS_OPTS.map(opt => (
            <button key={opt.value} onClick={() => d.status !== opt.value && onUpdate(d.id, { status: opt.value })}
              style={{
                flex:1, padding:'5px 8px', fontSize:11, fontWeight:600,
                border: d.status === opt.value ? `2px solid ${opt.color}` : '1px solid #e5e7eb',
                borderRadius:6, cursor:'pointer',
                background: d.status === opt.value ? opt.bg : '#fff',
                color:      d.status === opt.value ? opt.color : '#6b7280',
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isActive && (
        <div style={{ background:'#f9fafb', borderRadius:7, padding:'8px 10px' }}>
          <p style={S.fieldLabel}>PLACEMENT</p>
          <div style={{ display:'flex', gap:6 }}>
            {PLACEMENTS.map(p => (
              <label key={p.value} style={{
                display:'flex', alignItems:'center', gap:4, cursor:'pointer', padding:'4px 9px',
                border: placement === p.value ? '2px solid #111' : '1px solid #e5e7eb',
                borderRadius:6, fontSize:12, fontWeight: placement === p.value ? 600 : 400,
                background: placement === p.value ? '#fff' : 'transparent', flex:1, justifyContent:'center',
              }}>
                <input type="radio" name={'placement-'+d.id} value={p.value} checked={placement === p.value}
                  onChange={() => onUpdate(d.id, { is_featured: p.is_featured })} style={{ margin:0 }} />
                {p.label}
              </label>
            ))}
          </div>
          {isESD && <p style={{ fontSize:10, color:'#6b7280', margin:'5px 0 0' }}>⭐ Showing in ESD Student Recommended strip</p>}
        </div>
      )}

      <div style={{ display:'flex' }}>
        <button onClick={() => onDelete(d.id)} style={{
          marginLeft:'auto', padding:'5px 10px', background:'#fff', color:'#dc2626',
          border:'1px solid #fecaca', borderRadius:6, cursor:'pointer', fontSize:12,
        }}>🗑 Delete</button>
      </div>
    </div>
  )
}

// ─── Add Deal form ────────────────────────────────────────────────────────────
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
    if (!form.title || !form.product_url || !form.sale_price) {
      setMsg('Title, URL and price are required'); return
    }
    setSaving(true); setMsg('')
    const p = PLACEMENTS.find(x => x.value === form.placement)
    const body = {
      title:               form.title.trim(),
      product_url:         form.product_url.trim(),
      sale_price:          parseFloat(form.sale_price),
      original_price:      form.original_price ? parseFloat(form.original_price) : null,
      image_url:           form.image_url.trim() || null,
      merchant:            form.merchant.trim() || 'Manual',
      category:            form.category,
      is_featured:         p?.is_featured ?? false,
      source_key:          'manual',
      source_type:         'manual',
      in_stock:            true,
      is_student_relevant: true,
      status:              'active',
    }
    const res  = await fetch(API, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token }, body: JSON.stringify(body) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg('Error: ' + data.error); return }
    setMsg('Deal added!')
    setForm({ title:'', product_url:'', sale_price:'', original_price:'', image_url:'', merchant:'', category:'Electronics', placement:'feed' })
    onAdded()
    setTimeout(() => setMsg(''), 3000)
  }

  const inp = (extra={}) => ({
    style:{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13, width:'100%', boxSizing:'border-box', ...extra.style },
    ...extra,
  })

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
              <label style={S.fieldLabel}>Title *</label>
              <input {...inp()} placeholder="Product title" value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={S.fieldLabel}>Product URL *</label>
              <input {...inp()} placeholder="https://..." value={form.product_url} onChange={e => set('product_url', e.target.value)} />
            </div>
            <div>
              <label style={S.fieldLabel}>Sale Price * ($)</label>
              <input {...inp()} type="number" step="0.01" placeholder="0.00" value={form.sale_price} onChange={e => set('sale_price', e.target.value)} />
            </div>
            <div>
              <label style={S.fieldLabel}>Original Price ($)</label>
              <input {...inp()} type="number" step="0.01" placeholder="Optional" value={form.original_price} onChange={e => set('original_price', e.target.value)} />
            </div>
            <div>
              <label style={S.fieldLabel}>Merchant</label>
              <input {...inp()} placeholder="e.g. Amazon, Best Buy" value={form.merchant} onChange={e => set('merchant', e.target.value)} />
            </div>
            <div>
              <label style={S.fieldLabel}>Category</label>
              <select {...inp()} value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={S.fieldLabel}>Image URL</label>
              <input {...inp()} placeholder="https://... (optional)" value={form.image_url} onChange={e => set('image_url', e.target.value)} />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ ...S.fieldLabel, marginBottom:6 }}>Placement</label>
              <div style={{ display:'flex', gap:8 }}>
                {PLACEMENTS.map(p => (
                  <label key={p.value} style={{
                    display:'flex', alignItems:'center', gap:6, cursor:'pointer', padding:'7px 12px',
                    border: form.placement === p.value ? '2px solid #111' : '1px solid #e5e7eb',
                    borderRadius:7, fontSize:13, fontWeight: form.placement === p.value ? 600 : 400,
                    background: form.placement === p.value ? '#f9fafb' : '#fff',
                  }}>
                    <input type="radio" name="placement" value={p.value} checked={form.placement === p.value}
                      onChange={() => set('placement', p.value)} style={{ margin:0 }} />
                    <span>{p.label}</span>
                    <span style={{ color:'#9ca3af', fontSize:11 }}>{p.desc}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <button type="submit" disabled={saving}
              style={{ padding:'8px 20px', background:'#10b981', color:'#fff', border:'none', borderRadius:7, cursor: saving ? 'wait' : 'pointer', fontSize:13, fontWeight:600 }}>
              {saving ? 'Adding…' : 'Add Deal'}
            </button>
            {msg && <span style={{ fontSize:13, color: msg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{msg}</span>}
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Layout + style helpers ───────────────────────────────────────────────────
function Wrap({ children }) {
  return (
    <div style={{ fontFamily:'system-ui, sans-serif', maxWidth:1200, margin:'0 auto', padding:'32px 16px', color:'#111' }}>
      {children}
    </div>
  )
}

const S = {
  muted:        { color:'#9ca3af', fontSize:13, margin:0 },
  fieldLabel:   { fontSize:11, color:'#6b7280', display:'block', marginBottom:3, fontWeight:600, letterSpacing:0.3, textTransform:'uppercase' },
  primaryBtn:   { padding:'9px', background:'#111', color:'#fff', border:'none', borderRadius:7, fontSize:14, fontWeight:600, cursor:'pointer' },
  secondaryBtn: { padding:'8px 16px', background:'#fff', color:'#111', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' },
  refreshBtn:   { padding:'5px 12px', border:'1px solid #d1d5db', borderRadius:20, background:'#fff', cursor:'pointer', fontSize:12, color:'#666' },
  select:       { padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, background:'#fff', cursor:'pointer' },
  bulkBtn: (color) => ({
    padding:'4px 10px', background:color, color:'#fff', border:'none', borderRadius:5, cursor:'pointer', fontSize:12, fontWeight:600,
  }),
}
