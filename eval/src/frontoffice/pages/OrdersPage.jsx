import { useEffect, useState } from 'react'
import { apiRequestRaw } from '../../services/apiService.js'

const parseXml = (text) => new DOMParser().parseFromString(text, 'application/xml')
const getXmlText = (node, selector) => node.querySelector(selector)?.textContent?.trim() || ''
const roundMoney = (value) => Number.parseFloat(value || 0).toFixed(2)

export default function OrdersPage({ customer }) {
  const [orders, setOrders] = useState([])
  const [states, setStates] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!customer?.id) return

    const fetchOrders = async () => {
      setLoading(true)
      setError('')

      try {
        const stateResponse = await apiRequestRaw('/order_states/?display=full')
        if (stateResponse.ok) {
          const stateDoc = parseXml(stateResponse.text)
          const stateNodes = Array.from(stateDoc.querySelectorAll('order_state'))
          const map = stateNodes.reduce((acc, node) => {
            const id = getXmlText(node, 'id') || node.getAttribute('id')
            const name = getXmlText(node, 'name > language')
            if (id) acc[id] = name
            return acc
          }, {})
          setStates(map)
        }

        const response = await apiRequestRaw(`/orders/?filter[id_customer]=[${customer.id}]&display=full`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const doc = parseXml(response.text)
        const nodes = Array.from(doc.querySelectorAll('order'))
        const list = nodes.map((node) => ({
          id: getXmlText(node, 'id') || node.getAttribute('id'),
          reference: getXmlText(node, 'reference'),
          date: getXmlText(node, 'date_add'),
          total: getXmlText(node, 'total_paid_tax_incl'),
          stateId: getXmlText(node, 'current_state'),
          payment: getXmlText(node, 'payment'),
        }))
        setOrders(list)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [customer])

  if (!customer) {
    return <p className="fo-orders-empty">Connecte-toi pour voir tes commandes.</p>
  }

  if (loading) {
    return <p className="fo-orders-empty">Chargement des commandes...</p>
  }

  if (error) {
    return <p className="fo-orders-empty">Erreur: {error}</p>
  }

  return (
    <div className="fo-orders-page">
      <h2>Mes commandes</h2>
      {orders.length === 0 ? (
        <p className="fo-orders-empty">Aucune commande.</p>
      ) : (
        <div className="fo-orders-list">
          {orders.map((order) => (
            <div key={order.id} className="fo-order-card">
              <div>
                <strong>Commande #{order.reference || order.id}</strong>
                <p className="fo-order-meta">{order.date || 'Date inconnue'}</p>
                <p className="fo-order-meta">{states[order.stateId] || `Etat ${order.stateId}`}</p>
              </div>
              <div className="fo-order-right">
                <span className="fo-order-payment">{order.payment || 'Paiement a la livraison'}</span>
                <strong>{roundMoney(order.total)} €</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
