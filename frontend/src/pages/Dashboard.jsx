import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  LogOut, Bell, User, ShoppingCart, QrCode, Ticket, Heart, Trophy,
  Zap, Radio, Eye, Gauge, BarChart3, Users, Landmark, Grid3X3,
  Target, Calculator, Receipt, Banknote, CreditCard, Building2,
  Settings, TrendingUp, TrendingDown, Calendar, DollarSign, ChevronRight, Gift
} from 'lucide-react'

export default function Dashboard() {
  const { user, token, apiFetch, logout } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedCountry, setSelectedCountry] = useState(null)

  const fetchSummary = useCallback(async () => {
    try {
      let url = '/api/accounting/summary'
      if (selectedCountry) url += `?country=${selectedCountry}`
      const res = await apiFetch(url)
      if (res.ok) setSummary(await res.json())
    } catch {} finally { setLoading(false) }
  }, [selectedCountry])

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiFetch('/api/notifications/unread-count')
      if (res.ok) { const d = await res.json(); setUnreadCount(d.unread_count || 0) }
    } catch {}
  }, [])

  useEffect(() => {
    fetchSummary()
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [fetchSummary, fetchUnreadCount])

  const handleLogout = () => { logout(); navigate('/login') }

  const formatCurrency = (amount, currency) => {
    const symbol = currency === 'USD' || currency === '$' ? '$' : 'RD$'
    return `${symbol} ${(amount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
  }

  const getRoleLabel = (role) => {
    const labels = { super_admin: 'Super Administrador', admin: 'Administrador', vendedor: 'Vendedor' }
    return labels[role] || role
  }

  const menuItems = [
    { icon: User, label: 'Mi Perfil', route: '/my-profile', roles: ['super_admin', 'admin', 'vendedor'], color: '#6366f1' },
    { icon: ShoppingCart, label: 'Venta', route: '/venta', roles: ['super_admin', 'admin', 'vendedor'], color: '#22c55e' },
    { icon: QrCode, label: 'Verificar', route: '/scanner', roles: ['super_admin', 'admin', 'vendedor'], color: '#06b6d4' },
    { icon: Ticket, label: 'Boletos', route: '/tickets', roles: ['super_admin', 'admin', 'vendedor'], color: '#8b5cf6' },
    { icon: Heart, label: 'Favoritos', route: '/favorites', roles: ['super_admin', 'admin', 'vendedor'], color: '#ec4899' },
    { icon: Bell, label: 'Resultados', route: '/notifications', roles: ['super_admin', 'admin', 'vendedor'], color: '#f59e0b' },
    { icon: Trophy, label: 'Sorteos', route: '/draws', roles: ['super_admin', 'admin'], color: '#eab308' },
    { icon: Zap, label: 'Auto Resultados', route: '/auto-results', roles: ['super_admin', 'admin'], color: '#10b981' },
    { icon: Radio, label: 'En Vivo', route: '/live-tickets', roles: ['super_admin', 'admin'], color: '#ef4444' },
    { icon: Eye, label: 'Monitoreo', route: '/monitoring', roles: ['super_admin', 'admin'], color: '#ef4444' },
    { icon: Gauge, label: 'Límites', route: '/number-limits', roles: ['super_admin', 'admin'], color: '#dc2626' },
    { icon: BarChart3, label: 'Mi Reporte', route: '/user-report', roles: ['super_admin', 'admin', 'vendedor'], color: '#8b5cf6' },
    { icon: Users, label: 'Vendedores', route: '/sellers-report', roles: ['super_admin', 'admin'], color: '#06b6d4' },
    { icon: ChevronRight, label: 'Terminales', route: '/terminals', roles: ['super_admin', 'admin'], color: '#22c55e' },
    { icon: TrendingUp, label: 'Estadísticas', route: '/stats', roles: ['super_admin', 'admin', 'vendedor'], color: '#14b8a6' },
    { icon: BarChart3, label: 'Reporte País', route: '/sales-report', roles: ['super_admin', 'admin'], color: '#7c3aed' },
    { icon: Target, label: 'Metas Ventas', route: '/sales-goals', roles: ['super_admin', 'admin'], color: '#ec4899' },
    { icon: Calculator, label: 'Contabilidad', route: '/accounting', roles: ['super_admin', 'admin', 'vendedor'], color: '#0ea5e9' },
    { icon: Receipt, label: 'Comisiones', route: '/commission-report', roles: ['super_admin', 'admin', 'vendedor'], color: '#f59e0b' },
    { icon: DollarSign, label: 'Cuadre', route: '/cuadre', roles: ['super_admin', 'admin'], color: '#10b981' },
    { icon: Banknote, label: 'Pagar Premios', route: '/pay-prizes', roles: ['super_admin', 'admin'], color: '#10b981' },
    { icon: CreditCard, label: 'Pagos Clientes', route: '/admin-pending-payments', roles: ['super_admin', 'admin'], color: '#f43f5e' },
    { icon: Users, label: 'Usuarios', route: '/users', roles: ['super_admin', 'admin'], color: '#f97316' },
    { icon: Landmark, label: 'Cuentas Banco', route: '/bank-accounts', roles: ['super_admin', 'admin'], color: '#0d9488' },
    { icon: Grid3X3, label: 'Loterías', route: '/lotteries', roles: ['super_admin'], color: '#a855f7' },
    { icon: Gift, label: 'Premios País', route: '/prize-config', roles: ['super_admin'], color: '#22c55e' },
    { icon: Target, label: 'Tipos Jugada', route: '/play-types-admin', roles: ['super_admin'], color: '#f43f5e' },
    { icon: Building2, label: 'Mi Empresa', route: '/company-profile', roles: ['super_admin'], color: '#6366f1' },
    { icon: Settings, label: 'Configuración', route: '/system-settings', roles: ['super_admin'], color: '#64748b' },
  ]

  const visibleMenuItems = menuItems.filter(item => user && item.roles.includes(user.role))
  const curr = summary?.currency || user?.currency || 'RD$'

  return (
    <div className="dashboard-page" data-testid="dashboard-page">
      {/* Header */}
      <div className="dash-header">
        <div>
          <p className="dash-greeting">¡Hola!</p>
          <p className="dash-username">{user?.name}</p>
          <p className="dash-role">{getRoleLabel(user?.role)}</p>
        </div>
        <div className="dash-header-actions">
          <button className="dash-notif-btn" onClick={() => navigate('/notifications')} data-testid="notif-btn">
            <Bell size={24} color="#f59e0b" />
            {unreadCount > 0 && (
              <span className="dash-notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>
          <button className="dash-logout-btn" onClick={handleLogout} data-testid="logout-btn">
            <LogOut size={24} color="#ef4444" />
          </button>
        </div>
      </div>

      <div className="dash-content">
        {/* Country Filter for Super Admin */}
        {user?.role === 'super_admin' && (
          <div className="dash-country-filter" data-testid="country-filter">
            <span className="dash-filter-label">Filtrar por país:</span>
            <div className="dash-country-buttons">
              {[{ val: null, label: 'Todos' }, { val: 'RD', label: 'RD' }, { val: 'US', label: 'USA' }].map(c => (
                <button key={c.label} onClick={() => setSelectedCountry(c.val)}
                  className={`dash-country-btn ${selectedCountry === c.val ? 'active' : ''}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {loading ? (
          <div className="flex justify-center py-10"><div className="spinner" /></div>
        ) : summary && (
          <div className="dash-stats-grid" data-testid="stats-grid">
            <div className="dash-stat-card">
              <DollarSign size={24} color="#22c55e" />
              <p className="dash-stat-label">Ventas Hoy</p>
              <p className="dash-stat-value">{formatCurrency(summary.today.sales, curr)}</p>
              <p className="dash-stat-sub">{summary.today.tickets} boletos</p>
            </div>
            <div className={`dash-stat-card ${summary.today.profit >= 0 ? 'dash-stat-profit' : 'dash-stat-loss'}`}>
              {summary.today.profit >= 0 ? <TrendingUp size={24} color="#22c55e" /> : <TrendingDown size={24} color="#ef4444" />}
              <p className="dash-stat-label">Ganancia Hoy</p>
              <p className={`dash-stat-value ${summary.today.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(summary.today.profit, curr)}
              </p>
              <p className="dash-stat-sub">Premios: {formatCurrency(summary.today.wins, curr)}</p>
            </div>
            <div className="dash-stat-card">
              <Calendar size={24} color="#3b82f6" />
              <p className="dash-stat-label">Esta Semana</p>
              <p className="dash-stat-value">{formatCurrency(summary.week.sales, curr)}</p>
              <p className="dash-stat-sub">{summary.week.tickets} boletos</p>
            </div>
            <div className="dash-stat-card">
              <Calendar size={24} color="#8b5cf6" />
              <p className="dash-stat-label">Este Mes</p>
              <p className="dash-stat-value">{formatCurrency(summary.month.sales, curr)}</p>
              <p className="dash-stat-sub">{summary.month.tickets} boletos</p>
            </div>
          </div>
        )}

        {/* Menu Grid */}
        <h2 className="dash-section-title">Menú Principal</h2>
        <div className="dash-menu-grid" data-testid="menu-grid">
          {visibleMenuItems.map((item, i) => (
            <button key={i} className="dash-menu-item" onClick={() => navigate(item.route)} data-testid={`menu-${item.route.slice(1)}`}>
              <div className="dash-menu-icon" style={{ backgroundColor: item.color + '20' }}>
                <item.icon size={32} color={item.color} />
              </div>
              <span className="dash-menu-label">{item.label}</span>
            </button>
          ))}
        </div>

        {/* User Info Card */}
        {user && (
          <div className="dash-user-info" data-testid="user-info">
            <h3 className="dash-user-info-title">Información de Cuenta</h3>
            <div className="dash-user-info-row">
              <span className="dash-user-info-label">Límite de Crédito:</span>
              <span className="dash-user-info-value">{formatCurrency(user.credit_limit, user.currency)}</span>
            </div>
            <div className="dash-user-info-row">
              <span className="dash-user-info-label">Balance:</span>
              <span className="dash-user-info-value text-emerald-400">{formatCurrency(user.balance, user.currency)}</span>
            </div>
            {user.role === 'vendedor' && (
              <div className="dash-user-info-row">
                <span className="dash-user-info-label">Comisión:</span>
                <span className="dash-user-info-value">{user.commission_rate || 10}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
