import { useEffect, useMemo, useState } from 'react'
import { OrderService } from '../services/OrderService.js'

const orderService = new OrderService()

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

    loadStats()
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
