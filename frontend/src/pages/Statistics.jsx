import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { BarChart3, TrendingUp, DollarSign } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function Statistics() {
  const { apiFetch } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('today')

  useEffect(() => { loadStats() }, [period])

  const loadStats = async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/admin/stats/dashboard?period=${period}`)
      if (res.ok) setData(await res.json())
    } catch {} finally { setLoading(false) }
  }

  const stats = data?.summary || {}

  return (
    <div className="app-page" data-testid="statistics-page">
      <PageHeader title="Estadísticas" />
      <div className="app-page-content space-y-6">
        <div style={{ textAlign: 'right' }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ width: '160px' }} data-testid="period-select">
            <option value="today">Hoy</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mes</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : (
          <>
            <div className="dash-stats-grid">
              <div className="dash-stat-card"><DollarSign size={24} color="#22c55e" /><p className="dash-stat-label">Ventas</p><p className="dash-stat-value">${(stats.total_sales || 0).toLocaleString()}</p></div>
              <div className="dash-stat-card"><BarChart3 size={24} color="#3b82f6" /><p className="dash-stat-label">Tickets</p><p className="dash-stat-value">{stats.total_tickets || 0}</p></div>
              <div className="dash-stat-card"><TrendingUp size={24} color="#8b5cf6" /><p className="dash-stat-label">Comisiones</p><p className="dash-stat-value">${(stats.total_commissions || 0).toLocaleString()}</p></div>
              <div className="dash-stat-card"><DollarSign size={24} color="#f59e0b" /><p className="dash-stat-label">Ganancia</p><p className="dash-stat-value">${(stats.net_profit || 0).toLocaleString()}</p></div>
            </div>

            {data?.top_sellers?.length > 0 && (
              <div className="card">
                <h3 className="font-semibold mb-4">Top Vendedores</h3>
                <div className="table-container">
                  <table><thead><tr><th>#</th><th>Nombre</th><th>Ventas</th><th>Tickets</th></tr></thead>
                  <tbody>{data.top_sellers.map((s, i) => (
                    <tr key={i}><td className="font-bold" style={{ color: '#8b5cf6' }}>{i+1}</td><td className="font-medium">{s.name}</td><td>${(s.total_sales||0).toLocaleString()}</td><td>{s.total_tickets||0}</td></tr>
                  ))}</tbody></table>
                </div>
              </div>
            )}

            {data?.sales_by_lottery?.length > 0 && (
              <div className="card">
                <h3 className="font-semibold mb-4">Ventas por Lotería</h3>
                <div className="space-y-3">
                  {data.sales_by_lottery.map((l, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="text-sm truncate" style={{ width: '140px' }}>{l.name || l.lottery_name}</span>
                      <div style={{ flex: 1, background: '#1e293b', borderRadius: '999px', height: '12px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#8b5cf6', borderRadius: '999px', width: `${Math.min(100, ((l.total||l.sales||0) / (stats.total_sales||1))*100)}%` }} />
                      </div>
                      <span className="text-sm font-semibold" style={{ width: '80px', textAlign: 'right' }}>${(l.total||l.sales||0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
