import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Settings, Gamepad2, ShieldCheck } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [company, setCompany] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/api/company-profile`).then(r => r.ok && r.json().then(setCompany)).catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError('Por favor ingresa email y contraseña'); return }
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

  const initializeSystem = async () => {
    setInitializing(true)
    try {
      const res = await fetch(`${API_URL}/api/init/super-admin`, { method: 'POST' })
      const data = await res.json()
      alert(`Sistema Inicializado\nEmail: ${data.super_admin_email}\nContraseña: ${data.super_admin_password}\nLoterías creadas: ${data.lotteries_created || 7}`)
    } catch { alert('No se pudo inicializar el sistema') }
    finally { setInitializing(false) }
  }

  const companyName = company?.company_name || 'Lotería Mágica'
  const slogan = company?.slogan || 'Tu suerte comienza aquí'
  const logoUrl = company?.logo_url ? `${API_URL}${company.logo_url}` : null

  return (
    <div className="login-page" data-testid="login-page">
      {/* Decorative circles */}
      <div className="login-circle login-circle-1" />
      <div className="login-circle login-circle-2" />
      <div className="login-circle login-circle-3" />

      <div className="login-scroll">
        <div className="login-card" data-testid="login-form">
          {/* Logo Section */}
          <div className="login-logo-section">
            <div className="login-logo-outer">
              <div className="login-logo-inner">
                <div className="login-logo-container">
                  {logoUrl ? (
                    <img src={logoUrl} alt={companyName} className="login-logo-img" />
                  ) : (
                    <div className="login-logo-placeholder">LM</div>
                  )}
                </div>
              </div>
            </div>
            <h1 className="login-company-name">{companyName}</h1>
            <div className="login-tagline">
              <div className="login-tagline-line" />
              <span>{slogan}</span>
              <div className="login-tagline-line" />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form-section">
            {error && (
              <div className="login-error" data-testid="login-error">{error}</div>
            )}

            <div className="login-input-wrapper">
              <label className="login-input-label">Correo Electrónico</label>
              <div className="login-input-container">
                <div className="login-input-icon">
                  <svg width="18" height="18" fill="none" stroke="#a78bfa" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  data-testid="login-email-input"
                />
              </div>
            </div>

            <div className="login-input-wrapper">
              <label className="login-input-label">Contraseña</label>
              <div className="login-input-container">
                <div className="login-input-icon">
                  <svg width="18" height="18" fill="none" stroke="#a78bfa" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  data-testid="login-password-input"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="login-eye-btn">
                  {showPass ? <EyeOff size={20} color="#6b7280" /> : <Eye size={20} color="#6b7280" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="login-btn-primary" data-testid="login-submit-button">
              {loading ? <div className="spinner !w-5 !h-5" /> : <><LogIn size={20} /> Iniciar Sesión</>}
            </button>

            <div className="login-divider">
              <div className="login-divider-line" />
              <span>o</span>
              <div className="login-divider-line" />
            </div>

            <button type="button" onClick={initializeSystem} disabled={initializing} className="login-btn-init">
              {initializing ? <div className="spinner !w-5 !h-5" /> : <><Settings size={18} color="#a78bfa" /> Inicializar Sistema</>}
            </button>

            <button type="button" onClick={() => navigate('/client-login')} className="login-btn-client">
              <Gamepad2 size={18} color="#22c55e" />
              Soy cliente - Quiero jugar
            </button>
          </form>
        </div>

        <div className="login-footer">
          <div className="login-footer-badge">
            <ShieldCheck size={14} color="#22c55e" />
            <span>Conexión Segura</span>
          </div>
          <p className="login-footer-version">v3.0.0</p>
        </div>
      </div>
    </div>
  )
}
