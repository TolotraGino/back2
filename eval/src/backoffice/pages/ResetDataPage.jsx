import { useMemo, useState } from 'react'
import { RESET_CATEGORIES } from '../functions/resetDataCatalog.js'
import { apiRequest, apiRequestRaw } from '../../services/apiService.js'

const PROTECTED_IDS = {
  customers: [1],
  products: [1, 2],
  orders: [],
  categories: [1, 2],
  order_states: [1, 2, 3, 4, 5, 6, 7, 8],
}

// Lower value means the resource is deleted earlier.
// Delete children before parents to reduce dependency errors.
const DELETE_PRIORITY = {
  order_details: 10,
  order_histories: 20,
  order_payments: 30,
  orders: 40,
  carts: 50,
  addresses: 60,
  customers: 70,
  specific_prices: 80,
  stock_availables: 90,
  combinations: 100,
  product_option_values: 110,
  product_options: 120,
  products: 130,
  categories: 140,
  tax_rules: 150,
  tax_rule_groups: 160,
  taxes: 170,
  order_states: 180,
}

// Quand l'utilisateur sélectionne une ressource parent, on force aussi
// la suppression de ses dépendances pour éviter les erreurs FK.
const RESOURCE_DEPENDENCIES = {
  products: ['specific_prices', 'stock_availables', 'combinations', 'order_details'],
  combinations: ['stock_availables', 'specific_prices', 'order_details'],
  customers: ['addresses', 'orders', 'carts'],
  orders: ['order_details', 'order_histories', 'order_payments'],
  tax_rule_groups: ['tax_rules'],
  taxes: ['tax_rules', 'tax_rule_groups'],
}

async function resetStockAvailableQuantity(stockId) {
  const getResponse = await apiRequestRaw(`/stock_availables/${stockId}`, { method: 'GET' })
  if (!getResponse.ok) return false

  const parser = new DOMParser()
  const doc = parser.parseFromString(getResponse.text, 'application/xml')
  const qtyNode = doc.querySelector('stock_available > quantity, quantity')
  if (!qtyNode) return false
  qtyNode.textContent = '0'

  const dependsNode = doc.querySelector('stock_available > depends_on_stock, depends_on_stock')
  if (dependsNode) dependsNode.textContent = '0'
  const outNode = doc.querySelector('stock_available > out_of_stock, out_of_stock')
  if (outNode) outNode.textContent = '2'

  const body = new XMLSerializer().serializeToString(doc)
  const putResponse = await apiRequestRaw(`/stock_availables/${stockId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/xml' },
    body,
  })
  return putResponse.ok
}

function parseResourceNodes(resource, xmlText) {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml')
  const container = xmlDoc.getElementsByTagName(resource)[0]
  if (!container) return []
  return Array.from(container.children)
}

function getNodeLabel(node) {
  const id = node.getAttribute('id') || '?'
  const name =
    node.getElementsByTagName('name')[0]?.textContent?.trim() ||
    node.getElementsByTagName('reference')[0]?.textContent?.trim() ||
    node.getElementsByTagName('email')[0]?.textContent?.trim() ||
    ''
  return name ? `#${id} - ${name}` : `#${id}`
}

function isProtectedNode(resource, node) {
  const id = Number.parseInt(node.getAttribute('id'), 10)
  if (!Number.isFinite(id)) return true

  const protectedIds = PROTECTED_IDS[resource] || []
  if (protectedIds.includes(id)) return true

  if (resource === 'order_states') {
    const unremovable = node.getElementsByTagName('unremovable')[0]?.textContent?.trim()
    if (unremovable === '1') return true
  }

  return false
}

async function previewResourceItems(resource) {
  const listResponse = await apiRequestRaw(`/${resource}/`, { method: 'GET' })
  if (!listResponse.ok) {
    return {
      resource,
      ok: false,
      status: listResponse.status,
      total: 0,
      deletableIds: [],
      protectedIds: [],
      deletableLabels: [],
      protectedLabels: [],
    }
  }

  const nodes = parseResourceNodes(resource, listResponse.text)
  const deletableNodes = nodes.filter((node) => !isProtectedNode(resource, node))
  const protectedNodes = nodes.filter((node) => isProtectedNode(resource, node))

  const deletableIds = deletableNodes
    .map((node) => Number.parseInt(node.getAttribute('id'), 10))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => b - a)
  const protectedIds = protectedNodes
    .map((node) => Number.parseInt(node.getAttribute('id'), 10))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b)

  return {
    resource,
    ok: true,
    status: 200,
    total: nodes.length,
    deletableIds,
    protectedIds,
    deletableLabels: deletableNodes.map(getNodeLabel),
    protectedLabels: protectedNodes.map(getNodeLabel),
  }
}

