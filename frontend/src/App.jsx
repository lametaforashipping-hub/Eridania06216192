import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Lotteries from './pages/Lotteries'
import Tickets from './pages/Tickets'
import Results from './pages/Results'
import Venta from './pages/Venta'
import Statistics from './pages/Statistics'

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<ProtectedRoute roles={['super_admin', 'admin']}><Users /></ProtectedRoute>} />
        <Route path="lotteries" element={<ProtectedRoute roles={['super_admin', 'admin']}><Lotteries /></ProtectedRoute>} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="results" element={<Results />} />
        <Route path="venta" element={<ProtectedRoute roles={['vendedor']}><Venta /></ProtectedRoute>} />
        <Route path="statistics" element={<ProtectedRoute roles={['super_admin', 'admin']}><Statistics /></ProtectedRoute>} />
      </Route>
    </Routes>
  )
}
