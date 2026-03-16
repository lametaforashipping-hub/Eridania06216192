import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { LogIn, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--color-surface] px-4" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[--color-accent] mb-2">Lottery Magic</h1>
          <p className="text-slate-400">Sistema de Gestion de Loteria</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5" data-testid="login-form">
          <h2 className="text-lg font-semibold text-center">Iniciar Sesion</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm" data-testid="login-error">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full"
              required
              data-testid="login-email-input"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Contrasena</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contrasena"
                className="w-full pr-10"
                required
                data-testid="login-password-input"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-3"
            data-testid="login-submit-button"
          >
            {loading ? <div className="spinner !w-5 !h-5" /> : <><LogIn size={18} /> Entrar</>}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">Lottery Magic v1.0</p>
      </div>
    </div>
  )
}
