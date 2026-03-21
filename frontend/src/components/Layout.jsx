import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, Users, Ticket, Trophy, ShoppingCart, BarChart3, LogOut, Menu, X, ChevronDown, Globe, Receipt, DollarSign, FileText, Bell } from 'lucide-react'
import NotificationCenter from './NotificationCenter'

const adminLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'Usuarios' },
  { to: '/lotteries', icon: Ticket, label: 'Loterias' },
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

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isAdmin = ['super_admin', 'admin'].includes(user?.role)
  const links = isAdmin ? adminLinks : sellerLinks

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0c1222] border-r border-[--color-surface-lighter] flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-[--color-surface-lighter]">
          <h1 className="text-xl font-bold text-[--color-accent]">Lottery Magic</h1>
          <p className="text-xs text-slate-500 mt-1">Sistema de Loteria</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[--color-accent]/10 text-[--color-accent]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[--color-surface-lighter]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[--color-accent] flex items-center justify-center text-black font-bold text-sm">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 w-full px-2 py-1.5 rounded hover:bg-red-500/10 transition-all">
            <LogOut size={16} />
            Cerrar Sesion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-[--color-surface-light] border-b border-[--color-surface-lighter] flex items-center px-4 lg:px-6 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-3 text-slate-400 hover:text-white">
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <span className="text-xs text-slate-500 hidden sm:block">{user?.email}</span>
            <div className="w-7 h-7 rounded-full bg-[--color-primary] flex items-center justify-center text-xs font-bold">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
