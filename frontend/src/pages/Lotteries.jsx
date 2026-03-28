import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Clock, Settings, Check, X, ChevronDown, ChevronUp, Save } from 'lucide-react'
import PageHeader from '../components/PageHeader'

// Convert 24h to 12h format
const to12Hour = (time24) => {
  if (!time24) return { hour: '12', minute: '00', period: 'PM' }
  const [h, m] = time24.split(':')
  const hour = parseInt(h, 10)
  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return { hour: String(hour12).padStart(2, '0'), minute: m || '00', period }
}

// Convert 12h to 24h format
const to24Hour = (hour, minute, period) => {
  let h = parseInt(hour, 10)
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${minute}`
}

// Format display time
const formatDisplayTime = (time24) => {
  if (!time24) return ''
  const { hour, minute, period } = to12Hour(time24)
  return `${parseInt(hour)}:${minute} ${period}`
}

// Play types available
const PLAY_TYPES = [
  { id: 'quiniela', name: 'Quiniela', multiplier: 70 },
  { id: 'pale', name: 'Palé', multiplier: 1500 },
  { id: 'tripleta', name: 'Tripleta', multiplier: 10000 },
  { id: 'super_pale', name: 'Super Palé', multiplier: 5000 },
]

// Time Picker Component
function TimePicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { hour, minute, period } = to12Hour(value)
  const [localHour, setLocalHour] = useState(hour)
  const [localMinute, setLocalMinute] = useState(minute)
  const [localPeriod, setLocalPeriod] = useState(period)

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

  useEffect(() => {
    const { hour, minute, period } = to12Hour(value)
    setLocalHour(hour)
    setLocalMinute(minute)
    setLocalPeriod(period)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (h, m, p) => {
    setLocalHour(h)
    setLocalMinute(m)
    setLocalPeriod(p)
    onChange(to24Hour(h, m, p))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white hover:bg-slate-800"
      >
        <Clock size={14} className="text-slate-400" />
        {formatDisplayTime(value)}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-slate-400 mb-2">{label}</p>
          <div className="flex items-center gap-2">
            <select 
              value={localHour} 
              onChange={(e) => handleChange(e.target.value, localMinute, localPeriod)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-center text-sm"
            >
              {hours.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <span className="text-white">:</span>
            <select 
              value={localMinute} 
              onChange={(e) => handleChange(localHour, e.target.value, localPeriod)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-center text-sm"
            >
              {minutes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select 
              value={localPeriod} 
              onChange={(e) => handleChange(localHour, localMinute, e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
          <button 
            onClick={() => setOpen(false)} 
            className="w-full mt-2 py-1 bg-blue-600 text-white text-xs rounded-lg"
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}

// Play Type Selector Component
function PlayTypeSelector({ selected, onChange }) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-slate-400 block">Tipos de Juego</label>
      <div className="grid grid-cols-2 gap-2">
        {PLAY_TYPES.map(type => {
          const isSelected = selected.includes(type.id)
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => {
                if (isSelected) {
                  onChange(selected.filter(t => t !== type.id))
                } else {
                  onChange([...selected, type.id])
                }
              }}
              className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                isSelected 
                  ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center ${
                isSelected ? 'bg-green-500' : 'bg-slate-700'
              }`}>
                {isSelected && <Check size={14} className="text-white" />}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">{type.name}</p>
                <p className="text-xs opacity-70">x{type.multiplier}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Lotteries() {
  const { apiFetch, user } = useAuth()
  const [lotteries, setLotteries] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    schedule: '12:00',
    closing_time: '11:50',
    play_types: ['quiniela', 'pale'],
    country: 'RD',
    currency: 'RD$',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => { loadLotteries() }, [])

  const loadLotteries = async () => {
    try {
      const res = await apiFetch('/api/lotteries?active_only=false')
      if (res.ok) { 
        const data = await res.json()
        setLotteries(data.lotteries || data || []) 
      }
    } catch {} finally { setLoading(false) }
  }

  const toggleStatus = async (lottery) => {
    const id = lottery.id || lottery._id
    await apiFetch(`/api/lotteries/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify({ active: lottery.active === false ? true : false }) 
    })
    loadLotteries()
  }

  const startEdit = (lottery) => {
    setEditingId(lottery.id || lottery._id)
    const schedule = lottery.schedule?.[0] || '12:00'
    setEditForm({
      schedule,
      closing_time: lottery.closing_time || '11:50',
      display_time: lottery.display_time || formatDisplayTime(schedule),
      play_types: Object.keys(lottery.play_types || { quiniela: {}, pale: {} }),
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async (lottery) => {
    setSaving(true)
    try {
      const id = lottery.id || lottery._id
      const updateData = {
        schedule: [editForm.schedule],
        closing_time: editForm.closing_time,
        display_time: formatDisplayTime(editForm.schedule),
        display_closing: formatDisplayTime(editForm.closing_time),
      }
      
      // Build play_types object
      const playTypes = {}
      editForm.play_types.forEach(type => {
        const typeInfo = PLAY_TYPES.find(t => t.id === type)
        playTypes[type] = {
          multiplier: typeInfo?.multiplier || 70,
          numbers_required: type === 'quiniela' ? 1 : type === 'pale' || type === 'super_pale' ? 2 : 3,
          enabled: true
        }
      })
      updateData.play_types = playTypes

      const res = await apiFetch(`/api/lotteries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })
      
      if (res.ok) {
        setMessage({ type: 'success', text: 'Lotería actualizada' })
        setEditingId(null)
        loadLotteries()
      } else {
        const err = await res.json()
        setMessage({ type: 'error', text: err.detail || 'Error al actualizar' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const createLottery = async () => {
    if (!createForm.name.trim()) {
      setMessage({ type: 'error', text: 'Ingrese el nombre de la lotería' })
      return
    }
    if (createForm.play_types.length === 0) {
      setMessage({ type: 'error', text: 'Seleccione al menos un tipo de juego' })
      return
    }

    setSaving(true)
    try {
      // Build play_types object
      const playTypes = {}
      createForm.play_types.forEach(type => {
        const typeInfo = PLAY_TYPES.find(t => t.id === type)
        playTypes[type] = {
          multiplier: typeInfo?.multiplier || 70,
          numbers_required: type === 'quiniela' ? 1 : type === 'pale' || type === 'super_pale' ? 2 : 3,
          enabled: true
        }
      })

      const newLottery = {
        name: createForm.name,
        schedule: [createForm.schedule],
        closing_time: createForm.closing_time,
        opening_time: '07:00',
        display_time: formatDisplayTime(createForm.schedule),
        display_closing: formatDisplayTime(createForm.closing_time),
        display_opening: '7:00 AM',
        country: createForm.country,
        currency: createForm.currency,
        play_types: playTypes,
        min_number: 0,
        max_number: 99,
        price: 20,
        active: true,
      }

      const res = await apiFetch('/api/lotteries', {
        method: 'POST',
        body: JSON.stringify(newLottery)
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Lotería creada exitosamente' })
        setShowCreate(false)
        setCreateForm({
          name: '',
          schedule: '12:00',
          closing_time: '11:50',
          play_types: ['quiniela', 'pale'],
          country: 'RD',
          currency: 'RD$',
        })
        loadLotteries()
      } else {
        const err = await res.json()
        setMessage({ type: 'error', text: err.detail || 'Error al crear lotería' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (loading) return (
    <div className="app-page">
      <PageHeader title="Loterías" />
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full" />
      </div>
    </div>
  )

  return (
    <div className="app-page" data-testid="lotteries-page">
      <PageHeader title="Configuración de Loterías" />
      <div className="app-page-content space-y-6">
        
        {/* Message */}
        {message && (
          <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
            {message.text}
          </div>
        )}

        {/* Create Button */}
        {user?.role === 'super_admin' && (
          <button 
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-slate-900 font-bold rounded-xl hover:bg-green-500 transition-colors"
            data-testid="create-lottery-btn"
          >
            <Plus size={20} /> Nueva Lotería
          </button>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowCreate(false)}>
            <div className="w-full max-w-lg bg-slate-800 rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Nueva Lotería</h3>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Nombre de la Lotería</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Ej: Lotería Nacional 12:30 PM"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-green-500"
                    data-testid="create-lottery-name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">País</label>
                    <select
                      value={createForm.country}
                      onChange={e => setCreateForm({ 
                        ...createForm, 
                        country: e.target.value,
                        currency: e.target.value === 'US' ? 'USD' : 'RD$'
                      })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white"
                    >
                      <option value="RD">República Dominicana</option>
                      <option value="US">Estados Unidos</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Moneda</label>
                    <input
                      type="text"
                      value={createForm.currency}
                      readOnly
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Hora del Sorteo</label>
                    <TimePicker
                      value={createForm.schedule}
                      onChange={val => {
                        // Auto-calculate closing time (10 min before)
                        const [h, m] = val.split(':').map(Number)
                        let closeH = h, closeM = m - 10
                        if (closeM < 0) { closeM += 60; closeH -= 1 }
                        if (closeH < 0) closeH = 23
                        const closingTime = `${String(closeH).padStart(2, '0')}:${String(closeM).padStart(2, '0')}`
                        setCreateForm({ ...createForm, schedule: val, closing_time: closingTime })
                      }}
                      label="Hora del Sorteo"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Hora de Cierre</label>
                    <TimePicker
                      value={createForm.closing_time}
                      onChange={val => setCreateForm({ ...createForm, closing_time: val })}
                      label="Hora de Cierre"
                    />
                  </div>
                </div>

                <PlayTypeSelector
                  selected={createForm.play_types}
                  onChange={types => setCreateForm({ ...createForm, play_types: types })}
                />

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-400 font-semibold hover:border-slate-500"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={createLottery}
                    disabled={saving}
                    className="flex-1 py-3 rounded-xl bg-green-600 text-slate-900 font-bold hover:bg-green-500 disabled:opacity-50 flex items-center justify-center gap-2"
                    data-testid="confirm-create-lottery"
                  >
                    {saving ? 'Creando...' : <><Plus size={18} /> Crear</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lotteries Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lotteries.map((l, i) => {
            const isEditing = editingId === (l.id || l._id)
            const schedule = l.schedule?.[0] || ''
            const playTypesKeys = Object.keys(l.play_types || {})
            
            return (
              <div 
                key={l.id || l._id || i} 
                className={`card transition-all ${isEditing ? 'border-blue-500/50 bg-slate-800/80' : 'hover:border-slate-600'}`}
                data-testid={`lottery-card-${i}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-base text-white">{l.name}</h3>
                  <span className={`badge ${l.active !== false ? 'badge-success' : 'badge-danger'}`}>
                    {l.active !== false ? 'Activa' : 'Inactiva'}
                  </span>
                </div>

                {isEditing ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Sorteo</label>
                        <TimePicker
                          value={editForm.schedule}
                          onChange={val => {
                            const [h, m] = val.split(':').map(Number)
                            let closeH = h, closeM = m - 10
                            if (closeM < 0) { closeM += 60; closeH -= 1 }
                            if (closeH < 0) closeH = 23
                            const closingTime = `${String(closeH).padStart(2, '0')}:${String(closeM).padStart(2, '0')}`
                            setEditForm({ ...editForm, schedule: val, closing_time: closingTime })
                          }}
                          label="Hora del Sorteo"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Cierre</label>
                        <TimePicker
                          value={editForm.closing_time}
                          onChange={val => setEditForm({ ...editForm, closing_time: val })}
                          label="Hora de Cierre"
                        />
                      </div>
                    </div>

                    <PlayTypeSelector
                      selected={editForm.play_types}
                      onChange={types => setEditForm({ ...editForm, play_types: types })}
                    />

                    <div className="flex gap-2">
                      <button 
                        onClick={cancelEdit}
                        className="flex-1 py-2 text-sm rounded-lg border border-slate-600 text-slate-400 hover:border-slate-500"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={() => saveEdit(l)}
                        disabled={saving}
                        className="flex-1 py-2 text-sm rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {saving ? '...' : <><Save size={14} /> Guardar</>}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <>
                    <div className="space-y-2 text-sm text-slate-400">
                      <p>País: {l.country === 'US' ? 'Estados Unidos' : 'Rep. Dominicana'}</p>
                      <div className="flex items-center gap-2">
                        <Clock size={14} />
                        <span>Sorteo: <span className="text-white font-semibold">{l.display_time || formatDisplayTime(schedule)}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-red-400" />
                        <span>Cierre: <span className="text-red-400 font-semibold">{l.display_closing || formatDisplayTime(l.closing_time)}</span></span>
                      </div>
                      {playTypesKeys.length > 0 && (
                        <p>Juegos: <span className="text-slate-300">{playTypesKeys.map(k => 
                          k === 'quiniela' ? 'Quiniela' : 
                          k === 'pale' ? 'Palé' : 
                          k === 'tripleta' ? 'Tripleta' : 
                          k === 'super_pale' ? 'Super Palé' : k
                        ).join(', ')}</span></p>
                      )}
                    </div>

                    <div className="flex gap-2 mt-4">
                      {user?.role === 'super_admin' && (
                        <button 
                          onClick={() => startEdit(l)}
                          className="flex-1 text-sm px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all flex items-center justify-center gap-1"
                        >
                          <Settings size={14} /> Editar
                        </button>
                      )}
                      <button 
                        onClick={() => toggleStatus(l)} 
                        className={`flex-1 text-sm px-3 py-2 rounded-lg ${l.active !== false ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'} transition-all`}
                      >
                        {l.active !== false ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {!lotteries.length && (
          <p className="text-center py-12 text-slate-500">No hay loterías configuradas</p>
        )}
      </div>
    </div>
  )
}
