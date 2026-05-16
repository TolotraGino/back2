import { useEffect, useMemo, useState } from 'react'
import { apiRequestRaw } from '../../services/apiService.js'
import { extractApiErrorMessage, getFirstIdFromXml, getXmlText, parseXml } from '../../shared/xml/xmlUtils.js'
import {
  clearCart,
  getCartCount,
  loadCart,
  loadToken,
  removeCartItem,
  updateCartItem,
} from '../services/cartService.js'

const DEFAULT_LANG_ID = '1'
const DEFAULT_CURRENCY_ID = '1'
const DEFAULT_SHOP_ID = '1'
const DEFAULT_SHOP_GROUP_ID = '1'
const DEFAULT_CARRIER_ID = '0'
const DEFAULT_COUNTRY_ID = '8'
const PAYMENT_LABEL = 'Paiement a la livraison'
const PAYMENT_MODULE = 'ps_cashondelivery'
const ORDER_STATE_ID_COD = '13'

const roundMoney = (value) => Number.parseFloat(value || 0).toFixed(2)

const getApiError = extractApiErrorMessage

const buildAddressXml = ({ customerId, alias, address1, postcode, city, countryId, firstname, lastname }) => {
  const safeAlias = alias || 'Livraison'
  const safeFirst = firstname || 'Client'
  const safeLast = lastname || 'Frontoffice'
  const xmlLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
    '  <address>',
    `    <id_customer>${customerId}</id_customer>`,
    `    <id_country>${countryId || DEFAULT_COUNTRY_ID}</id_country>`,
    `    <alias>${safeAlias}</alias>`,
    `    <lastname>${safeLast}</lastname>`,
    `    <firstname>${safeFirst}</firstname>`,
    `    <address1>${address1}</address1>`,
    `    <postcode>${postcode}</postcode>`,
    `    <city>${city}</city>`,
    '  </address>',
    '</prestashop>',
  ]
  return xmlLines.join('\n')
}

const buildCartXml = ({ customerId, addressId, carrierId, items }) => {
  const xmlLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
    '  <cart>',
    `    <id_address_delivery>${addressId}</id_address_delivery>`,
    `    <id_address_invoice>${addressId}</id_address_invoice>`,
    `    <id_currency>${DEFAULT_CURRENCY_ID}</id_currency>`,
    `    <id_lang>${DEFAULT_LANG_ID}</id_lang>`,
    `    <id_customer>${customerId}</id_customer>`,
    `    <id_carrier>${carrierId || DEFAULT_CARRIER_ID}</id_carrier>`,
    `    <id_shop>${DEFAULT_SHOP_ID}</id_shop>`,
    `    <id_shop_group>${DEFAULT_SHOP_GROUP_ID}</id_shop_group>`,
    '    <recyclable>0</recyclable>',
    '    <gift>0</gift>',
    '    <mobile_theme>0</mobile_theme>',
    '    <associations>',
    '      <cart_rows>',
  ]

  items.forEach((item) => {
    xmlLines.push('        <cart_row>')
    xmlLines.push(`          <id_product>${item.id}</id_product>`)
    xmlLines.push(`          <id_product_attribute>${item.attributeId || 0}</id_product_attribute>`)
    xmlLines.push(`          <quantity>${item.quantity}</quantity>`)
    xmlLines.push('        </cart_row>')
  })

  xmlLines.push('      </cart_rows>')
  xmlLines.push('    </associations>')
  xmlLines.push('  </cart>')
  xmlLines.push('</prestashop>')

  return xmlLines.join('\n')
}

