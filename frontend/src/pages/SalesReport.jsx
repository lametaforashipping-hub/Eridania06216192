import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { TrendingUp, TrendingDown, DollarSign, Users, Ticket, BarChart3, Globe } from 'lucide-react'

export default function SalesReport() {
  const { apiFetch, user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/accounting/country-comparison?period=${period}`)
      if (res.ok) setData(await res.json())
    } catch {} finally { setLoading(false) }
  }, [period])

  useEffect(() => { loadData() }, [loadData])

  const fmt = (amount, currency) => {
    const sym = currency || 'RD$'
    return `${sym} ${(amount || 0).toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  const rd = data?.countries?.RD
  const us = data?.countries?.US

  const maxDailySales = Math.max(
    ...(rd?.daily?.map(d => d.sales) || [0]),
    ...(us?.daily?.map(d => d.sales) || [0]),
    1
  )

  return (
    <div className="app-page" data-testid="sales-report-page">
      <PageHeader title="Reporte de Ventas por País" />
      <div className="app-page-content space-y-6">
        {/* Period Filter */}
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div className="flex items-center gap-2">
            <Globe size={18} color="#8b5cf6" />
            <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>Comparación RD vs USA</span>
          </div>
          <div className="flex gap-2">
            {[{ val: 'day', label: 'Hoy' }, { val: 'week', label: 'Semana' }, { val: 'month', label: 'Mes' }].map(p => (
              <button key={p.val} onClick={() => setPeriod(p.val)} data-testid={`period-${p.val}`}
                className={`dash-country-btn ${period === p.val ? 'active' : ''}`}>{p.label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : data && (
          <>
            {/* Country Cards Side by Side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { d: rd, code: 'RD', flag: 'RD', accent: '#22c55e', label: 'Rep. Dominicana' },
                { d: us, code: 'US', flag: 'USA', accent: '#3b82f6', label: 'Estados Unidos' }
              ].map(({ d: c, code, flag, accent, label }) => (
                <div key={code} className="card" data-testid={`country-card-${code}`}
                  style={{ borderTop: `3px solid ${accent}`, padding: '16px' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ background: accent + '20', color: accent, padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>{flag}</span>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{label}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: '10px', padding: '12px' }}>
                      <div className="flex items-center gap-2">
                        <DollarSign size={14} color={accent} />
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Ventas</span>
                      </div>
                      <p style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{fmt(c?.total_sales, c?.currency)}</p>
                    </div>
                    <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: '10px', padding: '12px' }}>
                      <div className="flex items-center gap-2">
                        {(c?.net_profit || 0) >= 0 ? <TrendingUp size={14} color="#22c55e" /> : <TrendingDown size={14} color="#ef4444" />}
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Ganancia</span>
                      </div>
                      <p style={{ fontSize: '18px', fontWeight: 700, color: (c?.net_profit || 0) >= 0 ? '#34d399' : '#f87171', marginTop: '4px' }}>
                        {fmt(c?.net_profit, c?.currency)}
                      </p>
                    </div>
                    <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: '10px', padding: '12px' }}>
                      <div className="flex items-center gap-2">
                        <Ticket size={14} color="#f59e0b" />
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Boletos</span>
                      </div>
                      <p style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{c?.total_tickets || 0}</p>
                    </div>
                    <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: '10px', padding: '12px' }}>
                      <div className="flex items-center gap-2">
                        <Users size={14} color="#a78bfa" />
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Vendedores</span>
                      </div>
                      <p style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{c?.active_sellers || 0}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Daily Sales Chart */}
            <div className="card" data-testid="daily-chart">
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>
                <BarChart3 size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} color="#8b5cf6" />
                Ventas Diarias
              </h3>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '180px', padding: '0 4px' }}>
                {(rd?.daily || []).map((day, i) => {
                  const rdH = maxDailySales > 0 ? (day.sales / maxDailySales) * 150 : 0
                  const usDay = us?.daily?.[i]
                  const usH = usDay && maxDailySales > 0 ? (usDay.sales / maxDailySales) * 150 : 0
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '155px' }}>
                        <div title={`RD: ${fmt(day.sales, 'RD$')}`}
                          style={{ width: '14px', background: '#22c55e', borderRadius: '3px 3px 0 0', height: `${Math.max(rdH, 2)}px`, transition: 'height 0.3s' }} />
                        <div title={`US: ${fmt(usDay?.sales, 'US$')}`}
                          style={{ width: '14px', background: '#3b82f6', borderRadius: '3px 3px 0 0', height: `${Math.max(usH, 2)}px`, transition: 'height 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap' }}>{day.date}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-center gap-4" style={{ marginTop: '12px' }}>
                <div className="flex items-center gap-2">
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#22c55e' }} />
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>RD</span>
                </div>
                <div className="flex items-center gap-2">
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3b82f6' }} />
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>USA</span>
                </div>
              </div>
            </div>

            {/* Top Lotteries per Country */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { d: rd, label: 'Top Loterías RD', accent: '#22c55e' },
                { d: us, label: 'Top Loterías USA', accent: '#3b82f6' }
              ].map(({ d: c, label, accent }) => (
                <div key={label} className="card">
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>{label}</h3>
                  {c?.top_lotteries?.length > 0 ? (
                    <div className="space-y-3">
                      {c.top_lotteries.map((l, i) => {
                        const maxLottery = c.top_lotteries[0]?.total || 1
                        return (
                          <div key={i}>
                            <div className="flex justify-between" style={{ marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{l.name}</span>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{fmt(l.total, c.currency)}</span>
                            </div>
                            <div style={{ height: '6px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: accent, borderRadius: '999px', width: `${(l.total / maxLottery) * 100}%`, transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '20px 0' }}>Sin datos</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
