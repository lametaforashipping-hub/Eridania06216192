import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Clock, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function Lotteries() {
  const { apiFetch } = useAuth()
  const [lotteries, setLotteries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadLotteries() }, [])

  const loadLotteries = async () => {
    try {
      const res = await apiFetch('/api/lotteries?active_only=false')
      if (res.ok) { const data = await res.json(); setLotteries(data.lotteries || data || []) }
    } catch {} finally { setLoading(false) }
  }

  const toggleStatus = async (lottery) => {
    const id = lottery.id || lottery._id
    await apiFetch(`/api/lotteries/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify({ active: lottery.active === false ? true : false }) 
    })
    loadLotteries()
  }

  if (loading) return <div className="app-page"><PageHeader title="Loterías" /><div className="flex justify-center py-20"><div className="spinner" /></div></div>

  return (
    <div className="app-page" data-testid="lotteries-page">
      <PageHeader title="Loterías" />
      <div className="app-page-content space-y-6">

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: '12px' }}>
        {lotteries.map((l, i) => (
          <div key={i} className="card hover:border-[--color-accent]/30 transition-all" data-testid={`lottery-card-${i}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">{l.name}</h3>
              <span className={`badge ${l.active !== false ? 'badge-success' : 'badge-danger'}`}>
                {l.active !== false ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <div className="space-y-2 text-sm text-slate-400">
              {l.country && <p>Pais: {l.country}</p>}
              {l.draw_times && (
                <div className="flex items-center gap-2">
                  <Clock size={14} />
                  <span>{Array.isArray(l.draw_times) ? l.draw_times.join(', ') : l.draw_times}</span>
                </div>
              )}
              {l.game_types && <p>Juegos: {Array.isArray(l.game_types) ? l.game_types.join(', ') : l.game_types}</p>}
            </div>
            <button onClick={() => toggleStatus(l)} className={`mt-4 text-sm px-3 py-1.5 rounded-lg ${l.active !== false ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'} transition-all`}>
              {l.active !== false ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
      {!lotteries.length && <p className="text-center py-12" style={{ color: '#94a3b8' }}>No hay loterias configuradas</p>}
      </div>
    </div>
  )
}
