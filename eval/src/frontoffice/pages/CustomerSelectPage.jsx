import { useEffect, useState } from 'react'
import { FrontCustomer } from '../models/FrontCustomer.js'
import { CustomerDirectoryService } from '../services/CustomerDirectoryService.js'

const customerDirectoryService = new CustomerDirectoryService()

export default function CustomerSelectPage({ onSelectCustomer }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadCustomers = async () => {
      setLoading(true)
      setError('')
      const result = await customerDirectoryService.listCustomers()
      if (!result.ok) {
        setError(`Erreur chargement utilisateurs (HTTP ${result.status})`)
        setLoading(false)
        return
      }
      setCustomers(result.data)
      setLoading(false)
    }

    loadCustomers()
  }, [])

  return (
    <section className="fo-select-page">
      <div className="fo-select-card">
        <h2>Choisir un utilisateur</h2>
        <p className="fo-select-subtitle">Selectionne un utilisateur existant pour te connecter.</p>

        <button
          type="button"
          className="fo-select-anonymous"
          onClick={() => onSelectCustomer(FrontCustomer.anonymous())}
        >
          Continuer en utilisateur anonyme
        </button>

        {loading ? <p>Chargement des utilisateurs...</p> : null}
        {error ? <p className="fo-login-error">{error}</p> : null}

        <div className="fo-select-list">
          {customers.map((customer) => (
            <button
              key={customer.id || customer.email}
              type="button"
              className="fo-select-item"
              onClick={() => onSelectCustomer(customer)}
            >
              <strong>{customer.getDisplayName()}</strong>
              <span>{customer.email}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
