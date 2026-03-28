import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { 
  Users, ChevronRight, Calendar, CheckCircle, Clock, ArrowLeft, 
  DollarSign, TrendingDown, TrendingUp, Receipt, Filter
} from 'lucide-react'

export default function CuadrePage() {
  const { apiFetch, user } = useAuth()
  const [view, setView] = useState('sellers') // sellers | cuadre | history
  const [sellers, setSellers] = useState([])
  const [totalBalance, setTotalBalance] = useState(0)
  const [selected, setSelected] = useState(null)
  const [cuadre, setCuadre] = useState(null)
  const [settlements, setSettlements] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showPay, setShowPay] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  const fmt = (amount, currency) => {
    const sym = currency || 'RD$'
    return `${sym} ${Math.abs(amount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
  const fmtDateTime = (d) => d ? new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'

  const fetchSellers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/settlements/all-balances')
      if (res.ok) {
        const data = await res.json()
        setSellers(data.sellers || [])
        setTotalBalance(data.total_balance || 0)
      }
    } catch {} finally { setLoading(false) }
  }, [])

  const fetchCuadre = useCallback(async (sellerId) => {
    setLoading(true)
    try {
      let url = `/api/settlements/cuadre/${sellerId}`
      const params = []
      if (startDate) params.push(`start_date=${startDate}T00:00:00`)
      if (endDate) params.push(`end_date=${endDate}T23:59:59`)
      if (params.length) url += '?' + params.join('&')
      const res = await apiFetch(url)
      if (res.ok) setCuadre(await res.json())
    } catch {} finally { setLoading(false) }
  }, [startDate, endDate])

  const fetchHistory = useCallback(async (sellerId) => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/settlements/history/${sellerId}`)
      if (res.ok) {
        const data = await res.json()
        setSettlements(data.settlements || [])
      }
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSellers() }, [fetchSellers])

  const selectSeller = (s) => {
    setSelected(s)
    setView('cuadre')
    fetchCuadre(s.seller_id)
  }

  const goBack = () => {
    setMessage(null)
    if (view === 'history') { setView('cuadre'); if (selected) fetchCuadre(selected.seller_id) }
    else if (view === 'cuadre') { setView('sellers'); setSelected(null); setCuadre(null); setStartDate(''); setEndDate(''); fetchSellers() }
  }

  const handleClose = async () => {
    if (!selected || !payAmount) return
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount < 0) return
    setSubmitting(true)
    try {
      const body = { seller_id: selected.seller_id, amount_paid: amount, notes: payNotes }
      if (startDate) body.start_date = `${startDate}T00:00:00`
      if (endDate) body.end_date = `${endDate}T23:59:59`
      const res = await apiFetch('/api/settlements/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) {
        const data = await res.json()
        setMessage({ type: 'success', text: `Cuadre cerrado. Balance: ${fmt(data.settlement.balance_after, cuadre?.currency)}` })
        setShowPay(false); setPayAmount(''); setPayNotes('')
        fetchCuadre(selected.seller_id); fetchSellers()
      } else {
        const err = await res.json()
        setMessage({ type: 'error', text: err.detail || 'Error al cerrar cuadre' })
      }
    } catch { setMessage({ type: 'error', text: 'Error de conexión' }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="app-page" data-testid="cuadre-page">
      <PageHeader title={
        view === 'sellers' ? 'Cuadre de Vendedores' :
        view === 'cuadre' ? `Cuadre - ${selected?.seller_name || ''}` :
        `Historial - ${selected?.seller_name || ''}`
      } />
      <div className="app-page-content space-y-4">
        {/* Back button */}
        {view !== 'sellers' && (
          <button onClick={goBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm" data-testid="cuadre-back-btn">
            <ArrowLeft size={16} /> Volver
          </button>
        )}

        {/* Message */}
        {message && (
          <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full" /></div>
        ) : (
          <>
            {/* ===== SELLERS LIST ===== */}
            {view === 'sellers' && (
              <>
                <div className="dash-stat-card text-center" data-testid="total-balance-card">
                  <p className="text-xs text-slate-400 mb-1">Balance Total Pendiente</p>
                  <p className={`text-2xl font-extrabold ${totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmt(totalBalance, user?.currency)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{sellers.length} vendedores</p>
                </div>

                <div className="space-y-2">
                  {sellers.map(s => (
                    <button key={s.seller_id} onClick={() => selectSeller(s)} data-testid={`seller-card-${s.seller_id}`}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-slate-600 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <Users size={16} className="text-blue-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-200">{s.seller_name}</p>
                          <p className="text-xs text-slate-500">Comisión: {s.commission_rate}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${s.balance > 0 ? 'text-green-400' : s.balance < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                          {s.balance < 0 ? '-' : ''}{fmt(s.balance, s.currency)}
                        </span>
                        <ChevronRight size={16} className="text-slate-500" />
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ===== CUADRE DETAIL ===== */}
            {view === 'cuadre' && cuadre && (
              <>
                {/* Date Filter */}
                <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-xs text-slate-400 block mb-1">Desde</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} data-testid="start-date-input"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-xs text-slate-400 block mb-1">Hasta</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} data-testid="end-date-input"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                  </div>
                  <button onClick={() => fetchCuadre(selected.seller_id)} data-testid="apply-date-filter"
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-500 transition-colors">
                    <Filter size={14} className="inline mr-1" /> Filtrar
                  </button>
                </div>

                {/* Breakdown Card */}
                <div className="p-5 rounded-xl bg-slate-800/60 border border-slate-700/50" data-testid="cuadre-breakdown">
                  <h3 className="text-lg font-bold text-white">{cuadre.seller_name}</h3>
                  <p className="text-xs text-slate-500 mb-4">{fmtDate(cuadre.period_start)} — {fmtDate(cuadre.period_end)}</p>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-300">Venta Total</span>
                      <span className="text-sm font-semibold text-white">{fmt(cuadre.total_sales, cuadre.currency)}</span>
                    </div>
                    <div className="border-t border-slate-700/50" />
                    <div className="flex justify-between items-center pl-3">
                      <span className="text-sm text-slate-400">Comisión ({cuadre.commission_rate}%)</span>
                      <span className="text-sm text-red-400">- {fmt(cuadre.total_commission, cuadre.currency)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-3">
                      <span className="text-sm text-slate-400">Premios Pagados</span>
                      <span className="text-sm text-red-400">- {fmt(cuadre.total_wins, cuadre.currency)}</span>
                    </div>
                    <div className="border-t border-slate-700/50" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-white">Ganancia Neta</span>
                      <span className={`text-base font-extrabold ${cuadre.net_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {cuadre.net_profit < 0 ? '- ' : ''}{fmt(cuadre.net_profit, cuadre.currency)}
                      </span>
                    </div>

                    {cuadre.running_balance !== 0 && (
                      <>
                        <div className="border-t border-slate-700/50" />
                        <div className="flex justify-between items-center pl-3">
                          <span className="text-sm text-slate-400">Balance Anterior</span>
                          <span className="text-sm text-slate-300">{fmt(cuadre.running_balance, cuadre.currency)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-white">Total a Cobrar</span>
                          <span className={`text-base font-extrabold ${cuadre.total_due >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {cuadre.total_due < 0 ? '- ' : ''}{fmt(cuadre.total_due, cuadre.currency)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex justify-center gap-8 mt-4 pt-3 border-t border-slate-700/50">
                    <div className="text-center">
                      <p className="text-xl font-extrabold text-white">{cuadre.tickets_sold}</p>
                      <p className="text-xs text-slate-500">Boletos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-extrabold text-amber-400">{cuadre.tickets_won}</p>
                      <p className="text-xs text-slate-500">Ganadores</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button onClick={() => { setPayAmount(''); setPayNotes(''); setShowPay(true) }} data-testid="close-cuadre-btn"
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-slate-900 font-bold rounded-xl hover:bg-green-500 transition-colors">
                    <CheckCircle size={18} /> Cerrar Cuadre
                  </button>
                  <button onClick={() => { setView('history'); fetchHistory(selected.seller_id) }} data-testid="view-history-btn"
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800 text-slate-300 font-semibold rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
                    <Clock size={18} /> Historial
                  </button>
                </div>

                {/* Winning Tickets */}
                {cuadre.winning_tickets?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-amber-400 mb-2">Tickets Ganadores ({cuadre.tickets_won})</h4>
                    <div className="space-y-1">
                      {cuadre.winning_tickets.map((t, i) => (
                        <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-slate-800/60 border border-slate-700/50">
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{t.ticket_number}</p>
                            <p className="text-xs text-slate-500">{fmtDate(t.created_at)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-amber-400">{fmt(t.prize, cuadre.currency)}</p>
                            {t.won_position && <p className="text-xs text-slate-500">{t.won_position}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ===== HISTORY ===== */}
            {view === 'history' && (
              settlements.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt size={40} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Sin cuadres registrados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {settlements.map(st => (
                    <div key={st.id} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50" data-testid={`settlement-${st.id}`}>
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-sm font-semibold text-slate-200">{fmtDateTime(st.created_at)}</p>
                        <p className="text-xs text-slate-500">por {st.closed_by_name}</p>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-slate-400">Ventas</span><span className="text-slate-200">{fmt(st.total_sales, st.currency)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Comisión</span><span className="text-red-400">- {fmt(st.total_commission, st.currency)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Premios</span><span className="text-red-400">- {fmt(st.total_wins, st.currency)}</span></div>
                        <div className="border-t border-slate-700/50 my-1" />
                        <div className="flex justify-between font-bold"><span className="text-white">Debido</span><span className="text-white">{fmt(st.amount_due, st.currency)}</span></div>
                        <div className="flex justify-between font-bold"><span className="text-white">Pagado</span><span className="text-green-400">{fmt(st.amount_paid, st.currency)}</span></div>
                        <div className="flex justify-between font-bold">
                          <span className="text-white">Balance</span>
                          <span className={st.balance_after > 0 ? 'text-green-400' : st.balance_after < 0 ? 'text-red-400' : 'text-slate-400'}>
                            {st.balance_after < 0 ? '- ' : ''}{fmt(st.balance_after, st.currency)}
                          </span>
                        </div>
                      </div>
                      {st.notes && <p className="text-xs text-slate-500 italic mt-2">{st.notes}</p>}
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}

        {/* Payment Modal */}
        {showPay && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => setShowPay(false)}>
            <div className="w-full max-w-md bg-slate-800 rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white mb-1">Cerrar Cuadre</h3>
              {cuadre && <p className="text-sm text-slate-400 mb-4">Total debido: {fmt(cuadre.total_due, cuadre.currency)}</p>}
              <label className="text-xs font-semibold text-slate-400 block mb-1">Monto Pagado</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" data-testid="pay-amount-input"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white text-base mb-3 outline-none focus:border-green-500" />
              <label className="text-xs font-semibold text-slate-400 block mb-1">Notas (opcional)</label>
              <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Ej: Pago en efectivo" data-testid="pay-notes-input"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm mb-4 outline-none focus:border-green-500" />
              <div className="flex gap-3">
                <button onClick={() => setShowPay(false)} data-testid="cancel-payment-btn"
                  className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-400 font-semibold hover:border-slate-500">Cancelar</button>
                <button onClick={handleClose} disabled={submitting} data-testid="confirm-payment-btn"
                  className="flex-1 py-3 rounded-xl bg-green-600 text-slate-900 font-bold hover:bg-green-500 disabled:opacity-50">
                  {submitting ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
