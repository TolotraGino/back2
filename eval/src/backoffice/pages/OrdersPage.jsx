import { useEffect, useMemo, useState } from 'react'
import { OrderService } from '../services/OrderService.js'
import { Order } from '../models/Order.js'
import { ORDER_STATUS_OPTIONS } from '../constants/orderStates.js'

const orderService = new OrderService()

function resolveStatusKey(currentStateId) {
  const match = Object.entries(ORDER_STATUS_OPTIONS).find(([, value]) => value.id === currentStateId)
  return match ? match[0] : 'paiement_effectue'
}

function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const statusEntries = useMemo(() => Object.entries(ORDER_STATUS_OPTIONS), [])

  useEffect(() => {
    const loadOrders = async () => {
      setIsLoading(true)
      setError('')
      const result = await orderService.fetchOrders()
      if (!result.ok) {
        setError(`Erreur chargement commandes (HTTP ${result.status})`)
        setIsLoading(false)
        return
      }

      const withStatus = result.data.map((order) => ({
        orderModel: order,
        statusKey: resolveStatusKey(order.currentStateId),
      }))
      setOrders(withStatus)
      setIsLoading(false)
    }

    loadOrders()
  }, [])

  const handleStatusChange = async (orderId, nextStatusKey) => {
    const nextStateId = ORDER_STATUS_OPTIONS[nextStatusKey].id
    const response = await orderService.updateOrderState(orderId, nextStateId)
    if (!response.ok) {
      const details = response.errorText ? ` - ${response.errorText}` : ''
      setError(`Erreur mise a jour (HTTP ${response.status})${details}`)
      return
    }

    setOrders((prev) =>
      prev.map((item) =>
        item.orderModel.id === orderId
          ? {
              ...item,
              statusKey: nextStatusKey,
              orderModel: new Order({ ...item.orderModel, currentStateId: nextStateId }),
            }
          : item,
      ),
    )
  }

  return (
    <section className="bo-content">
      <header className="bo-content__header">
        <h2>Commandes</h2>
        <p className="bo-muted">Afficher les commandes et modifier l'etat.</p>
      </header>

      {error ? <p className="bo-error">{error}</p> : null}
      {isLoading ? <p className="bo-muted">Chargement...</p> : null}

      <div className="bo-table">
        <div className="bo-table__head">
          <span>ID</span>
          <span>Reference</span>
          <span>Client</span>
          <span>Total</span>
          <span>Paiement</span>
          <span>Date</span>
          <span>Etat</span>
        </div>

        {orders.map((item) => (
          <div className="bo-table__row" key={item.orderModel.id}>
            <span>{item.orderModel.id}</span>
            <span>{item.orderModel.reference}</span>
            <span>{item.orderModel.customer}</span>
            <span>{item.orderModel.total}</span>
            <span>{item.orderModel.payment}</span>
            <span>{item.orderModel.getDisplayDate()}</span>
            <select
              className="bo-select"
              value={item.statusKey}
              onChange={(event) => handleStatusChange(item.orderModel.id, event.target.value)}
            >
              {statusEntries.map(([value, info]) => (
                <option key={value} value={value}>
                  {info.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </section>
  )
}

export default OrdersPage
