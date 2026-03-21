import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { DollarSign, TrendingUp, TrendingDown, Ticket, Receipt, ArrowDownUp } from 'lucide-react'

export default function AccountingPage() {
  const { apiFetch, user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [country, setCountry] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      let url = `/api/accounting/report?period=${period}`
      if (country) url += `&country=${country}`
      const res = await apiFetch(url)
      if (res.ok) setData(await res.json())
    } catch {} finally { setLoading(false) }
  }, [period, country])

  useEffect(() => { loadData() }, [loadData])

  const fmt = (amount, currency) => {
    const sym = currency || data?.currency || 'RD$'
    return `${sym} ${(amount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
  }

  const txTypeLabel = (t) => {
    const map = { sale: 'Venta', commission: 'Comisión', cancellation: 'Cancelación', payment: 'Pago Premio', deposit: 'Depósito', withdrawal: 'Retiro' }
    return map[t] || t
  }
  const txTypeColor = (t) => {
    const map = { sale: '#22c55e', commission: '#a78bfa', cancellation: '#ef4444', payment: '#f59e0b' }
    return map[t] || '#94a3b8'
  }

  return (
    <div className="app-page" data-testid="accounting-page">
      <PageHeader title="Contabilidad" />
      <div className="app-page-content space-y-6">
        {/* Filters */}
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div className="flex gap-2">
            {[{ val: 'day', label: 'Hoy' }, { val: 'week', label: 'Semana' }, { val: 'month', label: 'Mes' }].map(p => (
              <button key={p.val} onClick={() => setPeriod(p.val)} data-testid={`period-${p.val}`}
                className={`dash-country-btn ${period === p.val ? 'active' : ''}`}>{p.label}</button>
            ))}
          </div>
          {user?.role === 'super_admin' && (
            <div className="flex gap-2">
              {[{ val: null, label: 'Todos' }, { val: 'RD', label: 'RD' }, { val: 'US', label: 'USA' }].map(c => (
                <button key={c.label} onClick={() => setCountry(c.val)}
                  className={`dash-country-btn ${country === c.val ? 'active' : ''}`}>{c.label}</button>
              ))}
            </div>
          )}
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
                <p className="dash-stat-value">{fmt(data.total_sales)}</p>
                <p className="dash-stat-sub">{data.tickets_sold} boletos</p>
              </div>
              <div className="dash-stat-card">
                <Receipt size={24} color="#f59e0b" />
                <p className="dash-stat-label">Premios</p>
                <p className="dash-stat-value">{fmt(data.total_wins)}</p>
                <p className="dash-stat-sub">{data.tickets_won} ganadores</p>
              </div>
              <div className="dash-stat-card">
                <Ticket size={24} color="#a78bfa" />
                <p className="dash-stat-label">Comisiones</p>
                <p className="dash-stat-value">{fmt(data.total_commission)}</p>
              </div>
              <div className={`dash-stat-card ${(data.net_profit || 0) >= 0 ? 'dash-stat-profit' : 'dash-stat-loss'}`}>
                {(data.net_profit || 0) >= 0 ? <TrendingUp size={24} color="#22c55e" /> : <TrendingDown size={24} color="#ef4444" />}
                <p className="dash-stat-label">Ganancia Neta</p>
                <p className={`dash-stat-value ${(data.net_profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmt(data.net_profit)}
                </p>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="card">
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>
                <ArrowDownUp size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} color="#8b5cf6" />
                Últimas Transacciones
              </h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Usuario</th>
                      <th>Monto</th>
                      <th>Descripción</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.transactions || []).length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Sin transacciones</td></tr>
                    ) : (data.transactions || []).map((tx, i) => (
                      <tr key={tx.id || i}>
                        <td>
                          <span style={{ background: txTypeColor(tx.transaction_type) + '20', color: txTypeColor(tx.transaction_type), padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                            {txTypeLabel(tx.transaction_type)}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px' }}>{tx.user_name}</td>
                        <td style={{ fontWeight: 600, color: tx.amount >= 0 ? '#34d399' : '#f87171' }}>
                          {fmt(tx.amount, tx.currency)}
                        </td>
                        <td style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '200px' }} className="truncate">{tx.description}</td>
                        <td style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {tx.created_at ? new Date(tx.created_at).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
