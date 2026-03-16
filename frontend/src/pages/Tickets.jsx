import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Search, Filter, Eye, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function Tickets() {
  const { apiFetch, user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => { loadTickets() }, [])

  const loadTickets = async () => {
    try {
      const res = await apiFetch('/api/tickets')
      if (res.ok) { const data = await res.json(); setTickets(data.tickets || data || []) }
    } catch {} finally { setLoading(false) }
  }

  const filtered = tickets.filter(t =>
    (t.ticket_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.lottery_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const getStatusBadge = (status) => {
    const map = { pendiente: 'badge-warning', ganador: 'badge-success', perdedor: 'badge-danger', cancelado: 'badge-info' }
    return map[status] || 'badge-info'
  }

  if (loading) return <div className="app-page"><PageHeader title="Boletos" /><div className="flex justify-center py-20"><div className="spinner" /></div></div>

  return (
    <div className="app-page" data-testid="tickets-page">
      <PageHeader title="Boletos" />
      <div className="app-page-content space-y-6">

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tickets..." className="w-full pl-10" data-testid="ticket-search-input" />
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr><th>#Ticket</th><th>Loteria</th><th>Jugada</th><th>Monto</th><th>Estado</th><th>Fecha</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={i}>
                <td className="font-mono text-sm">{t.ticket_number || `TKT-${i}`}</td>
                <td>{t.lottery_name || '-'}</td>
                <td className="font-semibold">{t.plays?.map(p => p.number || p.numbers?.join('-')).join(', ') || t.number || '-'}</td>
                <td className="font-semibold text-[--color-accent]">${(t.total || t.amount || 0).toLocaleString()}</td>
                <td><span className={`badge ${getStatusBadge(t.status)}`}>{t.status || 'pendiente'}</span></td>
                <td className="text-slate-400 text-sm">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}</td>
                <td><button onClick={() => setSelected(t)} className="text-blue-400 hover:text-blue-300"><Eye size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="text-center text-slate-500 py-8">No hay tickets</p>}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} data-testid="ticket-detail-modal">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold">Ticket {selected.ticket_number}</h2>
              <button onClick={() => setSelected(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <p><span className="text-slate-400">Loteria:</span> {selected.lottery_name}</p>
              <p><span className="text-slate-400">Estado:</span> <span className={`badge ${getStatusBadge(selected.status)}`}>{selected.status}</span></p>
              <p><span className="text-slate-400">Total:</span> <span className="font-bold text-lg">${(selected.total || 0).toLocaleString()}</span></p>
              {selected.plays && (
                <div>
                  <p className="text-slate-400 mb-2">Jugadas:</p>
                  {selected.plays.map((p, j) => (
                    <div key={j} className="bg-[--color-surface] rounded-lg p-3 mb-2">
                      <span className="font-mono font-bold text-lg">{p.number || p.numbers?.join('-')}</span>
                      <span className="text-slate-400 ml-3">{p.game_type} - ${p.amount}</span>
                    </div>
                  ))}
                </div>
              )}
              <p><span className="text-slate-400">Vendedor:</span> {selected.seller_name || '-'}</p>
              <p><span className="text-slate-400">Fecha:</span> {selected.created_at ? new Date(selected.created_at).toLocaleString() : '-'}</p>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
