import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { DollarSign, Ticket, Users, TrendingUp } from 'lucide-react'

export default function Dashboard() {
  const { apiFetch, user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    try {
      const res = await apiFetch('/api/admin/stats/dashboard')
      if (res.ok) {
        const data = await res.json()
        setStats(data.summary || data)
      }
    } catch {} finally { setLoading(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="spinner" /></div>

  const cards = [
    { label: 'Ventas Totales', value: `$${(stats?.total_sales || 0).toLocaleString()}`, icon: DollarSign, color: 'from-emerald-600 to-emerald-800' },
    { label: 'Tickets Vendidos', value: stats?.total_tickets || 0, icon: Ticket, color: 'from-blue-600 to-blue-800' },
    { label: 'Ganancia Neta', value: `$${(stats?.net_profit || 0).toLocaleString()}`, icon: Users, color: 'from-purple-600 to-purple-800' },
    { label: 'Comisiones', value: `$${(stats?.total_commissions || 0).toLocaleString()}`, icon: TrendingUp, color: 'from-amber-600 to-amber-800' },
  ]

  return (
    <div className="animate-in space-y-6" data-testid="dashboard-page">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-slate-400">Bienvenido, {user?.name}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div key={i} className={`bg-gradient-to-br ${c.color} rounded-xl p-5 border border-white/10`} data-testid={`stat-card-${i}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/70">{c.label}</span>
              <c.icon size={20} className="text-white/50" />
            </div>
            <p className="text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold mb-4">Ultimas Ventas</h3>
          <RecentTickets apiFetch={apiFetch} />
        </div>
        <div className="card">
          <h3 className="font-semibold mb-4">Ultimos Resultados</h3>
          <RecentResults apiFetch={apiFetch} />
        </div>
      </div>
    </div>
  )
}

function RecentTickets({ apiFetch }) {
  const [tickets, setTickets] = useState([])
  useEffect(() => {
    apiFetch('/api/tickets?limit=5').then(r => r.ok && r.json().then(d => setTickets(d.tickets || d || [])))
  }, [])
  if (!tickets.length) return <p className="text-slate-500 text-sm">No hay ventas recientes</p>
  return (
    <div className="space-y-2">
      {tickets.slice(0, 5).map((t, i) => (
        <div key={i} className="flex justify-between items-center py-2 border-b border-[--color-surface-lighter] last:border-0">
          <div>
            <p className="text-sm font-medium">{t.ticket_number || t.number || `#${i+1}`}</p>
            <p className="text-xs text-slate-500">{t.lottery_name || 'Loteria'}</p>
          </div>
          <span className="text-sm font-semibold text-[--color-accent]">${(t.total || t.amount || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function RecentResults({ apiFetch }) {
  const [results, setResults] = useState([])
  useEffect(() => {
    apiFetch('/api/lottery-results/latest').then(r => r.ok && r.json().then(d => setResults(d.results || d || [])))
  }, [])
  if (!results.length) return <p className="text-slate-500 text-sm">No hay resultados recientes</p>
  return (
    <div className="space-y-2">
      {results.slice(0, 5).map((r, i) => (
        <div key={i} className="flex justify-between items-center py-2 border-b border-[--color-surface-lighter] last:border-0">
          <div>
            <p className="text-sm font-medium">{r.lottery_name || 'Loteria'}</p>
            <p className="text-xs text-slate-500">{r.draw_time || ''}</p>
          </div>
          <span className="text-sm font-bold text-emerald-400">{r.first_prize || '-'}</span>
        </div>
      ))}
    </div>
  )
}
