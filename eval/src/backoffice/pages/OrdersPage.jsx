import { useEffect, useState } from 'react'
import { OrderService } from '../services/OrderService.js'
import { Order } from '../models/Order.js'
import { ORDER_STATES, ORDER_STATE_META } from '../constants/orderStates.js'

const orderService = new OrderService()

function StateBadge({ stateId }) {
  const meta = ORDER_STATE_META[stateId] ?? { label: `Etat ${stateId}`, color: '#6b7280', bg: '#f9fafb' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 600,
      color: meta.color,
      background: meta.bg,
      border: `1px solid ${meta.color}33`,
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(null) // id de la commande en cours de MAJ

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
      setOrders(result.data)
      setIsLoading(false)
    }
    loadOrders()
  }, [])

  const handleTransition = async (orderId, nextStateId) => {
    setUpdating(orderId)
    setError('')
    const response = await orderService.updateOrderState(orderId, nextStateId)
    if (!response.ok) {
      setError(`Erreur mise a jour commande #${orderId} (HTTP ${response.status})`)
      setUpdating(null)
      return
    }
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? new Order({ ...order, currentStateId: nextStateId })
          : order
      )
    )
    setUpdating(null)
  }

  return (
    <section className="bo-content">
      <header className="bo-content__header">
        <h2>Commandes</h2>
        <p className="bo-muted">
          Gerer les etats des commandes.
          Le stock diminue uniquement quand une commande passe a <strong>Livre</strong>.
        </p>
      </header>

      {error ? <p className="bo-error">{error}</p> : null}
      {isLoading ? <p className="bo-muted">Chargement...</p> : null}

      <div style={{ overflowX: 'auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '60px 110px 80px 90px 1fr 100px 140px 180px',
          gap: '10px',
          alignItems: 'center',
          fontWeight: 600,
          fontSize: '13px',
          color: 'var(--muted)',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '8px',
          marginBottom: '6px',
          minWidth: '860px',
        }}>
          <span>ID</span>
          <span>Reference</span>
          <span>Client</span>
          <span>Total</span>
          <span>Paiement</span>
          <span>Date</span>
          <span>Etat</span>
          <span>Actions</span>
        </div>

        <div style={{ display: 'grid', gap: '6px', minWidth: '860px' }}>
          {orders.map((order) => {
            const isBusy = updating === order.id
            const state  = order.currentStateId
            const isFinal = state === ORDER_STATES.DELIVERED || state === ORDER_STATES.CANCELLED
            const isCart  = state === ORDER_STATES.CART_ONLY

            return (
              <div
                key={order.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 110px 80px 90px 1fr 100px 140px 180px',
                  gap: '10px',
                  alignItems: 'center',
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '14px',
                  opacity: isBusy ? 0.6 : 1,
                }}
              >
                <span className="bo-muted">{order.id}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{order.reference}</span>
                <span className="bo-muted">{order.customer}</span>
                <span style={{ fontWeight: 600 }}>{order.total}</span>
                <span className="bo-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.payment}</span>
                <span className="bo-muted" style={{ fontSize: '12px' }}>{order.getDisplayDate()}</span>
                <StateBadge stateId={state} />

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {!isFinal && !isCart && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleTransition(order.id, ORDER_STATES.DELIVERED)}
                        style={{
                          fontSize: '11px', padding: '4px 10px', cursor: 'pointer',
                          background: '#f0fdf4', color: '#166534',
                          border: '1px solid #166534', borderRadius: '6px',
                          fontWeight: 600,
                        }}
                        title="Marquer comme livre — diminue le stock"
                      >
                        Livrer
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleTransition(order.id, ORDER_STATES.CANCELLED)}
                        style={{
                          fontSize: '11px', padding: '4px 10px', cursor: 'pointer',
                          background: '#fef2f2', color: '#b91c1c',
                          border: '1px solid #b91c1c', borderRadius: '6px',
                          fontWeight: 600,
                        }}
                      >
                        Annuler
                      </button>
                    </>
                  )}
                  {isFinal && (
                    <span className="bo-muted" style={{ fontSize: '12px' }}>—</span>
                  )}
                  {isCart && (
                    <span className="bo-muted" style={{ fontSize: '12px' }}>Panier seul</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default OrdersPage
