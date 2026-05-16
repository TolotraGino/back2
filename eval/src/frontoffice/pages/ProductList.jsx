import { useEffect, useMemo, useState } from 'react'
import { apiRequestRaw } from '../../services/apiService.js'
import { ProductBadgeService } from '../services/ProductBadgeService.js'
import { ProductFilterService } from '../services/ProductFilterService.js'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const API_TOKEN = import.meta.env.VITE_API_TOKEN || ''

const buildImageUrl = (productId, imageId) => {
  if (!productId || !imageId) return ''
  const url = `${API_BASE}/images/products/${productId}/${imageId}`
  return API_TOKEN ? `${url}?ws_key=${API_TOKEN}` : url
}

const roundPrice = (value) => {
  const num = Number.parseFloat(String(value || '0').replace(',', '.'))
  if (Number.isNaN(num)) return '0.00'
  return num.toFixed(2)
}

const getXmlText = (node, selector) => node.querySelector(selector)?.textContent?.trim() || ''
const productBadgeService = new ProductBadgeService()
const productFilterService = new ProductFilterService()

const extractProductFromXml = async (productNode) => {
  const id = getXmlText(productNode, 'id')
  const name = getXmlText(productNode, 'name > language')
  const reference = getXmlText(productNode, 'reference')
  const priceHt = getXmlText(productNode, 'price')
  const taxGroupId = getXmlText(productNode, 'id_tax_rules_group') || '1'
  const categoryId = getXmlText(productNode, 'id_category_default')
  const imageId = getXmlText(productNode, 'associations > images > image > id')
  const availableDate = getXmlText(productNode, 'available_date')

  const stockResponse = await apiRequestRaw(`/stock_availables/?filter[id_product]=[${id}]&display=full`)
  let quantity = '0'
  if (stockResponse.ok) {
    const stockDoc = new DOMParser().parseFromString(stockResponse.text, 'application/xml')
    quantity = getXmlText(stockDoc, 'stock_available quantity') || getXmlText(stockDoc, 'stock_available > quantity') || '0'
  }

  let categoryName = categoryId
  if (categoryId) {
    const categoryResponse = await apiRequestRaw(`/categories/${categoryId}`)
    if (categoryResponse.ok) {
      const categoryDoc = new DOMParser().parseFromString(categoryResponse.text, 'application/xml')
      const categoryNode = categoryDoc.querySelector('category')
      const langNode = categoryNode?.querySelector('name > language')
      categoryName = langNode?.textContent?.trim() || categoryName
    }
  }

  const taxGroupResponse = await apiRequestRaw(`/tax_rule_groups/${taxGroupId}`)
  let taxRate = 0
  if (taxGroupResponse.ok) {
    const taxDoc = new DOMParser().parseFromString(taxGroupResponse.text, 'application/xml')
    const taxGroupNode = taxDoc.querySelector('tax_rule_group')
    const taxRuleId = getXmlText(taxGroupNode || taxDoc, 'tax_rule > id')
    if (taxRuleId) {
      const taxRuleResponse = await apiRequestRaw(`/tax_rules/${taxRuleId}`)
      if (taxRuleResponse.ok) {
        const taxRuleDoc = new DOMParser().parseFromString(taxRuleResponse.text, 'application/xml')
        const taxId = getXmlText(taxRuleDoc, 'tax_rule > id_tax')
        if (taxId) {
          const taxResponse = await apiRequestRaw(`/taxes/${taxId}`)
          if (taxResponse.ok) {
            const taxDoc = new DOMParser().parseFromString(taxResponse.text, 'application/xml')
            taxRate = Number.parseFloat(getXmlText(taxDoc, 'tax > rate')) || 0
          }
        }
      }
    }
  }

  const priceTtc = roundPrice(Number.parseFloat(priceHt || '0') * (1 + taxRate / 100))
  const imageUrl = buildImageUrl(id, imageId)
  const badge = productBadgeService.resolveBadge(availableDate)

  return { id, name, reference, category: categoryName, priceHt: roundPrice(priceHt), priceTtc, quantity, imageUrl, availableDate, badge }
}

  

  export default function ProductList() {
    const [products, setProducts] = useState([])
    const [nameQuery, setNameQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('')
    const [minPrice, setMinPrice] = useState('')
    const [maxPrice, setMaxPrice] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
      const fetchProducts = async () => {
        setLoading(true)
        setError('')
        try {
          const res = await apiRequestRaw('/products/?display=full')
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const parser = new DOMParser()
          const doc = parser.parseFromString(res.text, 'application/xml')
          const items = Array.from(doc.querySelectorAll('product'))
          const list = await Promise.all(items.map(extractProductFromXml))
          setProducts(list)
        } catch (err) {
          setError(err.message)
        } finally {
          setLoading(false)
        }
      }

      fetchProducts()
    }, [])

    const categories = useMemo(() => {
      const unique = Array.from(new Set(products.map((p) => String(p.category || '').trim()).filter(Boolean)))
      return unique.sort((a, b) => a.localeCompare(b))
    }, [products])

    const filteredProducts = useMemo(() => (
      productFilterService.filterProducts(products, {
        nameQuery,
        category: selectedCategory,
        minPrice,
        maxPrice,
      })
    ), [products, nameQuery, selectedCategory, minPrice, maxPrice])

    if (loading) return <div className="fo-loader">Chargement des produits...</div>
  if (error) return <p className="fo-error">Erreur: {error}</p>

  return (
    <section className="fo-main-container">
      <h2 className="fo-section-title">PRODUITS POPULAIRES</h2>
      <div className="fo-product-filters">
        <input
          className="fo-filter-input"
          type="text"
          placeholder="Rechercher par nom"
          value={nameQuery}
          onChange={(event) => setNameQuery(event.target.value)}
        />
        <select
          className="fo-filter-input"
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
        >
          <option value="">Toutes les categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <input
          className="fo-filter-input"
          type="number"
          min="0"
          step="0.01"
          placeholder="Prix min"
          value={minPrice}
          onChange={(event) => setMinPrice(event.target.value)}
        />
        <input
          className="fo-filter-input"
          type="number"
          min="0"
          step="0.01"
          placeholder="Prix max"
          value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)}
        />
      </div>
      
      <div className="fo-grid">
        {filteredProducts.map((p, index) => (
          <article key={`${p.id}-${index}`} className="fo-product-card" onClick={() => window.location.href = `/product/${p.id}`}>
            <div className="fo-thumbnail-container">
              {p.badge && (
                <div className="fo-flags">
                  <span className={p.badge.className}>{p.badge.code}</span>
                </div>
              )}

              {p.imageUrl ? (
                <img className="fo-product-img" src={p.imageUrl} alt={p.name} />
              ) : (
                <div className="fo-product-img-placeholder">Image non disponible</div>
              )}
              
              <div className="fo-quick-view">
                <span>Aperçu rapide</span>
              </div>
            </div>

            <div className="fo-product-description">
              <h3 className="fo-product-name">{p.name}</h3>
              <div className="fo-product-price-and-shipping">
                <span className="fo-price-regular">{p.priceHt} €</span>
                <span className="fo-price-current">{p.priceTtc} €</span>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!filteredProducts.length && <p className="fo-empty-search">Aucun produit pour ces criteres.</p>}
    </section>
    )
  }
