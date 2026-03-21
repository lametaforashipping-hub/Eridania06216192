import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { Receipt, DollarSign, Percent, Users } from 'lucide-react'

export default function CommissionReport() {
  const { apiFetch, user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('day')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/accounting/commissions?period=${period}`)
      if (res.ok) setData(await res.json())
    } catch {} finally { setLoading(false) }
  }, [period])

  useEffect(() => { loadData() }, [loadData])

  const fmt = (amount, currency) => {
    const sym = currency || data?.summary?.currency || 'RD$'
    return `${sym} ${(amount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
  }

  const summary = data?.summary || {}

  return (
    <div className="app-page" data-testid="commission-report-page">
      <PageHeader title="Comisiones" />
      <div className="app-page-content space-y-6">
        {/* Period Filter */}
        <div style={{ textAlign: 'right' }}>
          <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
            {[{ val: 'day', label: 'Hoy' }, { val: 'week', label: 'Semana' }, { val: 'month', label: 'Mes' }].map(p => (
              <button key={p.val} onClick={() => setPeriod(p.val)} data-testid={`period-${p.val}`}
                className={`dash-country-btn ${period === p.val ? 'active' : ''}`}>{p.label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : (
          <>
            {/* Summary */}
            <div className="dash-stats-grid">
              <div className="dash-stat-card">
                <DollarSign size={24} color="#22c55e" />
                <p className="dash-stat-label">Total Ventas</p>
                <p className="dash-stat-value">{fmt(summary.total_sales)}</p>
              </div>
              <div className="dash-stat-card">
                <Receipt size={24} color="#a78bfa" />
                <p className="dash-stat-label">Comisión Ganada</p>
                <p className="dash-stat-value" style={{ color: '#a78bfa' }}>{fmt(summary.total_commission)}</p>
              </div>
              <div className="dash-stat-card">
                <Percent size={24} color="#f59e0b" />
                <p className="dash-stat-label">Tasa Comisión</p>
                <p className="dash-stat-value">{summary.commission_rate || 10}%</p>
              </div>
              <div className="dash-stat-card">
                <Receipt size={24} color="#3b82f6" />
                <p className="dash-stat-label">Boletos</p>
                <p className="dash-stat-value">{summary.ticket_count || 0}</p>
              </div>
            </div>

            {/* Seller Breakdown (super admin only) */}
            {data?.seller_breakdown?.length > 0 && (
              <div className="card">
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>
                  <Users size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} color="#8b5cf6" />
                  Comisiones por Vendedor
                </h3>
                <div className="table-container">
                  <table>
                    <thead><tr><th>Vendedor</th><th>Ventas</th><th>Comisión</th><th>Boletos</th><th>Tasa</th></tr></thead>
                    <tbody>
                      {data.seller_breakdown.map((s, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{s.seller_name}</td>
                          <td>{fmt(s.total_sales)}</td>
                          <td style={{ color: '#a78bfa', fontWeight: 600 }}>{fmt(s.total_commission)}</td>
                          <td>{s.ticket_count}</td>
                          <td>{s.commission_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Details */}
            {data?.details?.length > 0 && (
              <div className="card">
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>Detalle de Comisiones</h3>
                <div className="table-container">
                  <table>
                    <thead><tr><th>Ticket</th><th>Lotería</th><th>Venta</th><th>Comisión</th><th>Fecha</th></tr></thead>
                    <tbody>
                      {data.details.map((d, i) => (
                        <tr key={d.id || i}>
                          <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{d.ticket_number}</td>
                          <td style={{ fontSize: '13px' }}>{d.lottery_name}</td>
                          <td>{fmt(d.sale_amount, d.currency)}</td>
                          <td style={{ color: '#a78bfa', fontWeight: 600 }}>{fmt(d.commission_earned, d.currency)}</td>
                          <td style={{ fontSize: '12px', color: '#64748b' }}>
                            {d.created_at ? new Date(d.created_at).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
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