async function deleteResourceItems(resource) {
  const listResponse = await apiRequestRaw(`/${resource}/`, { method: 'GET' })
  if (!listResponse.ok) {
    return {
      resource,
      ok: false,
      status: listResponse.status,
      deleted: 0,
      total: 0,
    }
  }

  const nodes = parseResourceNodes(resource, listResponse.text)
  const idsToDelete = nodes
    .filter((node) => !isProtectedNode(resource, node))
    .map((node) => Number.parseInt(node.getAttribute('id'), 10))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => b - a)

  // Multi-pass suppression: utile pour ressources liées entre elles.
  const remaining = new Set(idsToDelete)
  let deletedCount = 0
  const maxPasses = 4

  for (let pass = 0; pass < maxPasses && remaining.size > 0; pass += 1) {
    let progressThisPass = 0
    const currentIds = Array.from(remaining).sort((a, b) => b - a)

    for (const id of currentIds) {
      const response = await apiRequest(`/${resource}/${id}`, { method: 'DELETE' })
      // OK: supprimé
      // 404: déjà absent, on le considère comme traité
      if (response.ok || response.status === 404) {
        remaining.delete(id)
        deletedCount += 1
        progressThisPass += 1
        continue
      }

      // PrestaShop bloque souvent DELETE sur stock_availables:
      // fallback = mettre quantity à 0 via PUT.
      if (resource === 'stock_availables') {
        const resetOk = await resetStockAvailableQuantity(id)
        if (resetOk) {
          remaining.delete(id)
          deletedCount += 1
          progressThisPass += 1
        }
      }
    }

    if (progressThisPass === 0) break
  }

  return {
    resource,
    ok: remaining.size === 0,
    status: 200,
    deleted: deletedCount,
    total: idsToDelete.length,
  }
}

function buildItemList(categories) {
  const all = categories.flatMap((category) => category.items)
  return Array.from(new Set(all))
}

function sortItemsByDeletePriority(items) {
  return [...items].sort((a, b) => {
    const pa = DELETE_PRIORITY[a] ?? 999
    const pb = DELETE_PRIORITY[b] ?? 999
    if (pa !== pb) return pa - pb
    return a.localeCompare(b)
  })
}

function expandItemsWithDependencies(items) {
  const expanded = new Set(items)
  const queue = [...items]

  while (queue.length > 0) {
    const current = queue.shift()
    const deps = RESOURCE_DEPENDENCIES[current] || []
    for (const dep of deps) {
      if (!expanded.has(dep)) {
        expanded.add(dep)
        queue.push(dep)
      }
    }
  }

  return Array.from(expanded)
}

