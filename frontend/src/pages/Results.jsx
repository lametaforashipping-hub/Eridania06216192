import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Trophy } from 'lucide-react'
import PageHeader from '../components/PageHeader'

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
    <div className="app-page" data-testid="results-page">
      <PageHeader title="Resultados" />
      <div className="app-page-content space-y-4">
        <div style={{ textAlign: 'right' }}>
          <button onClick={loadResults} className="btn-secondary" data-testid="refresh-results-btn">
            <Trophy size={16} /> Actualizar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: '12px' }}>
            {results.map((r, i) => (
              <div key={i} className="card" data-testid={`result-card-${i}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm">{r.lottery_name || 'Lotería'}</span>
                  <span className={`badge ${r.validated ? 'badge-success' : 'badge-warning'}`}>
                    {r.validated ? 'Validado' : 'Sin Validar'}
                  </span>
                </div>
                <div className="text-center py-3 space-y-2">
                  <div>
                    <p className="text-xs" style={{ color: '#94a3b8' }}>1er Premio</p>
                    <p className="text-3xl font-bold text-emerald-400 font-mono tracking-wider">{r.first_prize || '-'}</p>
                  </div>
                  {r.second_prize && (
                    <div className="flex justify-center gap-6">
                      <div><p className="text-xs" style={{ color: '#94a3b8' }}>2do</p><p className="text-sm font-bold text-blue-400 font-mono" style={{ fontSize: '18px' }}>{r.second_prize}</p></div>
                      <div><p className="text-xs" style={{ color: '#94a3b8' }}>3ro</p><p className="text-sm font-bold text-amber-400 font-mono" style={{ fontSize: '18px' }}>{r.third_prize || '-'}</p></div>
                    </div>
                  )}
                </div>
                <div className="flex justify-between text-xs mt-2" style={{ color: '#64748b' }}>
                  <span>{r.draw_time || ''}</span>
                  <span>{r.draw_date || ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && !results.length && <p className="text-center py-12" style={{ color: '#94a3b8' }}>No hay resultados disponibles</p>}
      </div>
    </div>
  )
}
