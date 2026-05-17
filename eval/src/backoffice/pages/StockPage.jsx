import { useEffect, useMemo, useState } from 'react'
import { apiRequestRaw, getApiConfig } from '../../services/apiService.js'
import { extractApiErrorMessage, getXmlText, parseXml } from '../../shared/xml/xmlUtils.js'

const STOCK_LOG_KEY = 'bo_stock_journal_v1'

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

function getPsBaseUrl() {
  const { baseUrl } = getApiConfig()
  return baseUrl.replace(/\/api\/?$/, '')
}

async function apiFetchHistory(productId) {
  const { token } = getApiConfig()
  const params = new URLSearchParams({ fc: 'module', module: 'stockapi', controller: 'history', id_product: String(productId) })
  if (token) params.set('ws_key', token)
  const response = await fetch(`${getPsBaseUrl()}/index.php?${params}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
  return data.movements || []
}

async function apiUpdateStock(productId, idAttribute = '0', delta) {
  const { token } = getApiConfig()
  const params = new URLSearchParams({ fc: 'module', module: 'stockapi', controller: 'update' })
  if (token) params.set('ws_key', token)
  const url = `${getPsBaseUrl()}/index.php?${params}`

  const body = new URLSearchParams({
    id_product: String(productId),
    id_product_attribute: String(idAttribute),
    qty: String(delta),
  })
  const response = await fetch(url, {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
  return data
}

async function findProductByReference(reference) {
  const ref = String(reference || '').trim()
  if (!ref) return null

  // Cherche d'abord dans les produits de base
  const xml = await apiGetXml(`/products/?filter[reference]=[${encodeURIComponent(ref)}]&display=full`)
  const doc = parseXml(xml)
  const product = doc.querySelector('product')
  if (product) {
    const id = product.getAttribute('id') || getXmlText(product, 'id')
    return {
      id,
      idAttribute: '0',
      reference: getXmlText(product, 'reference') || ref,
      name: getXmlText(product, 'name > language') || getXmlText(product, 'name') || `Produit ${id}`,
    }
  }

  // Si non trouvé, cherche dans les déclinaisons (combinaisons)
  const comboXml = await apiGetXml(`/combinations/?filter[reference]=[${encodeURIComponent(ref)}]&display=full`)
  const comboDoc = parseXml(comboXml)
  const combo = comboDoc.querySelector('combination')
  if (!combo) return null

  const idAttribute = combo.getAttribute('id') || getXmlText(combo, 'id')
  const idProduct = getXmlText(combo, 'id_product')

  // Récupère le nom du produit parent
  const prodXml = await apiGetXml(`/products/${idProduct}`)
  const prodDoc = parseXml(prodXml)
  const baseName = getXmlText(prodDoc, 'name > language') || getXmlText(prodDoc, 'name') || `Produit ${idProduct}`

  return {
    id: idProduct,
    idAttribute,
    reference: ref,
    name: `${baseName} (${ref})`,
  }
}

async function fetchAllProducts() {
  const xml = await apiGetXml('/products/?display=full')
  const doc = parseXml(xml)
  return Array.from(doc.querySelectorAll('product')).map((p) => ({
    id: p.getAttribute('id') || getXmlText(p, 'id'),
    reference: getXmlText(p, 'reference') || '',
    name: getXmlText(p, 'name > language') || getXmlText(p, 'name') || '',
  }))
}

async function fetchAllStockAvailables() {
  const xml = await apiGetXml('/stock_availables/?display=full')
  const doc = parseXml(xml)
  const map = new Map()
  doc.querySelectorAll('stock_available').forEach((s) => {
    const productId = getXmlText(s, 'id_product')
    const attrId = getXmlText(s, 'id_product_attribute') || '0'
    if (attrId === '0' && !map.has(productId)) {
      map.set(productId, {
        stockId: s.getAttribute('id') || getXmlText(s, 'id'),
        quantity: normalizeInt(getXmlText(s, 'quantity'), 0),
      })
    }
  })
  return map
}

async function fetchProductCombinations(productId) {
  const xml = await apiGetXml(`/combinations/?filter[id_product]=[${productId}]&display=full`)
  const doc = parseXml(xml)
  return Array.from(doc.querySelectorAll('combination')).map((c) => ({
    id: c.getAttribute('id') || getXmlText(c, 'id'),
    reference: getXmlText(c, 'reference') || `Declinaison ${c.getAttribute('id') || getXmlText(c, 'id')}`,
  }))
}

async function getProductStock(productId, idAttribute = '0') {
  const xml = await apiGetXml(`/stock_availables/?filter[id_product]=[${productId}]&filter[id_product_attribute]=[${idAttribute}]&display=full`)
  const doc = parseXml(xml)
  const node = doc.querySelector('stock_available')
  if (!node) return 0
  return normalizeInt(getXmlText(node, 'quantity'), 0)
}

function StockBarChart({ rows }) {
  if (!rows || rows.length === 0) return null

  const maxAdded = Math.max(...rows.map((r) => r.added), 1)
  const CHART_H = 140
  const PAD_LEFT = 36
  const PAD_TOP = 24
  const PAD_BOTTOM = 40
  const BAR_W = 40
  const GAP = 12
  const SVG_H = CHART_H + PAD_TOP + PAD_BOTTOM
  const SVG_W = Math.max(300, PAD_LEFT + rows.length * (BAR_W + GAP) + 16)

  const yTicks = [0, Math.round(maxAdded / 2), maxAdded].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div style={{ overflowX: 'auto', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', padding: '8px' }}>
      <svg
        width={SVG_W}
        height={SVG_H}
        style={{ display: 'block' }}
      >
        {yTicks.map((tick) => {
          const y = PAD_TOP + CHART_H - (tick / maxAdded) * CHART_H
          return (
            <g key={tick}>
              <line x1={PAD_LEFT} x2={SVG_W - 8} y1={y} y2={y} stroke="#e2eaf2" strokeWidth="1" />
              <text x={PAD_LEFT - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#8a9ab0">{tick}</text>
            </g>
          )
        })}
        {rows.map((row, i) => {
          const barH = Math.max(6, (row.added / maxAdded) * CHART_H)
          const x = PAD_LEFT + i * (BAR_W + GAP)
          const y = PAD_TOP + CHART_H - barH
          return (
            <g key={row.date}>
              <rect x={x} y={y} width={BAR_W} height={barH} fill="var(--primary)" rx="4" opacity="0.85" />
              <text x={x + BAR_W / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--primary)">
                +{row.added}
              </text>
              <text
                x={x + BAR_W / 2}
                y={PAD_TOP + CHART_H + 14}
                textAnchor="end"
                fontSize="10"
                fill="#8a9ab0"
                transform={`rotate(-35 ${x + BAR_W / 2} ${PAD_TOP + CHART_H + 14})`}
              >
                {formatDateLabel(row.date)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
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
  const [combinations, setCombinations] = useState([])
  const [selectedAttrId, setSelectedAttrId] = useState('0')
  const [allProducts, setAllProducts] = useState([])
  const [loadingAll, setLoadingAll] = useState(false)
  const [allError, setAllError] = useState('')
  const [searchFilter, setSearchFilter] = useState('')

  const [evolProductId, setEvolProductId] = useState('')
  const [evolRows, setEvolRows] = useState([])
  const [evolLoading, setEvolLoading] = useState(false)
  const [evolError, setEvolError] = useState('')

  const currentReference = productInfo?.reference || String(reference || '').trim()

  const filteredProducts = useMemo(() => {
    const q = searchFilter.toLowerCase().trim()
    if (!q) return allProducts
    return allProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q)
    )
  }, [allProducts, searchFilter])

  const loadAllProducts = async () => {
    setLoadingAll(true)
    setAllError('')
    try {
      const [products, stockMap] = await Promise.all([fetchAllProducts(), fetchAllStockAvailables()])
      const merged = products.map((p) => {
        const s = stockMap.get(p.id)
        return { ...p, quantity: s ? s.quantity : null, stockId: s ? s.stockId : null }
      })
      setAllProducts(merged)
    } catch (err) {
      setAllError(err.message || 'Erreur chargement produits')
    } finally {
      setLoadingAll(false)
    }
  }

  const loadEvolHistory = async (productId) => {
    const id = productId ?? evolProductId
    if (!id) return
    setEvolLoading(true)
    setEvolError('')
    try {
      const movements = await apiFetchHistory(id)
      setEvolRows(movements)
    } catch (err) {
      setEvolError(err.message || 'Erreur chargement historique')
      setEvolRows([])
    } finally {
      setEvolLoading(false)
    }
  }

  const handleSelectProduct = async (p) => {
    setReference(p.reference)
    setProductInfo({ id: p.id, idAttribute: '0', reference: p.reference, name: p.name })
    setStockInfo({ quantity: p.quantity ?? 0 })
    setSelectedAttrId('0')
    setEvolProductId(p.id)
    loadEvolHistory(p.id)
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const combos = await fetchProductCombinations(p.id)
      setCombinations(combos)
    } catch {
      setCombinations([])
    }
  }

  useEffect(() => {
    loadAllProducts()
  }, [])

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

  const handleAttrChange = async (attrId) => {
    setSelectedAttrId(attrId)
    if (!productInfo) return
    try {
      const qty = await getProductStock(productInfo.id, attrId)
      setStockInfo({ quantity: qty })
    } catch {
      // ignore stock fetch error on combo change
    }
  }

  const handleSearch = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const product = await findProductByReference(reference)
      if (!product) throw new Error('Produit introuvable avec cette reference')

      let combos = []
      if (product.idAttribute === '0') {
        try { combos = await fetchProductCombinations(product.id) } catch { combos = [] }
      }
      setCombinations(combos)
      setSelectedAttrId(product.idAttribute)

      const quantity = await getProductStock(product.id, product.idAttribute)
      setProductInfo(product)
      setStockInfo({ quantity })
      setEvolProductId(product.id)
      loadEvolHistory(product.id)
      setSuccess('Produit charge avec succes.')
    } catch (err) {
      setProductInfo(null)
      setStockInfo(null)
      setCombinations([])
      setError(err.message || 'Erreur recherche produit')
    } finally {
      setLoading(false)
    }
  }

  const handleAddStock = async () => {
    const qtyToAdd = normalizeInt(addQty, 0)
    if (!productInfo) {
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

    const before = normalizeInt(stockInfo?.quantity, 0)
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const ts = now.toISOString()

    try {
      const result = await apiUpdateStock(productInfo.id, selectedAttrId, qtyToAdd)
      const after = result.quantity
      const nextLog = [
        ...logEntries,
        { ts, date, productId: productInfo.id, reference: productInfo.reference, name: productInfo.name, before, added: qtyToAdd, after, status: 'ok' },
      ]
      saveStockLog(nextLog)
      setLogEntries(nextLog)
      setStockInfo({ quantity: after })
      setSuccess(`Stock mis a jour: ${before} + ${qtyToAdd} = ${after}`)
      loadEvolHistory(productInfo.id)
    } catch (err) {
      const nextLog = [
        ...logEntries,
        { ts, date, productId: productInfo.id, reference: productInfo.reference, name: productInfo.name, before, added: qtyToAdd, after: before + qtyToAdd, status: 'error', error: err.message || 'Erreur inconnue' },
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

          {combinations.length > 0 ? (
            <div style={{ margin: '0.5rem 0' }}>
              <label style={{ fontSize: '13px', color: 'var(--muted)', marginRight: '8px' }}>Declinaison:</label>
              <select
                className="bo-select"
                style={{ maxWidth: '260px' }}
                value={selectedAttrId}
                onChange={(e) => handleAttrChange(e.target.value)}
                disabled={loading}
              >
                <option value="0">-- Base produit --</option>
                {combinations.map((c) => (
                  <option key={c.id} value={c.id}>{c.reference}</option>
                ))}
              </select>
            </div>
          ) : null}

          <p style={{ margin: '0.5rem 0 0' }}><strong>Stock actuel:</strong> {stockInfo.quantity}</p>

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

      <div style={{ width: '100%', marginTop: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Evolution journaliere du stock</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="bo-select"
              style={{ maxWidth: '320px' }}
              value={evolProductId}
              onChange={(e) => { setEvolProductId(e.target.value); loadEvolHistory(e.target.value) }}
              disabled={allProducts.length === 0}
            >
              <option value="">-- Choisir un produit --</option>
              {allProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.reference ? `[${p.reference}] ` : ''}{p.name || `Produit ${p.id}`}
                </option>
              ))}
            </select>
            {evolProductId ? (
              <button type="button" className="bo-button" onClick={() => loadEvolHistory()} disabled={evolLoading}>
                {evolLoading ? 'Chargement...' : 'Actualiser'}
              </button>
            ) : null}
          </div>
        </div>

        {evolError ? <p style={{ color: '#b91c1c', fontSize: '14px' }}>{evolError}</p> : null}

        {!evolProductId ? (
          <p className="bo-muted">Selectionnez un produit pour voir son evolution journaliere.</p>
        ) : evolLoading ? (
          <p className="bo-muted">Chargement des mouvements...</p>
        ) : evolRows.length === 0 ? (
          <p className="bo-muted">Aucun mouvement de stock enregistre pour ce produit.</p>
        ) : (
          <>
            <StockBarChart rows={evolRows} />
            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr 1fr', gap: '12px', alignItems: 'center', fontWeight: 600, fontSize: '13px', color: 'var(--muted)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '6px', minWidth: '400px' }}>
                <span>Date</span>
                <span>Quantite ajoutee</span>
                <span>Stock debut → fin</span>
                <span>Operations</span>
              </div>
              <div style={{ display: 'grid', gap: '6px', minWidth: '400px' }}>
                {[...evolRows].reverse().map((row) => (
                  <div
                    key={row.date}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr 1.2fr 1fr',
                      gap: '12px',
                      alignItems: 'center',
                      background: '#fff',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      fontSize: '14px',
                      boxShadow: '0 4px 10px rgba(15,23,42,0.05)',
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{formatDateLabel(row.date)}</span>
                    <span style={{ color: '#166534', fontWeight: 600 }}>+{row.added}</span>
                    <span>{row.qty_before} → {row.qty_after}</span>
                    <span className="bo-muted">{row.operations} op.</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ width: '100%', marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>
            Tous les produits
            {allProducts.length > 0 ? <span className="bo-muted" style={{ fontWeight: 400, marginLeft: '8px' }}>({allProducts.length})</span> : null}
          </h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="bo-select"
              style={{ maxWidth: '220px' }}
              placeholder="Filtrer par nom ou reference"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
            <button type="button" className="bo-button" onClick={loadAllProducts} disabled={loadingAll}>
              {loadingAll ? 'Chargement...' : 'Actualiser'}
            </button>
          </div>
        </div>

        {allError ? (
          <p style={{ color: '#b91c1c', fontSize: '14px' }}>{allError}</p>
        ) : null}

        {loadingAll ? (
          <p className="bo-muted">Chargement des produits...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="bo-muted">{allProducts.length === 0 ? 'Aucun produit charge.' : 'Aucun produit ne correspond au filtre.'}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1.5fr 90px 120px', gap: '12px', alignItems: 'center', fontWeight: 600, fontSize: '13px', color: 'var(--muted)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '6px', minWidth: '520px' }}>
              <span>ID</span>
              <span>Reference</span>
              <span>Nom</span>
              <span style={{ textAlign: 'right' }}>Stock</span>
              <span></span>
            </div>
            <div style={{ display: 'grid', gap: '6px', minWidth: '520px' }}>
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 1.5fr 90px 120px',
                    gap: '12px',
                    alignItems: 'center',
                    background: productInfo?.id === p.id ? '#edf7f5' : '#fff',
                    border: `1px solid ${productInfo?.id === p.id ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '14px',
                    boxShadow: '0 4px 10px rgba(15,23,42,0.05)',
                  }}
                >
                  <span className="bo-muted">{p.id}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{p.reference || '-'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || '-'}</span>
                  <span style={{ textAlign: 'right', fontWeight: 600, color: p.quantity === 0 ? '#b91c1c' : p.quantity === null ? 'var(--muted)' : 'var(--text)' }}>
                    {p.quantity === null ? '-' : p.quantity}
                  </span>
                  <button
                    type="button"
                    className="bo-button"
                    style={{ fontSize: '12px', padding: '6px 10px' }}
                    onClick={() => handleSelectProduct(p)}
                  >
                    Selectionner
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default StockPage
