import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { Bell, DollarSign, Target, Save, TrendingUp, Trophy, AlertTriangle } from 'lucide-react'

export default function AlertSettings() {
  const { apiFetch } = useAuth()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [alerts, setAlerts] = useState([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, aRes] = await Promise.all([
        apiFetch('/api/alert-settings'),
        apiFetch('/api/alert-settings/recent-alerts?limit=15')
      ])
      if (sRes.ok) setSettings(await sRes.json())
      if (aRes.ok) setAlerts(await aRes.json())
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await apiFetch('/api/alert-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestone_rd: settings.milestone_rd,
          milestone_usd: settings.milestone_usd,
          daily_target_rd: settings.daily_target_rd,
          daily_target_usd: settings.daily_target_usd,
          notify_on_winner: settings.notify_on_winner,
          notify_on_milestone: settings.notify_on_milestone,
          notify_on_daily_target: settings.notify_on_daily_target
        })
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
    } catch {} finally { setSaving(false) }
  }

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }))

  const typeIcon = (t) => {
    const map = {
      sales_milestone: { icon: TrendingUp, color: '#22c55e' },
      daily_target: { icon: Target, color: '#8b5cf6' },
      winner_alert: { icon: Trophy, color: '#f59e0b' },
      high_risk_alert: { icon: AlertTriangle, color: '#ef4444' },
      lottery_results: { icon: Trophy, color: '#3b82f6' }
    }
    return map[t] || { icon: Bell, color: '#94a3b8' }
  }

  return (
    <div className="app-page" data-testid="alert-settings-page">
      <PageHeader title="Configurar Alertas" />
      <div className="app-page-content space-y-6">
        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : settings && (
          <>
            {/* Toggle Cards */}
            <div className="card">
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>
                <Bell size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} color="#8b5cf6" />
                Tipos de Alertas
              </h3>
              <div className="space-y-4">
                {[
                  { key: 'notify_on_milestone', label: 'Meta de Ventas', desc: 'Alerta cuando un vendedor alcanza el monto configurado', icon: TrendingUp, color: '#22c55e' },
                  { key: 'notify_on_daily_target', label: 'Meta Diaria', desc: 'Alerta cuando un vendedor alcanza la meta diaria', icon: Target, color: '#8b5cf6' },
                  { key: 'notify_on_winner', label: 'Ticket Ganador', desc: 'Alerta cuando un ticket resulta ganador', icon: Trophy, color: '#f59e0b' },
                ].map(({ key, label, desc, icon: Icon, color }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(15,23,42,0.5)', borderRadius: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} color={color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '14px', fontWeight: 500, color: '#fff', margin: 0 }}>{label}</p>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{desc}</p>
                    </div>
                    <label className="toggle" data-testid={`toggle-${key}`}>
                      <input type="checkbox" checked={settings[key] || false} onChange={e => update(key, e.target.checked)} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Threshold Config */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* RD Thresholds */}
              <div className="card">
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#22c55e', marginBottom: '16px' }}>Rep. Dominicana (RD$)</h3>
                <div className="space-y-4">
                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Meta de Ventas (RD$)</label>
                    <input type="number" value={settings.milestone_rd || 0} data-testid="milestone-rd"
                      onChange={e => update('milestone_rd', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Meta Diaria (RD$)</label>
                    <input type="number" value={settings.daily_target_rd || 0} data-testid="daily-target-rd"
                      onChange={e => update('daily_target_rd', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%' }} />
                  </div>
                </div>
              </div>

              {/* US Thresholds */}
              <div className="card">
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#3b82f6', marginBottom: '16px' }}>Estados Unidos (US$)</h3>
                <div className="space-y-4">
                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Meta de Ventas (US$)</label>
                    <input type="number" value={settings.milestone_usd || 0} data-testid="milestone-usd"
                      onChange={e => update('milestone_usd', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Meta Diaria (US$)</label>
                    <input type="number" value={settings.daily_target_usd || 0} data-testid="daily-target-usd"
                      onChange={e => update('daily_target_usd', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSave} disabled={saving} data-testid="save-alert-settings"
                className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}>
                <Save size={16} />
                {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Configuración'}
              </button>
            </div>

            {/* Recent Alerts Timeline */}
            <div className="card">
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>Alertas Recientes</h3>
              {alerts.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', padding: '20px' }}>Sin alertas recientes</p>
              ) : (
                <div className="space-y-3">
                  {alerts.map((a, i) => {
                    const { icon: Icon, color } = typeIcon(a.type)
                    return (
                      <div key={a.id || i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px', background: a.is_read ? 'transparent' : 'rgba(139,92,246,0.05)', borderRadius: '8px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={16} color={color} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '13px', color: '#e2e8f0', margin: 0 }}>{a.message || a.title}</p>
                          <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>
                            {a.created_at ? new Date(a.created_at).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </div>
                        {!a.is_read && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', marginTop: '6px' }} />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
