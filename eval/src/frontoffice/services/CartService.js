export class CartService {
  constructor({
    cartKey = 'fo_cart',
    customerKey = 'fo_customer',
    tokenKey = 'fo_customer_token',
    cartEventName = 'fo-cart-updated',
  } = {}) {
    this.cartKey = cartKey
    this.customerKey = customerKey
    this.tokenKey = tokenKey
    this.cartEventName = cartEventName
    this.isBrowser = typeof window !== 'undefined'
  }

  safeParse(raw, fallback) {
    if (!raw) return fallback
    try {
      return JSON.parse(raw)
    } catch {
      return fallback
    }
  }

  getLineId(item) {
    return `${item.id}-${item.attributeId || 0}`
  }

  normalizeCart(cart) {
    return cart.map((entry) => ({
      ...entry,
      lineId: entry.lineId || this.getLineId(entry),
    }))
  }

  notifyCartUpdated() {
    if (!this.isBrowser) return
    window.dispatchEvent(new Event(this.cartEventName))
  }

  loadCart() {
    if (!this.isBrowser) return []
    return this.normalizeCart(this.safeParse(window.localStorage.getItem(this.cartKey), []))
  }

  saveCart(cart) {
    if (!this.isBrowser) return
    const normalized = this.normalizeCart(cart)
    window.localStorage.setItem(this.cartKey, JSON.stringify(normalized))
    this.notifyCartUpdated()
  }

  getCartCount(cart = this.loadCart()) {
    return cart.reduce((total, item) => total + Number(item.quantity || 0), 0)
  }

  addToCart(item, quantity = 1) {
    const cart = this.loadCart()
    const nextQty = Math.max(1, Number.parseInt(quantity, 10) || 1)
    const lineId = this.getLineId(item)
    const existing = cart.find((entry) => entry.lineId === lineId)
    if (existing) existing.quantity = Number(existing.quantity || 0) + nextQty
    else cart.push({ ...item, quantity: nextQty, lineId })
    this.saveCart(cart)
    return cart
  }

  updateCartItem(lineId, quantity) {
    const cart = this.loadCart()
    const nextQty = Math.max(1, Number.parseInt(quantity, 10) || 1)
    const updated = cart.map((entry) => (entry.lineId === lineId ? { ...entry, quantity: nextQty } : entry))
    this.saveCart(updated)
    return updated
  }

  removeCartItem(lineId) {
    const cart = this.loadCart().filter((entry) => entry.lineId !== lineId)
    this.saveCart(cart)
    return cart
  }

  clearCart() {
    this.saveCart([])
  }

  loadCustomer() {
    if (!this.isBrowser) return null
    return this.safeParse(window.localStorage.getItem(this.customerKey), null)
  }

  saveCustomer(customer) {
    if (!this.isBrowser) return
    window.localStorage.setItem(this.customerKey, JSON.stringify(customer))
  }

  clearCustomer() {
    if (!this.isBrowser) return
    window.localStorage.removeItem(this.customerKey)
  }

  loadToken() {
    if (!this.isBrowser) return ''
    return window.localStorage.getItem(this.tokenKey) || ''
  }

  saveToken(token) {
    if (!this.isBrowser) return
    window.localStorage.setItem(this.tokenKey, token)
  }

  clearToken() {
    if (!this.isBrowser) return
    window.localStorage.removeItem(this.tokenKey)
  }

  createToken() {
    const random = Math.random().toString(36).slice(2)
    const stamp = Date.now().toString(36)
    return `${random}${stamp}`
  }
}
