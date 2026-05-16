import { createApiClient } from '../../services/apiService.js'
import { Order } from '../models/Order.js'
import { parseXml, serializeXml } from '../../shared/xml/xmlUtils.js'

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
    const details = await Promise.all(ids.map((id) => this.apiClient.requestRaw(`/orders/${id}`)))
    const csvMap = this.loadCsvOrderDateMap()
    const orders = details
      .filter((response) => response.ok)
      .map((response) => this.parseOrderDetail(response.text, csvMap))
      .filter(Boolean)

    return { ok: true, status: 200, data: orders }
  }

  async updateOrderState(orderId, nextStateId) {
    const detailResponse = await this.apiClient.requestRaw(`/orders/${orderId}`)
    if (!detailResponse.ok) {
      return { ok: false, status: detailResponse.status, errorText: detailResponse.text }
    }

    const doc = parseXml(detailResponse.text)
    const order = doc.getElementsByTagName('order')[0]
    if (!order) return { ok: false, status: 0, errorText: 'Order node missing' }

    const currentState = order.getElementsByTagName('current_state')[0]
    if (currentState) {
      currentState.textContent = String(nextStateId)
      currentState.setAttribute('xlink:href', `/api/order_states/${nextStateId}`)
    }

    const body = serializeXml(doc)
    const updateResponse = await this.apiClient.requestRaw(`/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/xml' },
      body,
    })

    return { ok: updateResponse.ok, status: updateResponse.status, errorText: updateResponse.text }
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
