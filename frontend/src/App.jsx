import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Lotteries from './pages/Lotteries'
import Tickets from './pages/Tickets'
import Results from './pages/Results'
import Venta from './pages/Venta'
import Statistics from './pages/Statistics'
import ComingSoon from './pages/ComingSoon'
import PrizeConfig from './pages/PrizeConfig'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-[#0f172a]"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f172a]">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/client-login" element={<ComingSoon title="Portal de Clientes" />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
      <Route path="/lotteries" element={<ProtectedRoute><Lotteries /></ProtectedRoute>} />
      <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Results /></ProtectedRoute>} />
      <Route path="/venta" element={<ProtectedRoute><Venta /></ProtectedRoute>} />
      <Route path="/stats" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
      {/* Pages with placeholder */}
      <Route path="/my-profile" element={<ProtectedRoute><ComingSoon title="Mi Perfil" /></ProtectedRoute>} />
      <Route path="/scanner" element={<ProtectedRoute><ComingSoon title="Verificar Ticket" /></ProtectedRoute>} />
      <Route path="/favorites" element={<ProtectedRoute><ComingSoon title="Favoritos" /></ProtectedRoute>} />
      <Route path="/draws" element={<ProtectedRoute><ComingSoon title="Sorteos" /></ProtectedRoute>} />
      <Route path="/auto-results" element={<ProtectedRoute><ComingSoon title="Auto Resultados" /></ProtectedRoute>} />
      <Route path="/live-tickets" element={<ProtectedRoute><ComingSoon title="Tickets En Vivo" /></ProtectedRoute>} />
      <Route path="/monitoring" element={<ProtectedRoute><ComingSoon title="Monitoreo" /></ProtectedRoute>} />
      <Route path="/number-limits" element={<ProtectedRoute><ComingSoon title="Límites de Números" /></ProtectedRoute>} />
      <Route path="/user-report" element={<ProtectedRoute><ComingSoon title="Mi Reporte" /></ProtectedRoute>} />
      <Route path="/sellers-report" element={<ProtectedRoute><ComingSoon title="Reporte Vendedores" /></ProtectedRoute>} />
      <Route path="/terminals" element={<ProtectedRoute><ComingSoon title="Terminales" /></ProtectedRoute>} />
      <Route path="/admin-stats" element={<ProtectedRoute><ComingSoon title="Dashboard Admin" /></ProtectedRoute>} />
      <Route path="/sales-goals" element={<ProtectedRoute><ComingSoon title="Metas de Ventas" /></ProtectedRoute>} />
      <Route path="/accounting" element={<ProtectedRoute><ComingSoon title="Contabilidad" /></ProtectedRoute>} />
      <Route path="/commission-report" element={<ProtectedRoute><ComingSoon title="Comisiones" /></ProtectedRoute>} />
      <Route path="/pay-prizes" element={<ProtectedRoute><ComingSoon title="Pagar Premios" /></ProtectedRoute>} />
      <Route path="/admin-pending-payments" element={<ProtectedRoute><ComingSoon title="Pagos Pendientes" /></ProtectedRoute>} />
      <Route path="/bank-accounts" element={<ProtectedRoute><ComingSoon title="Cuentas de Banco" /></ProtectedRoute>} />
      <Route path="/play-types-admin" element={<ProtectedRoute><ComingSoon title="Tipos de Jugada" /></ProtectedRoute>} />
      <Route path="/prize-config" element={<ProtectedRoute><PrizeConfig /></ProtectedRoute>} />
      <Route path="/company-profile" element={<ProtectedRoute><ComingSoon title="Mi Empresa" /></ProtectedRoute>} />
      <Route path="/system-settings" element={<ProtectedRoute><ComingSoon title="Configuración" /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
