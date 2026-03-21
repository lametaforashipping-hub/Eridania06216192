import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { DollarSign, TrendingUp, TrendingDown, Ticket, BarChart3, Calendar } from 'lucide-react'

export default function UserReport() {
  const { apiFetch, user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('daily')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/accounting/detailed-seller-report?period=${period}`)
      if (res.ok) setData(await res.json())
    } catch {} finally { setLoading(false) }
  }, [period])

  useEffect(() => { loadData() }, [loadData])

  const fmt = (amount, currency) => {
    const sym = currency || data?.seller?.currency || 'RD$'
    return `${sym} ${(amount || 0).toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  const summary = data?.summary || {}
  const counts = data?.ticket_counts || {}
  const maxDailySales = Math.max(...(data?.daily_breakdown?.map(d => d.sales) || [0]), 1)

  const statusLabel = (s) => {
    const map = { pending: 'Pendiente', won: 'Ganador', paid: 'Pagado', lost: 'Perdido', cancelled: 'Cancelado' }
    return map[s] || s
  }
  const statusClass = (s) => {
    const map = { pending: 'badge-warning', won: 'badge-success', paid: 'badge-success', lost: '', cancelled: 'badge-danger' }
    return map[s] || ''
  }

  return (
    <div className="app-page" data-testid="user-report-page">
      <PageHeader title="Mi Reporte" />
      <div className="app-page-content space-y-6">
        {/* Period */}
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>{data?.period_label || ''}</span>
          <div className="flex gap-2">
            {[{ val: 'daily', label: 'Hoy' }, { val: 'weekly', label: 'Semana' }, { val: 'biweekly', label: '15 Días' }, { val: 'monthly', label: 'Mes' }].map(p => (
              <button key={p.val} onClick={() => setPeriod(p.val)} data-testid={`period-${p.val}`}
                className={`dash-country-btn ${period === p.val ? 'active' : ''}`}>{p.label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : data && (
          <>
            {/* Summary Cards */}
            <div className="dash-stats-grid">
              <div className="dash-stat-card">
                <DollarSign size={24} color="#22c55e" />
                <p className="dash-stat-label">Ventas</p>
                <p className="dash-stat-value">{fmt(summary.total_sales)}</p>
                <p className="dash-stat-sub">{counts.total || 0} boletos</p>
              </div>
              <div className={`dash-stat-card ${(summary.net_profit || 0) >= 0 ? 'dash-stat-profit' : 'dash-stat-loss'}`}>
                {(summary.net_profit || 0) >= 0 ? <TrendingUp size={24} color="#22c55e" /> : <TrendingDown size={24} color="#ef4444" />}
                <p className="dash-stat-label">Ganancia</p>
                <p className={`dash-stat-value ${(summary.net_profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmt(summary.net_profit)}
                </p>
              </div>
              <div className="dash-stat-card">
                <Ticket size={24} color="#a78bfa" />
                <p className="dash-stat-label">Comisión</p>
                <p className="dash-stat-value" style={{ color: '#a78bfa' }}>{fmt(summary.total_commission)}</p>
                <p className="dash-stat-sub">{summary.commission_rate}%</p>
              </div>
              <div className="dash-stat-card">
                <Calendar size={24} color="#f59e0b" />
                <p className="dash-stat-label">Ganadores</p>
                <p className="dash-stat-value" style={{ color: '#f59e0b' }}>{counts.won || 0}</p>
                <p className="dash-stat-sub">Premios: {fmt(summary.total_wins)}</p>
              </div>
            </div>

            {/* Ticket Status Breakdown */}
            <div className="card">
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>Estado de Boletos</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { key: 'pending', label: 'Pendientes', color: '#f59e0b' },
                  { key: 'won', label: 'Ganadores', color: '#22c55e' },
                  { key: 'paid', label: 'Pagados', color: '#3b82f6' },
                  { key: 'lost', label: 'Perdidos', color: '#64748b' },
                  { key: 'cancelled', label: 'Cancelados', color: '#ef4444' }
                ].map(s => (
                  <div key={s.key} style={{ background: s.color + '15', border: `1px solid ${s.color}30`, borderRadius: '8px', padding: '8px 14px', textAlign: 'center', flex: '1 1 80px' }}>
                    <p style={{ fontSize: '20px', fontWeight: 700, color: s.color }}>{counts[s.key] || 0}</p>
                    <p style={{ fontSize: '11px', color: '#94a3b8' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Chart */}
            {data.daily_breakdown?.length > 0 && (
              <div className="card" data-testid="daily-chart">
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
                  <BarChart3 size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} color="#8b5cf6" />
                  Ventas Diarias
                </h3>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '140px' }}>
                  {data.daily_breakdown.map((d, i) => {
                    const h = maxDailySales > 0 ? (d.sales / maxDailySales) * 120 : 0
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '9px', color: '#94a3b8' }}>{d.tickets}</span>
                        <div title={`${fmt(d.sales)}`}
                          style={{ width: '100%', maxWidth: '28px', background: d.sales > 0 ? '#8b5cf6' : '#334155', borderRadius: '3px 3px 0 0', height: `${Math.max(h, 2)}px`, transition: 'height 0.3s' }} />
                        <span style={{ fontSize: '9px', color: '#64748b' }}>{d.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Recent Tickets */}
            {data.tickets?.length > 0 && (
              <div className="card">
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>Últimos Boletos</h3>
                <div className="table-container">
                  <table>
                    <thead><tr><th>Ticket</th><th>Monto</th><th>Estado</th><th>Fecha</th></tr></thead>
                    <tbody>
                      {data.tickets.slice(0, 20).map((t, i) => (
                        <tr key={t.id || i}>
                          <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{t.ticket_number}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(t.amount || t.total_amount, t.currency)}</td>
                          <td><span className={`badge ${statusClass(t.status)}`}>{statusLabel(t.status)}</span></td>
                          <td style={{ fontSize: '11px', color: '#64748b' }}>
                            {t.created_at ? new Date(t.created_at).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
