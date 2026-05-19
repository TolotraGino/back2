import { useEffect, useMemo, useState } from 'react'
import { getApiConfig } from '../../services/apiService.js'
import { OrderService } from '../services/OrderService.js'

const orderService = new OrderService()

async function fetchCategoryStats() {
  const { baseUrl, token } = getApiConfig()
  const psBase = baseUrl.replace(/\/api\/?$/, '')
  const params = new URLSearchParams({ fc: 'module', module: 'stockapi', controller: 'catstats' })
  if (token) params.set('ws_key', token)
  const res = await fetch(`${psBase}/index.php?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Erreur serveur')
  return data.categories || []
}

function formatAmount(value) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function DashboardStatsPage() {
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [catRows, setCatRows] = useState([])
  const [catLoading, setCatLoading] = useState(true)
  const [catError, setCatError] = useState('')

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true)
      setError('')
      const result = await orderService.fetchOrders()
      if (!result.ok) {
        setError(`Erreur chargement stats (HTTP ${result.status})`)
        setIsLoading(false)
        return
      }
      setRows(orderService.groupByDay(result.data))
      setIsLoading(false)
    }

    const loadCatStats = async () => {
      setCatLoading(true)
      setCatError('')
      try {
        const cats = await fetchCategoryStats()
        setCatRows(cats)
      } catch (err) {
        setCatError(err.message || 'Erreur chargement stock categories')
      } finally {
        setCatLoading(false)
      }
    }

    loadStats()
    loadCatStats()
  }, [])

  const totalGeneral = useMemo(() => rows.reduce((sum, row) => sum + row.amount, 0), [rows])
  const totalOrders = useMemo(() => rows.reduce((sum, row) => sum + row.count, 0), [rows])

  return (
    <section className="bo-content">
      <header className="bo-content__header">
        <h2>Tableau de bord</h2>
        <p className="bo-muted">Par jour: nombre de commandes et montant.</p>
      </header>

      {error ? <p className="bo-error">{error}</p> : null}

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div className="bo-card" style={{ minWidth: '180px', flex: '1' }}>
          <p className="bo-muted" style={{ margin: '0 0 4px', fontSize: '13px' }}>Total commandes</p>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
            {isLoading ? '...' : totalOrders}
          </p>
        </div>
        <div className="bo-card" style={{ minWidth: '180px', flex: '1' }}>
          <p className="bo-muted" style={{ margin: '0 0 4px', fontSize: '13px' }}>Chiffre d&apos;affaires total</p>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
            {isLoading ? '...' : `${formatAmount(totalGeneral)} €`}
          </p>
        </div>
        <div className="bo-card" style={{ minWidth: '180px', flex: '1' }}>
          <p className="bo-muted" style={{ margin: '0 0 4px', fontSize: '13px' }}>Panier moyen</p>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
            {isLoading ? '...' : `${formatAmount(totalOrders > 0 ? totalGeneral / totalOrders : 0)} €`}
          </p>
        </div>
      </div>

      {/* ── Tableau stock par catégorie ── */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>Stock par catégorie</h3>
        {catError ? (
          <p style={{ color: '#b91c1c', fontSize: '14px' }}>{catError}</p>
        ) : catLoading ? (
          <p className="bo-muted">Chargement stock...</p>
        ) : catRows.length === 0 ? (
          <p className="bo-muted">Aucune catégorie trouvée.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '420px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left',   padding: '10px 14px', fontWeight: 600, color: 'var(--muted)' }}>Catégorie</th>
                  <th style={{ textAlign: 'right',  padding: '10px 14px', fontWeight: 600, color: 'var(--muted)' }}>Qté physique</th>
                  <th style={{ textAlign: 'right',  padding: '10px 14px', fontWeight: 600, color: 'var(--muted)' }}>Qté réservé</th>
                  <th style={{ textAlign: 'right',  padding: '10px 14px', fontWeight: 600, color: 'var(--muted)' }}>Qté disponible</th>
                </tr>
              </thead>
              <tbody>
                {catRows.map((row) => (
                  <tr key={row.id_category} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{row.name}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.qty_physical}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: row.qty_reserved > 0 ? '#b45309' : 'var(--muted)' }}>
                      {row.qty_reserved}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: row.qty_available === 0 ? '#b91c1c' : '#166534' }}>
                      {row.qty_available}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border)', background: '#f8fafc', fontWeight: 700 }}>
                  <td style={{ padding: '10px 14px' }}>Total</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{catRows.reduce((s, r) => s + r.qty_physical, 0)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#b45309' }}>{catRows.reduce((s, r) => s + r.qty_reserved, 0)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#166534' }}>{catRows.reduce((s, r) => s + r.qty_available, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isLoading ? <p className="bo-muted">Chargement...</p> : null}

      <div className="bo-stats-table">
        <div className="bo-stats-table__head">
          <span>Date</span>
          <span>Nb commandes</span>
          <span>Montant</span>
        </div>

        {rows.map((row) => (
          <div className="bo-stats-table__row" key={row.day}>
            <span>{row.day}</span>
            <span>{row.count}</span>
            <span>{formatAmount(row.amount)}</span>
          </div>
        ))}

        <div className="bo-stats-table__total">
          <span>Total general</span>
          <span>{totalOrders}</span>
          <span>{formatAmount(totalGeneral)}</span>
        </div>
      </div>
    </section>
  )
}

export default DashboardStatsPage
