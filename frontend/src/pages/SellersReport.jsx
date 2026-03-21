import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { Users, DollarSign, TrendingUp, Award, ArrowUpDown } from 'lucide-react'

export default function SellersReport() {
  const { apiFetch, user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState(null)
  const [sortBy, setSortBy] = useState('total_sales')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/accounting/sellers-report'
      if (country) url += `?country=${country}`
      const res = await apiFetch(url)
      if (res.ok) setData(await res.json())
    } catch {} finally { setLoading(false) }
  }, [country])

  useEffect(() => { loadData() }, [loadData])

  const fmt = (amount, currency) => {
    const sym = currency || 'RD$'
    return `${sym} ${(amount || 0).toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  const sorted = (data?.sellers || []).slice().sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0))

  return (
    <div className="app-page" data-testid="sellers-report-page">
      <PageHeader title="Reporte Vendedores" />
      <div className="app-page-content space-y-6">
        {/* Filters */}
        {user?.role === 'super_admin' && (
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Filtrar por país:</span>
            <div className="flex gap-2">
              {[{ val: null, label: 'Todos' }, { val: 'RD', label: 'RD' }, { val: 'US', label: 'USA' }].map(c => (
                <button key={c.label} onClick={() => setCountry(c.val)} data-testid={`country-${c.label}`}
                  className={`dash-country-btn ${country === c.val ? 'active' : ''}`}>{c.label}</button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : (
          <>
            {/* Totals */}
            {data?.totals && (
              <div className="dash-stats-grid">
                <div className="dash-stat-card">
                  <DollarSign size={24} color="#22c55e" />
                  <p className="dash-stat-label">Total Ventas</p>
                  <p className="dash-stat-value">${(data.totals.total_sales || 0).toLocaleString()}</p>
                </div>
                <div className="dash-stat-card">
                  <Award size={24} color="#f59e0b" />
                  <p className="dash-stat-label">Total Premios</p>
                  <p className="dash-stat-value">${(data.totals.total_wins || 0).toLocaleString()}</p>
                </div>
                <div className="dash-stat-card">
                  <TrendingUp size={24} color="#8b5cf6" />
                  <p className="dash-stat-label">Ganancia Neta</p>
                  <p className="dash-stat-value">${(data.totals.net_profit || 0).toLocaleString()}</p>
                </div>
                <div className="dash-stat-card">
                  <Users size={24} color="#3b82f6" />
                  <p className="dash-stat-label">Vendedores</p>
                  <p className="dash-stat-value">{sorted.length}</p>
                </div>
              </div>
            )}

            {/* Sellers Table */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>Rendimiento de Vendedores</h3>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 'auto', height: '36px', fontSize: '13px' }}
                  data-testid="sort-select">
                  <option value="total_sales">Por Ventas</option>
                  <option value="tickets_sold">Por Boletos</option>
                  <option value="net_profit">Por Ganancia</option>
                  <option value="total_commission">Por Comisión</option>
                </select>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Vendedor</th>
                      <th>País</th>
                      <th>Ventas</th>
                      <th>Boletos</th>
                      <th>Premios</th>
                      <th>Comisión</th>
                      <th>Ganancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Sin vendedores</td></tr>
                    ) : sorted.map((s, i) => (
                      <tr key={s.seller_id} data-testid={`seller-row-${i}`}>
                        <td style={{ fontWeight: 700, color: '#8b5cf6' }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{s.seller_name}</td>
                        <td>
                          <span className={`badge ${s.seller_country === 'US' ? 'badge-warning' : 'badge-success'}`}>
                            {s.seller_country === 'US' ? 'USA' : 'RD'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{fmt(s.total_sales, s.currency)}</td>
                        <td>{s.tickets_sold}</td>
                        <td style={{ color: '#f59e0b' }}>{fmt(s.total_wins, s.currency)}</td>
                        <td style={{ color: '#a78bfa' }}>{fmt(s.total_commission, s.currency)}</td>
                        <td style={{ fontWeight: 600, color: (s.net_profit || 0) >= 0 ? '#34d399' : '#f87171' }}>
                          {fmt(s.net_profit, s.currency)}
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
