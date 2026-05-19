import { useState } from 'react'
import { testApiConnection } from '../../services/apiService.js'
import ResetDataPage from './ResetDataPage.jsx'
import OrdersPage from './OrdersPage.jsx'
import CSVImportPage from './CSVImportPage.jsx'
import DashboardStatsPage from './DashboardStatsPage.jsx'
import StockPage from './StockPage.jsx'
import ProfitStatsPage from './ProfitStatsPage.jsx'

function Dashboard({ onLogout, initialPage = 'reset' }) {
  const [apiStatus, setApiStatus] = useState(null)
  const [isTesting, setIsTesting] = useState(false)
  const [activePage, setActivePage] = useState(initialPage)

  const handleTestApi = async () => {
    setIsTesting(true)
    setApiStatus(null)
    const result = await testApiConnection('/customers/')
    setApiStatus(result)
    setIsTesting(false)
  }

  return (
    <main className="bo-shell bo-shell--dashboard">
      <aside className="bo-sidebar">
        <div className="bo-sidebar__header">
          <p className="bo-kicker">Backoffice</p>
          <h1>Admin</h1>
        </div>
        <nav className="bo-sidebar__nav">
          <button
            type="button"
            className={`bo-nav-item ${activePage === 'reset' ? 'is-active' : ''}`}
            onClick={() => setActivePage('reset')}
          >
            Reinitialiser donnees
          </button>
          <button
            type="button"
            className={`bo-nav-item ${activePage === 'orders' ? 'is-active' : ''}`}
            onClick={() => setActivePage('orders')}
          >
            Commandes
          </button>
          <button
            type="button"
            className={`bo-nav-item ${activePage === 'stats' ? 'is-active' : ''}`}
            onClick={() => setActivePage('stats')}
          >
            Statistiques
          </button>
          <button
            type="button"
            className={`bo-nav-item ${activePage === 'csv' ? 'is-active' : ''}`}
            onClick={() => setActivePage('csv')}
          >
            Import CSV
          </button>
          <button
            type="button"
            className={`bo-nav-item ${activePage === 'stock' ? 'is-active' : ''}`}
            onClick={() => setActivePage('stock')}
          >
            Gestion stock
          </button>
          <button
            type="button"
            className={`bo-nav-item ${activePage === 'profit' ? 'is-active' : ''}`}
            onClick={() => setActivePage('profit')}
          >
            Bénéfices
          </button>
        </nav>

        <div className="bo-sidebar__section">
          <button
            type="button"
            className="bo-button"
            onClick={handleTestApi}
            disabled={isTesting}
          >
            {isTesting ? 'Test en cours...' : 'Tester API'}
          </button>
          {apiStatus ? (
            <p
              className={`bo-status ${apiStatus.ok ? 'bo-status--ok' : 'bo-status--error'}`}
            >
              {apiStatus.ok ? 'Connexion OK' : 'Connexion KO'}
              {apiStatus.data?.error ? ` - ${apiStatus.data.error}` : ''}
              {apiStatus.status ? ` (HTTP ${apiStatus.status})` : ''}
            </p>
          ) : null}
        </div>

        <button className="bo-button bo-button--ghost" onClick={onLogout}>
          Sign out
        </button>
      </aside>

      {activePage === 'reset' && <ResetDataPage />}
      {activePage === 'orders' && <OrdersPage />}
      {activePage === 'stats' && <DashboardStatsPage />}
      {activePage === 'csv' && <CSVImportPage />}
      {activePage === 'stock' && <StockPage />}
      {activePage === 'profit' && <ProfitStatsPage />}
    </main>
  )
}

export default Dashboard
