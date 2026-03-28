import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { 
  Users, ChevronRight, Calendar as CalendarIcon, CheckCircle, Clock, ArrowLeft, 
  DollarSign, TrendingDown, TrendingUp, Receipt, Filter, X, ChevronLeft
} from 'lucide-react'

// Simple Calendar Component
function SimpleCalendar({ selected, onSelect, onClose }) {
  const [currentDate, setCurrentDate] = useState(selected || new Date())
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)
  
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  
  const selectDay = (day) => {
    if (day) {
      onSelect(new Date(year, month, day))
      onClose()
    }
  }
  
  const isSelected = (day) => {
    if (!selected || !day) return false
    return selected.getFullYear() === year && selected.getMonth() === month && selected.getDate() === day
  }
  
  const isToday = (day) => {
    if (!day) return false
    const today = new Date()
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 hover:bg-slate-700 rounded">
          <ChevronLeft size={18} className="text-slate-400" />
        </button>
        <span className="text-sm font-semibold text-white">{monthNames[month]} {year}</span>
        <button onClick={nextMonth} className="p-1 hover:bg-slate-700 rounded">
          <ChevronRight size={18} className="text-slate-400" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-1">
        {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => (
          <button
            key={i}
            onClick={() => selectDay(day)}
            disabled={!day}
            className={`w-8 h-8 text-sm rounded-lg transition-colors ${
              !day ? '' :
              isSelected(day) ? 'bg-green-500 text-white font-bold' :
              isToday(day) ? 'bg-blue-500/30 text-blue-400' :
              'hover:bg-slate-700 text-slate-300'
            }`}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  )
}

// Date Picker Button
function DatePicker({ value, onChange, placeholder }) {
  const [showCalendar, setShowCalendar] = useState(false)
  const ref = useRef(null)
  
  const formatDate = (date) => {
    if (!date) return ''
    return date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setShowCalendar(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setShowCalendar(!showCalendar)}
        className="w-full flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white hover:bg-slate-800 transition-colors"
      >
        <CalendarIcon size={16} className="text-slate-400" />
        <span className={value ? 'text-white' : 'text-slate-500'}>
          {value ? formatDate(value) : placeholder || 'Seleccionar'}
        </span>
      </button>
      {showCalendar && (
        <div className="absolute z-50 mt-1 left-0">
          <SimpleCalendar
            selected={value}
            onSelect={onChange}
            onClose={() => setShowCalendar(false)}
          />
        </div>
      )}
    </div>
  )
}

export default function CuadrePage() {
  const { apiFetch, user } = useAuth()
  const [view, setView] = useState('sellers') // sellers | cuadre | history
  const [sellers, setSellers] = useState([])
  const [totalBalance, setTotalBalance] = useState(0)
  const [selected, setSelected] = useState(null)
  const [cuadre, setCuadre] = useState(null)
  const [settlements, setSettlements] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
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
  
  const formatDateForApi = (date) => {
    if (!date) return null
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

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
      if (startDate) params.push(`start_date=${formatDateForApi(startDate)}T00:00:00`)
      if (endDate) params.push(`end_date=${formatDateForApi(endDate)}T23:59:59`)
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
    else if (view === 'cuadre') { setView('sellers'); setSelected(null); setCuadre(null); setStartDate(null); setEndDate(null); fetchSellers() }
  }

  const handleClose = async () => {
    if (!selected || !payAmount) return
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount < 0) return
    setSubmitting(true)
    try {
      const body = { seller_id: selected.seller_id, amount_paid: amount, notes: payNotes }
      if (startDate) body.start_date = `${formatDateForApi(startDate)}T00:00:00`
      if (endDate) body.end_date = `${formatDateForApi(endDate)}T23:59:59`
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

  const clearDateFilter = () => {
    setStartDate(null)
    setEndDate(null)
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
                {/* Date Filter with Calendar */}
                <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs text-slate-400 block mb-1">Desde</label>
                    <DatePicker
                      value={startDate}
                      onChange={setStartDate}
                      placeholder="Seleccionar fecha"
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs text-slate-400 block mb-1">Hasta</label>
                    <DatePicker
                      value={endDate}
                      onChange={setEndDate}
                      placeholder="Seleccionar fecha"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => fetchCuadre(selected.seller_id)} data-testid="apply-date-filter"
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-1">
                      <Filter size={14} /> Filtrar
                    </button>
                    {(startDate || endDate) && (
                      <button onClick={clearDateFilter} data-testid="clear-date-filter"
                        className="px-3 py-2 bg-slate-700 text-slate-300 text-sm rounded-lg hover:bg-slate-600 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
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
