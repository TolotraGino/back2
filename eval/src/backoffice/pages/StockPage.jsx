import { useMemo, useState } from 'react'
import { apiRequestRaw } from '../../services/apiService.js'
import { extractApiErrorMessage, getFirstIdFromXml, getXmlText, parseXml, serializeXml } from '../../shared/xml/xmlUtils.js'

const STOCK_LOG_KEY = 'bo_stock_journal_v1'
const DEFAULT_SHOP_ID = '1'
const DEFAULT_SHOP_GROUP_ID = '1'

function normalizeInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value || '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatDateLabel(isoDate) {
  if (!isoDate) return '-'
  const [y, m, d] = isoDate.split('-')
  if (!y || !m || !d) return isoDate
  return `${d}/${m}/${y}`
}

function loadStockLog() {
  try {
    const raw = localStorage.getItem(STOCK_LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveStockLog(entries) {
  try {
    localStorage.setItem(STOCK_LOG_KEY, JSON.stringify(entries.slice(-1000)))
  } catch {
    return
  }
}

async function apiGetXml(path) {
  const r = await apiRequestRaw(path, { method: 'GET' })
  if (!r.ok) throw new Error(`HTTP ${r.status}${extractApiErrorMessage(r.text) ? ` - ${extractApiErrorMessage(r.text)}` : ''}`)
  return r.text
}

async function apiPutXml(path, xml) {
  const r = await apiRequestRaw(path, { method: 'PUT', headers: { 'Content-Type': 'application/xml' }, body: xml })
  if (!r.ok) throw new Error(`HTTP ${r.status}${extractApiErrorMessage(r.text) ? ` - ${extractApiErrorMessage(r.text)}` : ''}`)
}

async function apiPostXml(path, xml, tagName) {
  const r = await apiRequestRaw(path, { method: 'POST', headers: { 'Content-Type': 'application/xml' }, body: xml })
  if (!r.ok) throw new Error(`HTTP ${r.status}${extractApiErrorMessage(r.text) ? ` - ${extractApiErrorMessage(r.text)}` : ''}`)
  return getFirstIdFromXml(parseXml(r.text), tagName)
}

async function findProductByReference(reference) {
  const ref = String(reference || '').trim()
  if (!ref) return null
  const xml = await apiGetXml(`/products/?filter[reference]=[${encodeURIComponent(ref)}]&display=full`)
  const doc = parseXml(xml)
  const product = doc.querySelector('product')
  if (!product) return null
  const id = product.getAttribute('id') || getXmlText(product, 'id')
  return {
    id,
    reference: getXmlText(product, 'reference') || ref,
    name: getXmlText(product, 'name > language') || getXmlText(product, 'name') || `Produit ${id}`,
  }
}

async function getOrCreateStockAvailable(productId, combinationId = '0') {
  const listXml = await apiGetXml(`/stock_availables/?filter[id_product]=[${productId}]&filter[id_product_attribute]=[${combinationId}]&display=full`)
  const listDoc = parseXml(listXml)
  const stockNode = listDoc.querySelector('stock_available')
  const stockId = stockNode?.getAttribute('id') || getXmlText(stockNode || listDoc, 'id')

  if (stockId) {
    const detailDoc = parseXml(await apiGetXml(`/stock_availables/${stockId}`))
    const quantity = normalizeInt(getXmlText(detailDoc, 'stock_available > quantity, quantity'), 0)
    return { stockId, quantity }
  }

  const createdId = await apiPostXml('/stock_availables/', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
    '  <stock_available>',
    `    <id_product>${productId}</id_product>`,
    `    <id_product_attribute>${combinationId}</id_product_attribute>`,
    `    <id_shop>${DEFAULT_SHOP_ID}</id_shop>`,
    `    <id_shop_group>${DEFAULT_SHOP_GROUP_ID}</id_shop_group>`,
    '    <quantity>0</quantity>',
    '    <depends_on_stock>0</depends_on_stock>',
    '    <out_of_stock>2</out_of_stock>',
    '  </stock_available>',
    '</prestashop>',
  ].join('\n'), 'stock_available')

  return { stockId: createdId, quantity: 0 }
}

async function updateStockQuantity(stockId, nextQuantity) {
  const stockDoc = parseXml(await apiGetXml(`/stock_availables/${stockId}`))
  const quantityNode = stockDoc.querySelector('stock_available > quantity, quantity')
  if (!quantityNode) throw new Error('Champ quantity introuvable')
  quantityNode.textContent = String(nextQuantity)

  const dependsNode = stockDoc.querySelector('stock_available > depends_on_stock, depends_on_stock')
  if (dependsNode) dependsNode.textContent = '0'

  await apiPutXml(`/stock_availables/${stockId}`, serializeXml(stockDoc))
}

function StockPage() {
  const [reference, setReference] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [productInfo, setProductInfo] = useState(null)
  const [stockInfo, setStockInfo] = useState(null)
  const [logEntries, setLogEntries] = useState(() => loadStockLog())

  const currentReference = productInfo?.reference || String(reference || '').trim()

  const dailyRows = useMemo(() => {
    if (!currentReference) return []
    const filtered = logEntries
      .filter((e) => e.reference === currentReference && e.status === 'ok')
      .sort((a, b) => String(a.ts).localeCompare(String(b.ts)))

    const map = new Map()
    filtered.forEach((entry) => {
      const day = entry.date
      const existing = map.get(day) || { day, operations: 0, added: 0, firstBefore: null, lastAfter: null }
      existing.operations += 1
      existing.added += normalizeInt(entry.added, 0)
      if (existing.firstBefore === null) existing.firstBefore = normalizeInt(entry.before, 0)
      existing.lastAfter = normalizeInt(entry.after, 0)
      map.set(day, existing)
    })

    return Array.from(map.values()).sort((a, b) => String(b.day).localeCompare(String(a.day)))
  }, [logEntries, currentReference])

  const refreshProductStock = async (refValue) => {
    const product = await findProductByReference(refValue)
    if (!product) throw new Error('Produit introuvable avec cette reference')

    const stock = await getOrCreateStockAvailable(product.id, '0')
    setProductInfo(product)
    setStockInfo(stock)
    return { product, stock }
  }

  const handleSearch = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await refreshProductStock(reference)
      setSuccess('Produit charge avec succes.')
    } catch (err) {
      setProductInfo(null)
      setStockInfo(null)
      setError(err.message || 'Erreur recherche produit')
    } finally {
      setLoading(false)
    }
  }

  const handleAddStock = async () => {
    const qtyToAdd = normalizeInt(addQty, 0)
    if (!productInfo || !stockInfo) {
      setError('Charge d abord un produit avant ajout stock.')
      return
    }
    if (qtyToAdd <= 0) {
      setError('La quantite a ajouter doit etre strictement positive.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const before = normalizeInt(stockInfo.quantity, 0)
    const after = before + qtyToAdd
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const ts = now.toISOString()

    try {
      await updateStockQuantity(stockInfo.stockId, after)
      const nextLog = [
        ...logEntries,
        {
          ts,
          date,
          productId: productInfo.id,
          reference: productInfo.reference,
          name: productInfo.name,
          before,
          added: qtyToAdd,
          after,
          status: 'ok',
        },
      ]
      saveStockLog(nextLog)
      setLogEntries(nextLog)
      setStockInfo((prev) => ({ ...prev, quantity: after }))
      setSuccess(`Stock mis a jour: ${before} + ${qtyToAdd} = ${after}`)
    } catch (err) {
      const nextLog = [
        ...logEntries,
        {
          ts,
          date,
          productId: productInfo.id,
          reference: productInfo.reference,
          name: productInfo.name,
          before,
          added: qtyToAdd,
          after,
          status: 'error',
          error: err.message || 'Erreur inconnue',
        },
      ]
      saveStockLog(nextLog)
      setLogEntries(nextLog)
      setError(err.message || 'Erreur mise a jour stock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="bo-content">
      <header className="bo-content__header">
        <h2>Gestion stock produit</h2>
        <p className="bo-muted">Rechercher un produit par reference, ajouter une quantite, puis suivre l evolution journaliere.</p>
      </header>

      <div className="bo-reset__controls" style={{ flexWrap: 'wrap' }}>
        <input
          type="text"
          className="bo-select"
          style={{ maxWidth: '280px' }}
          placeholder="Reference produit"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          disabled={loading}
        />
        <button type="button" className="bo-button" onClick={handleSearch} disabled={loading || !reference.trim()}>
          {loading ? 'Chargement...' : 'Rechercher'}
        </button>
      </div>

      {productInfo && stockInfo ? (
        <div className="bo-card" style={{ width: '100%', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem' }}><strong>Produit:</strong> {productInfo.name}</p>
          <p style={{ margin: '0 0 0.5rem' }}><strong>Reference:</strong> {productInfo.reference}</p>
          <p style={{ margin: 0 }}><strong>Stock actuel:</strong> {stockInfo.quantity}</p>

          <div className="bo-reset__controls" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="number"
              min="1"
              step="1"
              className="bo-select"
              style={{ maxWidth: '180px' }}
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              disabled={loading}
            />
            <button type="button" className="bo-button" onClick={handleAddStock} disabled={loading}>
              {loading ? 'Mise a jour...' : 'Ajouter au stock'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="bo-card" style={{ width: '100%', backgroundColor: '#fee', borderColor: '#f88', marginBottom: '1rem' }}>
          <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {success ? (
        <div className="bo-card" style={{ width: '100%', backgroundColor: '#effaf4', borderColor: '#7bcfa3', marginBottom: '1rem' }}>
          <p style={{ color: '#166534', margin: 0 }}>{success}</p>
        </div>
      ) : null}

      {currentReference ? (
        <div className="bo-card" style={{ width: '100%' }}>
          <h3 style={{ marginTop: 0 }}>Evolution stock journaliere - {currentReference}</h3>
          {dailyRows.length === 0 ? (
            <p className="bo-muted" style={{ marginBottom: 0 }}>Aucun mouvement stock enregistre pour ce produit.</p>
          ) : (
            <div className="bo-stats-table">
              <div className="bo-stats-table__head">
                <span>Date</span>
                <span>Ajout total</span>
                <span>Stock debut - fin</span>
              </div>
              {dailyRows.map((row) => (
                <div className="bo-stats-table__row" key={row.day}>
                  <span>{formatDateLabel(row.day)} ({row.operations} operation(s))</span>
                  <span>+{row.added}</span>
                  <span>{row.firstBefore} {'->'} {row.lastAfter}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

export default StockPage
