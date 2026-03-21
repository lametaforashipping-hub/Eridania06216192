import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Bell, Trophy, TrendingUp, Target, AlertTriangle, X, Check } from 'lucide-react'

const typeConfig = {
  sales_milestone: { icon: TrendingUp, color: '#22c55e', label: 'Meta Ventas' },
  daily_target: { icon: Target, color: '#8b5cf6', label: 'Meta Diaria' },
  winner_alert: { icon: Trophy, color: '#f59e0b', label: 'Ganador' },
  high_risk_alert: { icon: AlertTriangle, color: '#ef4444', label: 'Alto Riesgo' },
  lottery_results: { icon: Trophy, color: '#3b82f6', label: 'Resultados' },
  draw_result: { icon: Trophy, color: '#3b82f6', label: 'Sorteo' },
}

export default function NotificationCenter() {
  const { apiFetch } = useAuth()
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef(null)

  const fetchUnread = useCallback(async () => {
    try {
      const res = await apiFetch('/api/notifications/unread-count')
      if (res.ok) {
        const data = await res.json()
        setUnread(data.unread_count || 0)
      }
    } catch {}
  }, [])

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/alert-settings/recent-alerts?limit=20')
      if (res.ok) setAlerts(await res.json())
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [fetchUnread])

  useEffect(() => {
    if (open) fetchAlerts()
  }, [open])

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const markRead = async (id) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' })
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a))
      setUnread(prev => Math.max(0, prev - 1))
    } catch {}
  }

  const timeAgo = (dateStr) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Ahora'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} data-testid="notification-bell"
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}>
        <Bell size={20} color={unread > 0 ? '#f59e0b' : '#94a3b8'} />
        {unread > 0 && (
          <span data-testid="notification-badge" style={{
            position: 'absolute', top: '0', right: '0',
            background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 700,
            width: '18px', height: '18px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #0f172a'
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div data-testid="notification-panel" style={{
          position: 'absolute', top: '40px', right: 0, width: '360px',
          background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', zIndex: 100, overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Alertas</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={16} color="#64748b" />
            </button>
          </div>

          {/* Alerts List */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" /></div>
            ) : alerts.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Sin alertas recientes
              </div>
            ) : alerts.map(alert => {
              const cfg = typeConfig[alert.type] || { icon: Bell, color: '#94a3b8', label: alert.type }
              const Icon = cfg.icon
              return (
                <div key={alert.id} data-testid={`alert-${alert.id}`}
                  onClick={() => !alert.is_read && markRead(alert.id)}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid #1e293b',
                    cursor: alert.is_read ? 'default' : 'pointer',
                    background: alert.is_read ? 'transparent' : 'rgba(139,92,246,0.05)',
                    transition: 'background 0.2s'
                  }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: cfg.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon size={16} color={cfg.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{timeAgo(alert.created_at)}</span>
                      </div>
                      <p style={{ fontSize: '13px', color: alert.is_read ? '#94a3b8' : '#e2e8f0', margin: 0, lineHeight: 1.4 }}>
                        {alert.message || alert.title}
                      </p>
                    </div>
                    {!alert.is_read && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6', flexShrink: 0, marginTop: '6px' }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
