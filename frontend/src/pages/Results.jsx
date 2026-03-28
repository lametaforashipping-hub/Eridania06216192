import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Trophy, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from '../components/PageHeader'

// Format date for display
const formatDisplayDate = (dateStr) => {
  const date = new Date(dateStr + 'T12:00:00')
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  return date.toLocaleDateString('es-DO', options)
}

// Format date for API
const formatApiDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Check if date is today
const isToday = (dateStr) => {
  const today = new Date()
  return dateStr === formatApiDate(today)
}

export default function Results() {
  const { apiFetch } = useAuth()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(formatApiDate(new Date()))
  const [showDatePicker, setShowDatePicker] = useState(false)

  useEffect(() => { loadResults() }, [selectedDate])

  const loadResults = async () => {
    setLoading(true)
    try {
      // Use by-date endpoint with selected date
      const res = await apiFetch(`/api/lottery-results/by-date?date=${selectedDate}`)
      if (res.ok) { 
        const data = await res.json()
        setResults(data.results || []) 
      } else {
        // Fallback to latest if by-date fails (no draws yet)
        const latestRes = await apiFetch('/api/lottery-results/latest')
        if (latestRes.ok) {
          const latestData = await latestRes.json()
          // Filter by date if possible
          const filtered = (latestData.results || []).filter(r => 
            r.draw_date === selectedDate || isToday(selectedDate)
          )
          setResults(filtered.length > 0 ? filtered : latestData.results || [])
        }
      }
    } catch {} finally { setLoading(false) }
  }

  const goToPreviousDay = () => {
    const current = new Date(selectedDate + 'T12:00:00')
    current.setDate(current.getDate() - 1)
    setSelectedDate(formatApiDate(current))
  }

  const goToNextDay = () => {
    const current = new Date(selectedDate + 'T12:00:00')
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    // Don't allow future dates
    current.setDate(current.getDate() + 1)
    if (current <= tomorrow) {
      setSelectedDate(formatApiDate(current))
    }
  }

  const goToToday = () => {
    setSelectedDate(formatApiDate(new Date()))
  }

  const handleDateChange = (e) => {
    const newDate = e.target.value
    if (newDate) {
      setSelectedDate(newDate)
      setShowDatePicker(false)
    }
  }

  const isTodaySelected = isToday(selectedDate)

  return (
    <div className="app-page" data-testid="results-page">
      <PageHeader title="Resultados" />
      <div className="app-page-content space-y-4">
        
        {/* Date Filter Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 16px',
          background: 'rgba(15, 23, 42, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(148, 163, 184, 0.1)'
        }}>
          {/* Previous Day Button */}
          <button
            onClick={goToPreviousDay}
            data-testid="prev-day-btn"
            style={{
              padding: '8px',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              color: '#a5b4fc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronLeft size={20} />
          </button>

          {/* Date Display & Picker */}
          <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              data-testid="date-picker-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: isTodaySelected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                border: `1px solid ${isTodaySelected ? 'rgba(34, 197, 94, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`,
                borderRadius: '8px',
                color: isTodaySelected ? '#4ade80' : '#a5b4fc',
                cursor: 'pointer',
                width: '100%',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              <Calendar size={16} />
              <span>{isTodaySelected ? 'Hoy - ' : ''}{formatDisplayDate(selectedDate)}</span>
            </button>

            {showDatePicker && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: '8px',
                zIndex: 50,
                background: '#1e293b',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
              }}>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  max={formatApiDate(new Date())}
                  data-testid="date-input"
                  style={{
                    background: '#0f172a',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#e2e8f0',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <button
                    onClick={goToToday}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: '#22c55e',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#0f172a',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Hoy
                  </button>
                  <button
                    onClick={() => setShowDatePicker(false)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: 'rgba(148, 163, 184, 0.2)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#94a3b8',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Next Day Button */}
          <button
            onClick={goToNextDay}
            disabled={isTodaySelected}
            data-testid="next-day-btn"
            style={{
              padding: '8px',
              background: isTodaySelected ? 'rgba(148, 163, 184, 0.05)' : 'rgba(99, 102, 241, 0.1)',
              border: `1px solid ${isTodaySelected ? 'rgba(148, 163, 184, 0.1)' : 'rgba(99, 102, 241, 0.3)'}`,
              borderRadius: '8px',
              color: isTodaySelected ? '#475569' : '#a5b4fc',
              cursor: isTodaySelected ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              opacity: isTodaySelected ? 0.5 : 1
            }}
          >
            <ChevronRight size={20} />
          </button>

          {/* Refresh Button */}
          <button 
            onClick={loadResults} 
            className="btn-secondary" 
            data-testid="refresh-results-btn"
            style={{ marginLeft: '8px' }}
          >
            <Trophy size={16} /> Actualizar
          </button>
        </div>

        {/* Results Grid */}
        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: '12px' }}>
            {results.map((r, i) => (
              <div key={i} className="card" data-testid={`result-card-${i}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm">{r.lottery_name || 'Lotería'}</span>
                  <span className={`badge ${r.validated ? 'badge-success' : 'badge-warning'}`}>
                    {r.validated ? 'Validado' : 'Sin Validar'}
                  </span>
                </div>
                <div className="text-center py-3 space-y-2">
                  <div>
                    <p className="text-xs" style={{ color: '#94a3b8' }}>1er Premio</p>
                    <p className="text-3xl font-bold text-emerald-400 font-mono tracking-wider">{r.first_prize ?? '-'}</p>
                  </div>
                  {(r.second_prize !== null && r.second_prize !== undefined) && (
                    <div className="flex justify-center gap-6">
                      <div><p className="text-xs" style={{ color: '#94a3b8' }}>2do</p><p className="text-sm font-bold text-blue-400 font-mono" style={{ fontSize: '18px' }}>{r.second_prize}</p></div>
                      <div><p className="text-xs" style={{ color: '#94a3b8' }}>3ro</p><p className="text-sm font-bold text-amber-400 font-mono" style={{ fontSize: '18px' }}>{r.third_prize ?? '-'}</p></div>
                    </div>
                  )}
                </div>
                <div className="flex justify-between text-xs mt-2" style={{ color: '#64748b' }}>
                  <span>{r.draw_time || ''}</span>
                  <span>{r.draw_date || selectedDate}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!loading && !results.length && (
          <div className="text-center py-12" style={{ color: '#94a3b8' }}>
            <p>No hay resultados disponibles para esta fecha</p>
            {!isTodaySelected && (
              <button
                onClick={goToToday}
                style={{
                  marginTop: '16px',
                  padding: '10px 20px',
                  background: '#22c55e',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#0f172a',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Ver resultados de Hoy
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
