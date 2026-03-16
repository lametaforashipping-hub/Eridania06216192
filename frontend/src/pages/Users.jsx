import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Search, Edit, Wallet, Trash2, X } from 'lucide-react'

export default function Users() {
  const { apiFetch } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [selected, setSelected] = useState(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'vendedor', phone: '', commission_rate: 10, currency: 'RD' })

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    try {
      const res = await apiFetch('/api/users')
      if (res.ok) { const data = await res.json(); setUsers(data.users || data || []) }
    } catch {} finally { setLoading(false) }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const res = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(form) })
    if (res.ok) { setShowModal(false); loadUsers(); setForm({ name: '', email: '', password: '', role: 'vendedor', phone: '', commission_rate: 10, currency: 'RD' }) }
    else { const err = await res.json(); alert(err.detail || 'Error') }
  }

  const handleDeposit = async () => {
    if (!depositAmount || !selected) return
    const res = await apiFetch(`/api/users/${selected.id || selected._id}/deposit?amount=${parseFloat(depositAmount)}`, {
      method: 'POST'
    })
    if (res.ok) { setShowDeposit(false); setDepositAmount(''); loadUsers() }
    else { const err = await res.json(); alert(err.detail || 'Error') }
  }

  const filtered = users.filter(u => u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="flex justify-center py-20"><div className="spinner" /></div>

  return (
    <div className="animate-in space-y-6" data-testid="users-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary" data-testid="add-user-button"><Plus size={18} /> Nuevo Usuario</button>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuarios..." className="w-full pl-10" data-testid="user-search-input" />
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Balance</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={i}>
                <td className="font-medium">{u.name}</td>
                <td className="text-slate-400">{u.email}</td>
                <td><span className="badge badge-info capitalize">{u.role?.replace('_', ' ')}</span></td>
                <td className="font-semibold">{u.currency || 'RD'} {(u.balance || 0).toLocaleString()}</td>
                <td><span className={`badge ${u.active !== false ? 'badge-success' : 'badge-danger'}`}>{u.active !== false ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                  <div className="flex gap-2">
                    <button onClick={() => { setSelected(u); setShowDeposit(true) }} className="text-emerald-400 hover:text-emerald-300" title="Depositar" data-testid={`deposit-btn-${i}`}><Wallet size={16} /></button>
                    <button className="text-blue-400 hover:text-blue-300" title="Editar" data-testid={`edit-btn-${i}`}><Edit size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="text-center text-slate-500 py-8">No se encontraron usuarios</p>}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <form className="modal-content" onClick={e => e.stopPropagation()} onSubmit={handleCreate} data-testid="create-user-modal">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold">Nuevo Usuario</h2>
              <button type="button" onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm text-slate-400 mb-1">Nombre</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full" required /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full" required /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Contrasena</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-slate-400 mb-1">Rol</label><select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full"><option value="vendedor">Vendedor</option><option value="admin">Admin</option></select></div>
                <div><label className="block text-sm text-slate-400 mb-1">Comision %</label><input type="number" value={form.commission_rate} onChange={e => setForm({...form, commission_rate: parseFloat(e.target.value)})} className="w-full" /></div>
              </div>
              <div><label className="block text-sm text-slate-400 mb-1">Telefono</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full" /></div>
              <button type="submit" className="btn-primary w-full justify-center">Crear Usuario</button>
            </div>
          </form>
        </div>
      )}

      {/* Deposit Modal */}
      {showDeposit && (
        <div className="modal-overlay" onClick={() => setShowDeposit(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} data-testid="deposit-modal">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold">Depositar a {selected?.name}</h2>
              <button onClick={() => setShowDeposit(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-400 mb-1">Balance Actual</p>
            <p className="text-xl font-bold text-[--color-accent] mb-4">{selected?.currency || 'RD'} {(selected?.balance || 0).toLocaleString()}</p>
            <label className="block text-sm text-slate-400 mb-1">Monto a Depositar</label>
            <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" className="w-full mb-4" data-testid="deposit-amount-input" />
            <button onClick={handleDeposit} className="btn-primary w-full justify-center" data-testid="confirm-deposit-button"><Wallet size={18} /> Confirmar Deposito</button>
          </div>
        </div>
      )}
    </div>
  )
}
