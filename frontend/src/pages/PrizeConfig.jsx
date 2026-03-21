import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Save, DollarSign, Globe } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function PrizeConfig() {
  const { apiFetch, user } = useAuth()
  const [configs, setConfigs] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeCountry, setActiveCountry] = useState('RD')
  const [message, setMessage] = useState({ type: '', text: '' })

  const playTypes = [
    { key: 'quiniela', name: 'Quiniela', description: '1 número' },
    { key: 'pale', name: 'Pale', description: '2 números' },
    { key: 'tripleta', name: 'Tripleta', description: '3 números' },
    { key: 'super_pale', name: 'Super Pale', description: '2 números especiales' }
  ]

  const positions = [
    { key: 'first', name: '1er Premio' },
    { key: 'second', name: '2do Premio' },
    { key: 'third', name: '3er Premio' }
  ]

  useEffect(() => { loadConfigs() }, [])

  const loadConfigs = async () => {
    try {
      const res = await apiFetch('/api/prize-config')
      if (res.ok) {
        const data = await res.json()
        const configMap = {}
        for (const config of data.configs || []) {
          configMap[config.country] = config
        }
        setConfigs(configMap)
      }
    } catch (err) {
      console.error('Error loading configs:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMultiplierChange = (country, playType, position, value) => {
    setConfigs(prev => ({
      ...prev,
      [country]: {
        ...prev[country],
        [playType]: {
          ...prev[country]?.[playType],
          [position]: parseFloat(value) || 0
        }
      }
    }))
  }

  const saveConfig = async (country) => {
    setSaving(true)
    setMessage({ type: '', text: '' })
    
    try {
      const config = configs[country]
      const res = await apiFetch(`/api/prize-config/${country}`, {
        method: 'PUT',
        body: JSON.stringify({
          country,
          quiniela: config.quiniela,
          pale: config.pale,
          tripleta: config.tripleta,
          super_pale: config.super_pale
        })
      })
      
      if (res.ok) {
        setMessage({ type: 'success', text: `Configuración de ${country === 'US' ? 'USA' : 'República Dominicana'} guardada correctamente` })
      } else {
        setMessage({ type: 'error', text: 'Error al guardar la configuración' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    }
  }

  if (loading) {
    return (
      <div className="app-page">
        <PageHeader title="Configuración de Premios" />
        <div className="flex justify-center py-20">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  const currentConfig = configs[activeCountry] || {}

  return (
    <div className="app-page" data-testid="prize-config-page">
      <PageHeader title="Configuración de Premios" />
      <div className="app-page-content space-y-6">
        
        {/* Country Selector */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="text-[--color-accent]" size={24} />
            <h2 className="text-lg font-semibold">Seleccionar País</h2>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setActiveCountry('RD')}
              className={`flex-1 py-4 px-6 rounded-xl border-2 transition-all ${
                activeCountry === 'RD'
                  ? 'border-[--color-accent] bg-[--color-accent]/10 text-white'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
              }`}
              data-testid="country-rd-btn"
            >
              <div className="text-2xl mb-1">🇩🇴</div>
              <div className="font-semibold">República Dominicana</div>
              <div className="text-sm opacity-70">Moneda: RD$</div>
            </button>
            <button
              onClick={() => setActiveCountry('US')}
              className={`flex-1 py-4 px-6 rounded-xl border-2 transition-all ${
                activeCountry === 'US'
                  ? 'border-[--color-accent] bg-[--color-accent]/10 text-white'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
              }`}
              data-testid="country-us-btn"
            >
              <div className="text-2xl mb-1">🇺🇸</div>
              <div className="font-semibold">Estados Unidos</div>
              <div className="text-sm opacity-70">Moneda: USD</div>
            </button>
          </div>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {/* Multipliers Table */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <DollarSign className="text-[--color-accent]" size={24} />
              <div>
                <h2 className="text-lg font-semibold">
                  Multiplicadores - {activeCountry === 'US' ? 'USA' : 'República Dominicana'}
                </h2>
                <p className="text-sm text-slate-400">
                  Define cuántas veces se multiplica la apuesta para cada tipo de jugada
                </p>
              </div>
            </div>
            <button
              onClick={() => saveConfig(activeCountry)}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
              data-testid="save-config-btn"
            >
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Tipo de Jugada</th>
                  {positions.map(pos => (
                    <th key={pos.key} className="text-center py-3 px-4 text-slate-400 font-medium">
                      {pos.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {playTypes.map(playType => (
                  <tr key={playType.key} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                    <td className="py-4 px-4">
                      <div className="font-medium">{playType.name}</div>
                      <div className="text-sm text-slate-500">{playType.description}</div>
                    </td>
                    {positions.map(pos => (
                      <td key={pos.key} className="py-4 px-4">
                        <div className="relative">
                          <input
                            type="number"
                            value={currentConfig[playType.key]?.[pos.key] || 0}
                            onChange={(e) => handleMultiplierChange(activeCountry, playType.key, pos.key, e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-center text-white focus:border-[--color-accent] focus:outline-none"
                            min="0"
                            step="1"
                            data-testid={`multiplier-${playType.key}-${pos.key}`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">x</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-slate-800/50 rounded-lg">
            <h3 className="font-medium mb-2 text-[--color-accent]">Ejemplo de Cálculo:</h3>
            <p className="text-sm text-slate-400">
              Si un cliente apuesta <strong>{activeCountry === 'US' ? 'US$10' : 'RD$100'}</strong> en una <strong>Quiniela</strong> y gana el <strong>1er Premio</strong>:
            </p>
            <p className="text-lg font-bold mt-2">
              Premio = {activeCountry === 'US' ? 'US$10' : 'RD$100'} × {currentConfig.quiniela?.first || 70} = {' '}
              <span className="text-emerald-400">
                {activeCountry === 'US' ? 'US$' : 'RD$'}{((activeCountry === 'US' ? 10 : 100) * (currentConfig.quiniela?.first || 70)).toLocaleString()}
              </span>
            </p>
          </div>
        </div>

        {/* Quick Reference */}
        <div className="card">
          <h3 className="font-semibold mb-4">Referencia Rápida - Ambos Países</h3>
          <div className="grid grid-cols-2 gap-6">
            {['RD', 'US'].map(country => (
              <div key={country} className={`p-4 rounded-lg ${country === activeCountry ? 'bg-[--color-accent]/10 border border-[--color-accent]/30' : 'bg-slate-800/50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{country === 'RD' ? '🇩🇴' : '🇺🇸'}</span>
                  <span className="font-medium">{country === 'RD' ? 'Rep. Dominicana' : 'USA'}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Quiniela (1er):</span>
                    <span className="font-medium">{configs[country]?.quiniela?.first || '-'}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pale (1er):</span>
                    <span className="font-medium">{configs[country]?.pale?.first || '-'}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tripleta (1er):</span>
                    <span className="font-medium">{configs[country]?.tripleta?.first || '-'}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Super Pale (1er):</span>
                    <span className="font-medium">{configs[country]?.super_pale?.first || '-'}x</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
