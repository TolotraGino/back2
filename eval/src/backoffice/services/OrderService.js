import { createApiClient } from '../../services/apiService.js'
import { Order } from '../models/Order.js'
import { parseXml } from '../../shared/xml/xmlUtils.js'

const CSV_ORDER_DATE_MAP_KEY = 'bo_csv_order_date_map_v1'

export class OrderService {
  constructor(apiClient = createApiClient()) {
    this.apiClient = apiClient
  }

  loadCsvOrderDateMap() {
    try {
      const raw = localStorage.getItem(CSV_ORDER_DATE_MAP_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  getText(node, tag) {
    const target = node.getElementsByTagName(tag)[0]
    return target ? target.textContent : ''
  }

  parseOrderList(xmlText) {
    const doc = parseXml(xmlText)
    const container = doc.getElementsByTagName('orders')[0]
    if (!container) return []
    return Array.from(container.getElementsByTagName('order'))
      .map((item) => Number.parseInt(item.getAttribute('id'), 10))
      .filter((id) => Number.isFinite(id))
  }

  parseOrderDetail(xmlText, csvMap = {}) {
    const doc = parseXml(xmlText)
    const order = doc.getElementsByTagName('order')[0]
    if (!order) return null

    const id = Number.parseInt(this.getText(order, 'id'), 10)
    return new Order({
      id,
      reference: this.getText(order, 'reference'),
      customer: this.getText(order, 'id_customer'),
      total: this.getText(order, 'total_paid_tax_incl'),
      payment: this.getText(order, 'payment'),
      date: this.getText(order, 'date_add'),
      currentStateId: Number.parseInt(this.getText(order, 'current_state'), 10),
      csvDate: csvMap[String(id)] || '',
    })
  }

  async fetchOrders() {
    const listResponse = await this.apiClient.requestRaw('/orders/')
    if (!listResponse.ok) return { ok: false, status: listResponse.status, data: [] }

    const ids = this.parseOrderList(listResponse.text)
    const details = []
    for (let i = 0; i < ids.length; i += 3) {
      const batch = await Promise.all(ids.slice(i, i + 3).map((id) => this.apiClient.requestRaw(`/orders/${id}`)))
      details.push(...batch)
    }
    const csvMap = this.loadCsvOrderDateMap()
    const orders = details
      .filter((response) => response.ok)
      .map((response) => this.parseOrderDetail(response.text, csvMap))
      .filter(Boolean)

    return { ok: true, status: 200, data: orders }
  }

  // Utilise le module mon_order_state : POST /api/order_state_update
  // Déclenche changeIdOrderState() côté PS → stock diminue à l'état 5 (Livré)
  async updateOrderState(orderId, nextStateId) {
    const payload = { id_order: orderId, id_order_state: nextStateId }

    console.group(`[OrderService] updateOrderState — commande #${orderId} → état ${nextStateId}`)
    console.log('→ Requête envoyée :', payload)

    const response = await this.apiClient.requestRaw('/order_state_update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    console.log(`← Réponse HTTP ${response.status} (${response.ok ? 'OK' : 'ERREUR'})`)
    console.log('← Corps de la réponse :', response.text)
    console.groupEnd()

    return { ok: response.ok, status: response.status, errorText: response.text }
  }

  groupByDay(orders = []) {
    const grouped = orders.reduce((acc, order) => {
      const day = order.getDay()
      if (!day) return acc
      if (!acc[day]) acc[day] = { day, count: 0, amount: 0 }
      acc[day].count += 1
      acc[day].amount += order.getAmountNumber()
      return acc
    }, {})
    return Object.values(grouped).sort((a, b) => b.day.localeCompare(a.day))
  }
}