const buildOrderXml = ({
  customerId,
  addressId,
  carrierId,
  cartId,
  secureKey,
  orderStateId,
  items,
  totalHt,
  totalTtc,
}) => {
  const xmlLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
    '  <order>',
    `    <id_cart>${cartId}</id_cart>`,
    `    <id_currency>${DEFAULT_CURRENCY_ID}</id_currency>`,
    `    <id_lang>${DEFAULT_LANG_ID}</id_lang>`,
    `    <id_customer>${customerId}</id_customer>`,
    `    <id_address_delivery>${addressId}</id_address_delivery>`,
    `    <id_address_invoice>${addressId}</id_address_invoice>`,
    `    <id_carrier>${carrierId || DEFAULT_CARRIER_ID}</id_carrier>`,
    `    <id_shop>${DEFAULT_SHOP_ID}</id_shop>`,
    `    <id_shop_group>${DEFAULT_SHOP_GROUP_ID}</id_shop_group>`,
    `    <current_state>${orderStateId}</current_state>`,
    `    <payment>${PAYMENT_LABEL}</payment>`,
    `    <module>${PAYMENT_MODULE}</module>`,
    `    <total_paid>${roundMoney(totalTtc)}</total_paid>`,
    `    <total_paid_tax_incl>${roundMoney(totalTtc)}</total_paid_tax_incl>`,
    `    <total_paid_tax_excl>${roundMoney(totalHt)}</total_paid_tax_excl>`,
    '    <total_paid_real>0</total_paid_real>',
    `    <total_products>${roundMoney(totalHt)}</total_products>`,
    `    <total_products_wt>${roundMoney(totalTtc)}</total_products_wt>`,
    '    <total_discounts>0</total_discounts>',
    '    <total_discounts_tax_incl>0</total_discounts_tax_incl>',
    '    <total_discounts_tax_excl>0</total_discounts_tax_excl>',
    '    <total_shipping>0</total_shipping>',
    '    <total_shipping_tax_incl>0</total_shipping_tax_incl>',
    '    <total_shipping_tax_excl>0</total_shipping_tax_excl>',
    '    <total_wrapping>0</total_wrapping>',
    '    <total_wrapping_tax_incl>0</total_wrapping_tax_incl>',
    '    <total_wrapping_tax_excl>0</total_wrapping_tax_excl>',
    '    <conversion_rate>1</conversion_rate>',
    `    <secure_key>${secureKey}</secure_key>`,
    '    <associations>',
    '      <order_rows>',
  ]

  items.forEach((item) => {
    xmlLines.push('        <order_row>')
    xmlLines.push(`          <product_id>${item.id}</product_id>`)
    xmlLines.push(`          <product_attribute_id>${item.attributeId || 0}</product_attribute_id>`)
    xmlLines.push(`          <product_quantity>${item.quantity}</product_quantity>`)
    xmlLines.push(`          <product_name>${item.name || ''}</product_name>`)
    xmlLines.push(`          <product_reference>${item.reference || ''}</product_reference>`)
    xmlLines.push(`          <product_price>${roundMoney(item.priceHt || item.priceTtc || 0)}</product_price>`)
    xmlLines.push(`          <id_tax_rules_group>${item.taxGroupId || '1'}</id_tax_rules_group>`)
    xmlLines.push(`          <unit_price_tax_incl>${roundMoney(item.priceTtc || item.priceHt || 0)}</unit_price_tax_incl>`)
    xmlLines.push(`          <unit_price_tax_excl>${roundMoney(item.priceHt || item.priceTtc || 0)}</unit_price_tax_excl>`)
    xmlLines.push('        </order_row>')
  })

  xmlLines.push('      </order_rows>')
  xmlLines.push('    </associations>')
  xmlLines.push('  </order>')
  xmlLines.push('</prestashop>')

  return xmlLines.join('\n')
}

const buildOrderHistoryXml = (orderId, orderStateId) => {
  const xmlLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
    '  <order_history>',
    `    <id_order>${orderId}</id_order>`,
    `    <id_order_state>${orderStateId}</id_order_state>`,
    '  </order_history>',
    '</prestashop>',
  ]
  return xmlLines.join('\n')
}

const getOrderReference = (orderXml) => {
  const doc = parseXml(orderXml)
  return getXmlText(doc, 'order > reference')
}

