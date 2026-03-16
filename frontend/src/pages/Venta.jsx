import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { ShoppingCart, Plus, Trash2, Send } from 'lucide-react'

export default function Venta() {
  const { apiFetch } = useAuth()
  const [lotteries, setLotteries] = useState([])
  const [selectedLotteries, setSelectedLotteries] = useState([])
  const [plays, setPlays] = useState([{ number: '', game_type: 'quiniela', amount: '' }])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadLotteries() }, [])

  const loadLotteries = async () => {
    try {
      const res = await apiFetch('/api/lotteries')
      if (res.ok) {
        const data = await res.json()
        const active = (data.lotteries || data || []).filter(l => l.active !== false)
        setLotteries(active)
      }
    } catch {} finally { setLoading(false) }
  }

  const toggleLottery = (id) => {
    setSelectedLotteries(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const addPlay = () => setPlays([...plays, { number: '', game_type: 'quiniela', amount: '' }])
  const removePlay = (i) => setPlays(plays.filter((_, j) => j !== i))
  const updatePlay = (i, field, value) => {
    const updated = [...plays]
    updated[i][field] = value
    setPlays(updated)
  }

  const total = plays.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) * selectedLotteries.length

  const handleSubmit = async () => {
    if (!selectedLotteries.length) return alert('Selecciona al menos una loteria')
    if (!plays.some(p => p.number && p.amount)) return alert('Agrega al menos una jugada')
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({ lottery_ids: selectedLotteries, plays: plays.filter(p => p.number && p.amount).map(p => ({ ...p, amount: parseFloat(p.amount) })) })
      })
      if (res.ok) {
        alert('Ticket creado exitosamente!')
        setPlays([{ number: '', game_type: 'quiniela', amount: '' }])
        setSelectedLotteries([])
      } else {
        const err = await res.json()
        alert(err.detail || 'Error al crear ticket')
      }
    } catch { alert('Error de conexion') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="spinner" /></div>

  return (
    <div className="animate-in space-y-6" data-testid="venta-page">
      <h1 className="text-2xl font-bold">Nueva Venta</h1>

      {/* Lottery Selection */}
      <div className="card">
        <h3 className="font-semibold mb-3">Seleccionar Loterias</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {lotteries.map((l, i) => {
            const id = l.id || l._id
            const selected = selectedLotteries.includes(id)
            return (
              <button key={i} onClick={() => toggleLottery(id)}
                className={`p-3 rounded-lg text-sm font-medium text-left transition-all border ${selected ? 'bg-[--color-accent]/10 border-[--color-accent] text-[--color-accent]' : 'bg-[--color-surface] border-[--color-surface-lighter] hover:border-slate-500'}`}
                data-testid={`lottery-select-${i}`}>
                {l.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Plays */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Jugadas</h3>
          <button onClick={addPlay} className="btn-secondary text-sm" data-testid="add-play-button"><Plus size={16} /> Agregar</button>
        </div>
        <div className="space-y-3">
          {plays.map((p, i) => (
            <div key={i} className="flex gap-3 items-end" data-testid={`play-row-${i}`}>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Numero</label>
                <input value={p.number} onChange={e => updatePlay(i, 'number', e.target.value)} placeholder="00" className="w-full" data-testid={`play-number-${i}`} />
              </div>
              <div className="w-32">
                <label className="block text-xs text-slate-500 mb-1">Tipo</label>
                <select value={p.game_type} onChange={e => updatePlay(i, 'game_type', e.target.value)} className="w-full">
                  <option value="quiniela">Quiniela</option>
                  <option value="pale">Pale</option>
                  <option value="tripleta">Tripleta</option>
                </select>
              </div>
              <div className="w-28">
                <label className="block text-xs text-slate-500 mb-1">Monto</label>
                <input type="number" value={p.amount} onChange={e => updatePlay(i, 'amount', e.target.value)} placeholder="0" className="w-full" data-testid={`play-amount-${i}`} />
              </div>
              {plays.length > 1 && (
                <button onClick={() => removePlay(i)} className="text-red-400 hover:text-red-300 pb-2"><Trash2 size={18} /></button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="card flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Total ({selectedLotteries.length} loterias x {plays.filter(p => p.amount).length} jugadas)</p>
          <p className="text-2xl font-bold text-[--color-accent]">${total.toLocaleString()}</p>
        </div>
        <button onClick={handleSubmit} disabled={submitting || !total} className="btn-primary" data-testid="submit-ticket-button">
          {submitting ? <div className="spinner !w-5 !h-5" /> : <><Send size={18} /> Vender</>}
        </button>
      </div>
    </div>
  )
}
