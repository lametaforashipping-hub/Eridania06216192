import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { BarChart3, TrendingUp, DollarSign, Users } from 'lucide-react'

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

  if (loading) return <div className="flex justify-center py-20"><div className="spinner" /></div>

  return (
    <div className="animate-in space-y-6" data-testid="statistics-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Estadisticas</h1>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="text-sm w-40" data-testid="period-select">
          <option value="today">Hoy</option>
          <option value="week">Esta Semana</option>
          <option value="month">Este Mes</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ventas Totales" value={`$${(stats.total_sales || 0).toLocaleString()}`} icon={DollarSign} color="from-emerald-600 to-emerald-800" />
        <StatCard label="Tickets Vendidos" value={stats.total_tickets || 0} icon={BarChart3} color="from-blue-600 to-blue-800" />
        <StatCard label="Comisiones" value={`$${(stats.total_commissions || 0).toLocaleString()}`} icon={TrendingUp} color="from-purple-600 to-purple-800" />
        <StatCard label="Ganancia Neta" value={`$${(stats.net_profit || 0).toLocaleString()}`} icon={DollarSign} color="from-amber-600 to-amber-800" />
      </div>

      {data?.growth && (
        <div className="card">
          <h3 className="font-semibold mb-4">Crecimiento</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-400">Ventas vs Periodo Anterior</p>
              <p className={`text-2xl font-bold ${(data.growth.sales_percent || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(data.growth.sales_percent || 0) >= 0 ? '+' : ''}{(data.growth.sales_percent || 0).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Tickets vs Periodo Anterior</p>
              <p className={`text-2xl font-bold ${(data.growth.tickets_percent || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(data.growth.tickets_percent || 0) >= 0 ? '+' : ''}{(data.growth.tickets_percent || 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {data?.top_sellers?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">Top Vendedores</h3>
          <div className="table-container">
            <table>
              <thead><tr><th>#</th><th>Nombre</th><th>Ventas</th><th>Tickets</th></tr></thead>
              <tbody>
                {data.top_sellers.map((s, i) => (
                  <tr key={i}>
                    <td className="font-bold text-[--color-accent]">{i + 1}</td>
                    <td className="font-medium">{s.name}</td>
                    <td>${(s.total_sales || 0).toLocaleString()}</td>
                    <td>{s.total_tickets || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.sales_by_lottery?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">Ventas por Loteria</h3>
          <div className="space-y-3">
            {data.sales_by_lottery.map((l, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="text-sm w-40 truncate">{l.name || l.lottery_name}</span>
                <div className="flex-1 bg-[--color-surface] rounded-full h-3 overflow-hidden">
                  <div className="h-full bg-[--color-accent] rounded-full" style={{ width: `${Math.min(100, ((l.total || l.sales || 0) / (stats.total_sales || 1)) * 100)}%` }} />
                </div>
                <span className="text-sm font-semibold w-24 text-right">${(l.total || l.sales || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-xl p-5 border border-white/10`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-white/70">{label}</span>
        <Icon size={20} className="text-white/50" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