export default function CartPage({ customer }) {
  const [cart, setCart] = useState(() => loadCart())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)
  const [carriers, setCarriers] = useState([])
  const [selectedCarrierId, setSelectedCarrierId] = useState('')
  const [addressAlias, setAddressAlias] = useState('Livraison')
  const [address1, setAddress1] = useState('')
  const [postcode, setPostcode] = useState('')
  const [city, setCity] = useState('')
  const [countryId, setCountryId] = useState(DEFAULT_COUNTRY_ID)

  const totals = useMemo(() => {
    const totalTtc = cart.reduce(
      (sum, item) => sum + (Number(item.priceTtc || 0) * Number(item.quantity || 0)),
      0
    )
    const totalHt = cart.reduce(
      (sum, item) => sum + (Number(item.priceHt || item.priceTtc || 0) * Number(item.quantity || 0)),
      0
    )
    return { totalTtc, totalHt }
  }, [cart])

  useEffect(() => {
    const loadCarriers = async () => {
      const response = await apiRequestRaw('/carriers/?display=full')
      if (!response.ok) return
      const doc = parseXml(response.text)
      const nodes = Array.from(doc.querySelectorAll('carrier'))
      const list = nodes
        .map((node) => {
          const id = getXmlText(node, 'id') || node.getAttribute('id')
          return {
            id,
            name: getXmlText(node, 'name') || getXmlText(node, 'delay > language') || `Transporteur ${id}`,
            active: getXmlText(node, 'active'),
            deleted: getXmlText(node, 'deleted'),
          }
        })
        .filter((carrier) => carrier.deleted !== '1' && carrier.active !== '0')

      setCarriers(list)
      if (!selectedCarrierId && list[0]?.id) setSelectedCarrierId(list[0].id)
    }

    loadCarriers()
  }, [selectedCarrierId])

  const handleQuantityChange = (lineId, nextValue) => {
    const updated = updateCartItem(lineId, nextValue)
    setCart(updated)
  }

  const handleRemove = (lineId) => {
    const updated = removeCartItem(lineId)
    setCart(updated)
  }

  const fetchOrderStateId = async () => ORDER_STATE_ID_COD

  const createCart = async ({ customerId, addressId, carrierId, items }) => {
    const xml = buildCartXml({ customerId, addressId, carrierId, items })
    const response = await apiRequestRaw('/carts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
    })

    if (!response.ok) {
      const apiError = getApiError(response.text)
      throw new Error(apiError || `HTTP ${response.status}`)
    }

    const doc = parseXml(response.text)
    const cartId = getFirstIdFromXml(doc, 'cart')
    if (!cartId) throw new Error('Creation panier echouee')
    return cartId
  }

  const createAddress = async ({ customerId, alias, address1, postcode, city, countryId, firstname, lastname }) => {
    const xml = buildAddressXml({ customerId, alias, address1, postcode, city, countryId, firstname, lastname })
    const response = await apiRequestRaw('/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
    })

    if (!response.ok) {
      const apiError = getApiError(response.text)
      throw new Error(apiError || `HTTP ${response.status}`)
    }

    const doc = parseXml(response.text)
    const addressId = getFirstIdFromXml(doc, 'address')
    if (!addressId) throw new Error('Creation adresse echouee')
    return addressId
  }

  const createOrder = async ({
    customerId,
    addressId,
    carrierId,
    cartId,
    secureKey,
    orderStateId,
    items,
    totalHt,
    totalTtc,
  }) => {
    const xml = buildOrderXml({
      customerId,
      addressId,
      carrierId,
      cartId,
      secureKey,
      orderStateId,
      items,
      totalHt,
      totalTtc,
    })

    const response = await apiRequestRaw('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
    })

    if (!response.ok) {
      const apiError = getApiError(response.text)
      throw new Error(apiError || `HTTP ${response.status}`)
    }

    const doc = parseXml(response.text)
    const orderId = getFirstIdFromXml(doc, 'order')
    if (!orderId) throw new Error('Creation commande echouee')
    return orderId
  }

  const createOrderHistory = async (orderId, orderStateId) => {
    const xml = buildOrderHistoryXml(orderId, orderStateId)
    const response = await apiRequestRaw('/order_histories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
    })

    if (!response.ok) {
      const apiError = getApiError(response.text)
      throw new Error(apiError || `HTTP ${response.status}`)
    }
  }

  const clearOrderPayments = async (orderId) => {
    const orderResponse = await apiRequestRaw(`/orders/${orderId}`)
    if (!orderResponse.ok) return

    const reference = getOrderReference(orderResponse.text)
    if (!reference) return

    const listResponse = await apiRequestRaw(`/order_payments/?filter[order_reference]=[${encodeURIComponent(reference)}]&display=full`)
    if (!listResponse.ok) return

    const listDoc = parseXml(listResponse.text)
    const paymentIds = Array.from(listDoc.querySelectorAll('order_payment'))
      .map((node) => node.getAttribute('id') || getXmlText(node, 'id'))
      .filter(Boolean)

    for (const paymentId of paymentIds) {
      await apiRequestRaw(`/order_payments/${paymentId}`, { method: 'DELETE' })
    }
  }

  const handleCheckout = async () => {
    if (getCartCount(cart) === 0) {
      setError('Le panier est vide')
      return
    }
    if (!customer) {
      setError('Connecte-toi pour valider la commande')
      return
    }
    const token = loadToken()
    if (!token) {
      setError('Session client manquante')
      return
    }
    if (!selectedCarrierId) {
      setError('Selectionne un transporteur')
      return
    }
    if (!address1.trim() || !postcode.trim() || !city.trim()) {
      setError('Complete l adresse de livraison')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(null)

    try {
      const orderStateId = await fetchOrderStateId()
      const addressId = await createAddress({
        customerId: customer.id,
        alias: addressAlias.trim(),
        address1: address1.trim(),
        postcode: postcode.trim(),
        city: city.trim(),
        countryId: countryId.trim() || DEFAULT_COUNTRY_ID,
        firstname: customer.firstname,
        lastname: customer.lastname,
      })
      const cartId = await createCart({
        customerId: customer.id,
        addressId,
        carrierId: selectedCarrierId,
        items: cart,
      })
      const orderId = await createOrder({
        customerId: customer.id,
        addressId,
        carrierId: selectedCarrierId,
        cartId,
        secureKey: customer.secure_key || '',
        orderStateId,
        items: cart,
        totalHt: totals.totalHt,
        totalTtc: totals.totalTtc,
      })

      await createOrderHistory(orderId, orderStateId)
      await clearOrderPayments(orderId)

      clearCart()
      setCart([])
      setSuccess({ orderId })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fo-cart-page">
      <h2>Panier</h2>

      {cart.length === 0 ? (
        <p className="fo-cart-empty">Votre panier est vide.</p>
      ) : (
        <div className="fo-cart-layout">
          <div className="fo-cart-list">
            {cart.map((item) => (
              <div key={item.lineId} className="fo-cart-item">
                <div className="fo-cart-info">
                  <strong>{item.name || 'Produit'}</strong>
                  <span className="fo-cart-ref">{item.reference || ''}</span>
                  {item.attributeLabel && <span className="fo-cart-ref">{item.attributeLabel}</span>}
                </div>
                <div className="fo-cart-actions">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => handleQuantityChange(item.lineId, event.target.value)}
                  />
                  <span className="fo-cart-price">{roundMoney(item.priceTtc)} €</span>
                  <button type="button" onClick={() => handleRemove(item.lineId)}>
                    Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="fo-cart-summary">
            <div className="fo-checkout-section">
              <label className="fo-checkout-field">
                <span>Adresse (alias)</span>
                <input
                  type="text"
                  value={addressAlias}
                  onChange={(event) => setAddressAlias(event.target.value)}
                  placeholder="Livraison"
                />
              </label>
              <label className="fo-checkout-field">
                <span>Adresse</span>
                <input
                  type="text"
                  value={address1}
                  onChange={(event) => setAddress1(event.target.value)}
                  placeholder="10 rue Exemple"
                  required
                />
              </label>
              <label className="fo-checkout-field">
                <span>Code postal</span>
                <input
                  type="text"
                  value={postcode}
                  onChange={(event) => setPostcode(event.target.value)}
                  placeholder="75000"
                  required
                />
              </label>
              <label className="fo-checkout-field">
                <span>Ville</span>
                <input
                  type="text"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Paris"
                  required
                />
              </label>
              <label className="fo-checkout-field">
                <span>Pays (ID)</span>
                <input
                  type="text"
                  value={countryId}
                  onChange={(event) => setCountryId(event.target.value)}
                  placeholder={DEFAULT_COUNTRY_ID}
                />
              </label>
              <label className="fo-checkout-field">
                <span>Transporteur</span>
                <select
                  value={selectedCarrierId}
                  onChange={(event) => setSelectedCarrierId(event.target.value)}
                >
                  <option value="">Choisir un transporteur</option>
                  {carriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="fo-cart-summary-row">
              <span>Sous-total</span>
              <strong>{roundMoney(totals.totalTtc)} €</strong>
            </div>
            <div className="fo-cart-summary-row">
              <span>Livraison</span>
              <strong>0.00 €</strong>
            </div>
            <div className="fo-cart-summary-row fo-cart-total">
              <span>Total</span>
              <strong>{roundMoney(totals.totalTtc)} €</strong>
            </div>
            <p className="fo-cart-payment">Paiement a la livraison</p>
            <button type="button" className="fo-cart-checkout" onClick={handleCheckout} disabled={loading}>
              {loading ? 'Validation...' : 'Valider la commande'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="fo-cart-error">{error}</p>}
      {success && (
        <p className="fo-cart-success">Commande creee. Reference: #{success.orderId}</p>
      )}
    </div>
  )
}
