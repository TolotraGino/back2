import { useEffect, useState } from 'react'
import { apiRequestRaw } from '../../services/apiService.js'
import { addToCart } from '../services/cartService.js'

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

export default function ProductPage({ id }) {
  const [product, setProduct] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [addMessage, setAddMessage] = useState('')
  const [combinations, setCombinations] = useState([])
  const [attributeGroups, setAttributeGroups] = useState([])
  const [selectedAttributes, setSelectedAttributes] = useState({})
  const [selectedCombination, setSelectedCombination] = useState(null)
  const [combinationStock, setCombinationStock] = useState(null)

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiRequestRaw(`/products/${id}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const parser = new DOMParser()
        const doc = parser.parseFromString(res.text, 'application/xml')
        const p = doc.querySelector('product')
        if (!p) throw new Error('Produit introuvable')
        const name = getXmlText(p, 'name > language')
        const desc = getXmlText(p, 'description > language')
        const priceHt = getXmlText(p, 'price')
        const reference = getXmlText(p, 'reference')
        const imageId = getXmlText(p, 'associations > images > image > id')
        const categoryId = getXmlText(p, 'id_category_default')
        const taxGroupId = getXmlText(p, 'id_tax_rules_group') || '1'

        let quantity = '0'
        const stockResponse = await apiRequestRaw(`/stock_availables/?filter[id_product]=[${id}]&display=full`)
        if (stockResponse.ok) {
          const stockDoc = new DOMParser().parseFromString(stockResponse.text, 'application/xml')
          quantity = getXmlText(stockDoc, 'stock_available > quantity') || '0'
        }

        let categoryName = categoryId
        if (categoryId) {
          const categoryResponse = await apiRequestRaw(`/categories/${categoryId}`)
          if (categoryResponse.ok) {
            const categoryDoc = new DOMParser().parseFromString(categoryResponse.text, 'application/xml')
            categoryName = getXmlText(categoryDoc, 'category > name > language') || categoryName
          }
        }

        let taxRate = 0
        const taxGroupResponse = await apiRequestRaw(`/tax_rule_groups/${taxGroupId}`)
        if (taxGroupResponse.ok) {
          const taxGroupDoc = new DOMParser().parseFromString(taxGroupResponse.text, 'application/xml')
          const taxRuleId = getXmlText(taxGroupDoc, 'tax_rule_group > tax_rule > id')
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
        setProduct({
          id,
          name,
          desc,
          priceHt: roundPrice(priceHt),
          priceTtc,
          reference,
          imageUrl,
          category: categoryName,
          quantity,
          taxRate,
          basePriceHt: Number.parseFloat(priceHt || '0') || 0,
        })

        const comboResponse = await apiRequestRaw(`/combinations/?filter[id_product]=[${id}]&display=full`)
        if (comboResponse.ok) {
          const comboDoc = parser.parseFromString(comboResponse.text, 'application/xml')
          const comboNodes = Array.from(comboDoc.querySelectorAll('combination'))
          const nextCombinations = comboNodes.map((node) => {
            const comboId = getXmlText(node, 'id') || node.getAttribute('id')
            const comboPrice = Number.parseFloat(getXmlText(node, 'price') || '0') || 0
            const comboRef = getXmlText(node, 'reference')
            const valueNodes = Array.from(node.querySelectorAll('associations > product_option_values > product_option_value > id'))
            const attributeValueIds = valueNodes.map((val) => val.textContent.trim()).filter(Boolean)
            return { id: comboId, priceImpact: comboPrice, reference: comboRef, attributeValueIds }
          })

          if (nextCombinations.length > 0) {
            const valueIdSet = new Set()
            nextCombinations.forEach((combo) => combo.attributeValueIds.forEach((val) => valueIdSet.add(val)))
            const valueIds = Array.from(valueIdSet)

            const valueMap = {}
            for (const valueId of valueIds) {
              const valueResponse = await apiRequestRaw(`/product_option_values/${valueId}`)
              if (!valueResponse.ok) continue
              const valueDoc = parser.parseFromString(valueResponse.text, 'application/xml')
              const valueNode = valueDoc.querySelector('product_option_value')
              if (!valueNode) continue
              valueMap[valueId] = {
                id: valueId,
                name: getXmlText(valueNode, 'name > language'),
                groupId: getXmlText(valueNode, 'id_attribute_group'),
              }
            }

            const groupIdSet = new Set(valueIds.map((valueId) => valueMap[valueId]?.groupId).filter(Boolean))
            const groupIds = Array.from(groupIdSet)
            const groupMap = {}
            for (const groupId of groupIds) {
              const groupResponse = await apiRequestRaw(`/product_options/${groupId}`)
              if (!groupResponse.ok) continue
              const groupDoc = parser.parseFromString(groupResponse.text, 'application/xml')
              const groupNode = groupDoc.querySelector('product_option')
              if (!groupNode) continue
              groupMap[groupId] = {
                id: groupId,
                name: getXmlText(groupNode, 'name > language') || `Groupe ${groupId}`,
                values: [],
              }
            }

            valueIds.forEach((valueId) => {
              const value = valueMap[valueId]
              if (!value?.groupId || !groupMap[value.groupId]) return
              if (!groupMap[value.groupId].values.find((val) => val.id === value.id)) {
                groupMap[value.groupId].values.push({ id: value.id, name: value.name })
              }
            })

            const groups = Object.values(groupMap).map((group) => ({
              ...group,
              values: group.values.sort((a, b) => a.name.localeCompare(b.name)),
            }))

            const defaults = {}
            groups.forEach((group) => {
              if (group.values.length > 0) defaults[group.id] = group.values[0].id
            })

            setCombinations(nextCombinations)
            setAttributeGroups(groups)
            setSelectedAttributes(defaults)
          } else {
            setCombinations([])
            setAttributeGroups([])
            setSelectedAttributes({})
          }
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [id])

  // ... (garder tout le début du code identique : buildImageUrl, roundPrice, useEffect, etc.)

  useEffect(() => {
    if (combinations.length === 0 || attributeGroups.length === 0) {
      setSelectedCombination(null)
      setCombinationStock(null)
      return
    }

    const selectedValueIds = Object.values(selectedAttributes).filter(Boolean)
    const matched = combinations.find((combo) =>
      selectedValueIds.every((valueId) => combo.attributeValueIds.includes(valueId))
    )

    setSelectedCombination(matched || null)
  }, [combinations, attributeGroups, selectedAttributes])

  useEffect(() => {
    const fetchStock = async () => {
      if (!selectedCombination?.id) {
        setCombinationStock(null)
        return
      }
      const response = await apiRequestRaw(
        `/stock_availables/?filter[id_product]=[${id}]&filter[id_product_attribute]=[${selectedCombination.id}]&display=full`
      )
      if (!response.ok) {
        setCombinationStock(null)
        return
      }
      const stockDoc = new DOMParser().parseFromString(response.text, 'application/xml')
      const qty = getXmlText(stockDoc, 'stock_available > quantity')
      setCombinationStock(qty || '0')
    }

    fetchStock()
  }, [id, selectedCombination])

  const handleAddToCart = () => {
    if (!product) return
    const nextQty = Math.max(1, Number.parseInt(quantity, 10) || 1)
    const priceImpact = selectedCombination?.priceImpact || 0
    const priceHt = product.basePriceHt + priceImpact
    const priceTtc = priceHt * (1 + (product.taxRate || 0) / 100)
    const attributeLabel = attributeGroups
      .map((group) => {
        const selectedId = selectedAttributes[group.id]
        const selectedValue = group.values.find((val) => val.id === selectedId)
        return selectedValue ? `${group.name}: ${selectedValue.name}` : ''
      })
      .filter(Boolean)
      .join(', ')

    addToCart(
      {
        id: product.id,
        name: product.name,
        reference: product.reference,
        priceTtc: Number.isNaN(priceTtc) ? 0 : Number.parseFloat(priceTtc.toFixed(2)),
        priceHt: Number.isNaN(priceHt) ? 0 : Number.parseFloat(priceHt.toFixed(2)),
        imageUrl: product.imageUrl,
        attributeId: selectedCombination?.id || 0,
        attributeLabel,
      },
      nextQty
    )
    window.location.href = '/cart'
  }

  if (loading) return <div className="ps-loader">Chargement du produit...</div>
  if (error) return <div className="ps-error">{error}</div>
  if (!product) return null

  const priceImpact = selectedCombination?.priceImpact || 0
  const displayPriceHt = product.basePriceHt + priceImpact
  const displayPriceTtc = roundPrice(displayPriceHt * (1 + (product.taxRate || 0) / 100))
  const parsedAvailableQty = selectedCombination
    ? Number.parseInt(combinationStock || '0', 10)
    : Number.parseInt(product.quantity || '0', 10)
  const availableQty = Number.isFinite(parsedAvailableQty) ? Math.max(0, parsedAvailableQty) : 0

  return (
    <div className="ps-product-container">
      {/* Fil d'Ariane / Retour */}
      <nav className="ps-breadcrumb">
        <a href="/shop">Accueil</a> <span>/</span> 
        <a href="#">{product.category}</a> <span>/</span> 
        {product.name}
      </nav>

      <div className="ps-product-main">
        {/* Colonne Gauche : Image */}
        <div className="ps-product-left">
          <div className="ps-image-wrapper">
            {product.imageUrl ? (
              <img className="ps-main-image" src={product.imageUrl} alt={product.name} />
            ) : (
              <div className="ps-image-placeholder">Aucune image disponible</div>
            )}
          </div>
        </div>

        {/* Colonne Droite : Infos et Achat */}
        <div className="ps-product-right">
          <h1 className="ps-product-title">{product.name}</h1>
          
          <div className="ps-product-prices">
            <div className="ps-current-price">{displayPriceTtc} €</div>
            <div className="ps-tax-label">TTC (Hors frais de port)</div>
          </div>

          <div className="ps-product-description-short">
             <div dangerouslySetInnerHTML={{ __html: product.desc }} />
          </div>

          <div className="ps-product-actions">
            <div className="ps-stock-status">
              <span className={`ps-dot ${availableQty > 0 ? 'instock' : 'outstock'}`}></span>
              {availableQty > 0 ? `${availableQty} articles en stock` : 'Rupture de stock'}
            </div>

            {attributeGroups.length > 0 && (
              <div className="ps-variant-groups">
                {attributeGroups.map((group) => (
                  <label key={group.id} className="ps-variant-group">
                    <span>{group.name}</span>
                    <select
                      value={selectedAttributes[group.id] || ''}
                      onChange={(event) =>
                        setSelectedAttributes((prev) => ({
                          ...prev,
                          [group.id]: event.target.value,
                        }))
                      }
                    >
                      {group.values.map((value) => (
                        <option key={value.id} value={value.id}>
                          {value.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}

            <div className="ps-add-to-cart-row">
              <input
                type="number"
                value={quantity}
                min="1"
                className="ps-input-qty"
                onChange={(event) => setQuantity(event.target.value)}
              />
              <button className="ps-btn-primary" disabled={availableQty <= 0} onClick={handleAddToCart}>
                AJOUTER AU PANIER
              </button>
            </div>
            {addMessage && <p className="fo-cart-feedback">{addMessage}</p>}
          </div>

          <div className="ps-product-meta">
            <p><strong>Quantite disponible :</strong> {availableQty}</p>
            <p><strong>Référence :</strong> {product.reference}</p>
            <p><strong>Catégorie :</strong> {product.category}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
