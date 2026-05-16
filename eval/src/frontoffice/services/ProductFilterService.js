export class ProductFilterService {
  normalizeText(value) {
    return String(value || '').trim().toLowerCase()
  }

  toNumber(value) {
    const parsed = Number.parseFloat(String(value || '').replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }

  matchesName(product, query) {
    const q = this.normalizeText(query)
    if (!q) return true
    const name = this.normalizeText(product.name)
    return name.includes(q)
  }

  matchesCategory(product, category) {
    const selected = this.normalizeText(category)
    if (!selected) return true
    return this.normalizeText(product.category) === selected
  }

  matchesPriceRange(product, minPrice, maxPrice) {
    const price = this.toNumber(product.priceTtc)
    if (price === null) return false

    const min = this.toNumber(minPrice)
    const max = this.toNumber(maxPrice)

    if (min !== null && price < min) return false
    if (max !== null && price > max) return false
    return true
  }

  filterProducts(products, { nameQuery = '', category = '', minPrice = '', maxPrice = '' } = {}) {
    return products.filter((product) =>
      this.matchesName(product, nameQuery)
      && this.matchesCategory(product, category)
      && this.matchesPriceRange(product, minPrice, maxPrice),
    )
  }
}
