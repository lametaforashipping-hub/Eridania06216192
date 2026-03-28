import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, Users, Ticket, Trophy, ShoppingCart, BarChart3, LogOut, Menu, X, Globe, Receipt, DollarSign, FileText, Bell, Settings, Building2 } from 'lucide-react'
import NotificationCenter from './NotificationCenter'

// Links visibles para super_admin (acceso completo)
const superAdminLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'Usuarios' },
  { to: '/lotteries', icon: Ticket, label: 'Loterías' },
  { to: '/venta', icon: ShoppingCart, label: 'Venta' },
  { to: '/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/results', icon: Trophy, label: 'Resultados' },
  { to: '/sales-report', icon: Globe, label: 'Reporte País' },
  { to: '/sellers-report', icon: Users, label: 'Vendedores' },
  { to: '/accounting', icon: DollarSign, label: 'Contabilidad' },
  { to: '/commission-report', icon: Receipt, label: 'Comisiones' },
  { to: '/statistics', icon: BarChart3, label: 'Estadísticas' },
  { to: '/alert-settings', icon: Bell, label: 'Alertas' },
  { to: '/system-settings', icon: Settings, label: 'Configuración' },
  { to: '/company-profile', icon: Building2, label: 'Mi Empresa' },
]

// Links para admin (sin acceso a loterías config, sistema y empresa)
const adminLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'Usuarios' },
  { to: '/venta', icon: ShoppingCart, label: 'Venta' },
  { to: '/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/results', icon: Trophy, label: 'Resultados' },
  { to: '/sales-report', icon: Globe, label: 'Reporte País' },
  { to: '/sellers-report', icon: Users, label: 'Vendedores' },
  { to: '/accounting', icon: DollarSign, label: 'Contabilidad' },
  { to: '/commission-report', icon: Receipt, label: 'Comisiones' },
  { to: '/statistics', icon: BarChart3, label: 'Estadísticas' },
  { to: '/alert-settings', icon: Bell, label: 'Alertas' },
]

const sellerLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/venta', icon: ShoppingCart, label: 'Venta' },
  { to: '/tickets', icon: Ticket, label: 'Mis Tickets' },
  { to: '/results', icon: Trophy, label: 'Resultados' },
  { to: '/user-report', icon: FileText, label: 'Mi Reporte' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Determinar qué enlaces mostrar según el rol
  const getLinksForRole = () => {
    if (user?.role === 'super_admin') return superAdminLinks
    if (user?.role === 'admin') return adminLinks
    return sellerLinks
  }
  const links = getLinksForRole()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0f172a' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside data-testid="app-sidebar" style={{
        width: '240px', minWidth: '240px', background: '#0c1222', borderRight: '1px solid #1e293b',
        display: 'flex', flexDirection: 'column', zIndex: 50, height: '100vh',
        position: sidebarOpen ? 'fixed' : undefined, top: 0, left: 0, bottom: 0,
        transform: !sidebarOpen ? undefined : undefined
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#a78bfa', margin: 0 }}>Lotería Mágica</h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>Sistema de Lotería</p>
        </div>

        <nav style={{ flex: 1, padding: '8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to} end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              data-testid={`nav-${to.replace('/', '') || 'home'}`}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                textDecoration: 'none', transition: 'all 0.15s',
                background: isActive ? 'rgba(139,92,246,0.12)' : 'transparent',
                color: isActive ? '#a78bfa' : '#94a3b8',
              })}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 700, fontSize: '13px' }}>
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</p>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0, textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button onClick={handleLogout} data-testid="sidebar-logout" style={{
            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f87171',
            background: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: '6px 8px', borderRadius: '6px'
          }}>
            <LogOut size={15} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header data-testid="app-header" style={{
          height: '52px', minHeight: '52px', background: '#131c31', borderBottom: '1px solid #1e293b',
          display: 'flex', alignItems: 'center', padding: '0 20px'
        }}>
          <button onClick={() => setSidebarOpen(true)} data-testid="sidebar-toggle"
            style={{ display: 'none', marginRight: '12px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <Menu size={22} />
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <NotificationCenter />
            <span style={{ fontSize: '12px', color: '#64748b' }}>{user?.email}</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#6d28d9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff' }}>
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