function ResetDataPage() {
  const allItems = useMemo(() => buildItemList(RESET_CATEGORIES), [])
  const [selectedItems, setSelectedItems] = useState(() => new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [results, setResults] = useState([])
  const [logs, setLogs] = useState([])
  const [preview, setPreview] = useState([])
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  const isAllSelected = selectedItems.size === allItems.length

  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedItems(new Set())
      return
    }
    setSelectedItems(new Set(allItems))
  }

  const toggleCategory = (category) => {
    const next = new Set(selectedItems)
    const hasAll = category.items.every((item) => next.has(item))

    if (hasAll) {
      category.items.forEach((item) => next.delete(item))
    } else {
      category.items.forEach((item) => next.add(item))
    }

    setSelectedItems(next)
  }

  const toggleItem = (item) => {
    const next = new Set(selectedItems)
    if (next.has(item)) {
      next.delete(item)
    } else {
      next.add(item)
    }
    setSelectedItems(next)
  }

  const appendLog = (message) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(0, 300))
  }

  const handlePreview = async () => {
    if (selectedItems.size === 0) return

    setIsPreviewLoading(true)
    setPreview([])
    appendLog('Debut analyse des donnees a supprimer...')

    const items = sortItemsByDeletePriority(
      expandItemsWithDependencies(Array.from(selectedItems)),
    )

    const rows = []
    for (const item of items) {
      appendLog(`Analyse ${item}...`)
      const p = await previewResourceItems(item)
      rows.push(p)
      if (!p.ok) {
        appendLog(`Analyse ${item}: HTTP ${p.status}`)
      } else {
        appendLog(
          `Analyse ${item}: ${p.deletableIds.length} supprimable(s), ${p.protectedIds.length} protege(s)`,
        )
      }
    }
    setPreview(rows)
    setIsPreviewLoading(false)
    appendLog('Analyse terminee.')
  }

  const handleConfirm = async () => {
    if (selectedItems.size === 0) {
      return
    }

    setIsSubmitting(true)
    setResults([])
    setLogs([])
    appendLog('Debut suppression...')

    const items = sortItemsByDeletePriority(
      expandItemsWithDependencies(Array.from(selectedItems)),
    )
    const responses = []
    for (const item of items) {
      appendLog(`Suppression ${item}: debut`)
      const response = await deleteResourceItems(item)
      responses.push(response)
      if (response.ok) {
        appendLog(`Suppression ${item}: OK (${response.deleted}/${response.total})`)
      } else {
        appendLog(`Suppression ${item}: KO (${response.deleted}/${response.total})`)
      }
    }

    setResults(responses)
    setIsSubmitting(false)
    appendLog('Suppression terminee.')
  }

  return (
    <section className="bo-content">
      <header className="bo-content__header">
        <h2>Reinitialisation donnees</h2>
        <p className="bo-muted">
          Selectionne les categories a reinitialiser, puis confirme l action.
        </p>
      </header>

      <div className="bo-reset__controls">
        <button type="button" className="bo-button" onClick={toggleAll}>
          {isAllSelected ? 'Tout deselectionner' : 'Tout selectionner'}
        </button>
        <span className="bo-muted">{selectedItems.size} selection(s)</span>
      </div>

      <div className="bo-reset__grid">
        {RESET_CATEGORIES.map((category) => {
          const categorySelected = category.items.every((item) =>
            selectedItems.has(item),
          )

          return (
            <section className="bo-reset__category" key={category.id}>
              <div className="bo-reset__category-header">
                <h3>{category.label}</h3>
                <button
                  type="button"
                  className="bo-button bo-button--ghost"
                  onClick={() => toggleCategory(category)}
                >
                  {categorySelected
                    ? 'Deselectionner'
                    : 'Selectionner'}
                </button>
              </div>

              <div className="bo-reset__items">
                {category.items.map((item) => (
                  <label className="bo-checkbox" key={item}>
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item)}
                      onChange={() => toggleItem(item)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <div className="bo-reset__footer">
        <button
          type="button"
          className="bo-button bo-button--ghost"
          onClick={handlePreview}
          disabled={selectedItems.size === 0 || isSubmitting || isPreviewLoading}
        >
          {isPreviewLoading ? 'Analyse en cours...' : 'Afficher donnees a effacer'}
        </button>
        <button
          type="button"
          className="bo-button"
          onClick={handleConfirm}
          disabled={selectedItems.size === 0 || isSubmitting}
        >
          {isSubmitting ? 'En cours...' : 'Confirmer'}
        </button>
      </div>

      {preview.length > 0 ? (
        <div className="bo-reset__results">
          <h3>Apercu avant suppression (PrestaShop)</h3>
          <ul>
            {preview.map((row) => (
              <li key={row.resource}>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <span>{row.resource}</span>
                    <span className={`bo-status ${row.ok ? 'bo-status--ok' : 'bo-status--error'}`}>
                      {row.ok
                        ? `${row.deletableIds.length} a supprimer / ${row.protectedIds.length} protege(s)`
                        : `HTTP ${row.status}`}
                    </span>
                  </div>
                  {row.ok && row.deletableLabels.length > 0 ? (
                    <p className="bo-muted" style={{ margin: '0.25rem 0 0' }}>
                      Supprimables: {row.deletableLabels.slice(0, 10).join(', ')}
                      {row.deletableLabels.length > 10 ? ` ... (+${row.deletableLabels.length - 10})` : ''}
                    </p>
                  ) : null}
                  {row.ok && row.protectedLabels.length > 0 ? (
                    <p className="bo-muted" style={{ margin: '0.25rem 0 0' }}>
                      Proteges: {row.protectedLabels.slice(0, 10).join(', ')}
                      {row.protectedLabels.length > 10 ? ` ... (+${row.protectedLabels.length - 10})` : ''}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="bo-reset__results">
          <h3>Resultats</h3>
          <ul>
            {results.map((result) => (
              <li key={result.resource}>
                <span>{result.resource}</span>
                <span
                  className={`bo-status ${result.ok ? 'bo-status--ok' : 'bo-status--error'}`}
                >
                  {result.ok ? 'OK' : 'KO'}
                  {result.total > 0
                    ? ` (${result.deleted}/${result.total})`
                    : ` (HTTP ${result.status})`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {logs.length > 0 ? (
        <div className="bo-reset__results">
          <h3>Journal suppression</h3>
          <ul>
            {logs.map((line, idx) => (
              <li key={`${idx}-${line}`}>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

export default ResetDataPage
