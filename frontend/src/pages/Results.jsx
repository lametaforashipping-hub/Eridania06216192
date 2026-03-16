import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Trophy, Calendar } from 'lucide-react'

export default function Results() {
  const { apiFetch } = useAuth()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadResults() }, [])

  const loadResults = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/lottery-results/latest')
      if (res.ok) { const data = await res.json(); setResults(data.results || data || []) }
    } catch {} finally { setLoading(false) }
  }

  return (
    <div className="animate-in space-y-6" data-testid="results-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Resultados</h1>
        <button onClick={loadResults} className="btn-secondary text-sm" data-testid="refresh-results-btn">
          <Trophy size={16} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((r, i) => (
            <div key={i} className="card hover:border-emerald-500/30 transition-all" data-testid={`result-card-${i}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{r.lottery_name || 'Loteria'}</h3>
                <span className={`badge ${r.validated ? 'badge-success' : 'badge-warning'}`}>
                  {r.validated ? 'Validado' : 'Sin Validar'}
                </span>
              </div>
              <div className="text-center py-3 space-y-2">
                <div>
                  <p className="text-xs text-slate-500">1er Premio</p>
                  <p className="text-3xl font-bold text-emerald-400 font-mono tracking-wider">
                    {r.first_prize || '-'}
                  </p>
                </div>
                {r.second_prize && (
                  <div className="flex justify-center gap-6">
                    <div>
                      <p className="text-xs text-slate-500">2do</p>
                      <p className="text-lg font-bold text-blue-400 font-mono">{r.second_prize}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">3ro</p>
                      <p className="text-lg font-bold text-amber-400 font-mono">{r.third_prize || '-'}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>{r.draw_time || ''}</span>
                <span>{r.draw_date || ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && !results.length && <p className="text-center text-slate-500 py-12">No hay resultados disponibles</p>}
    </div>
  )
}
