import { useEffect, useState } from 'react'
import { apiRequestRaw } from '../../services/apiService.js'
import { parseXml } from '../../shared/xml/xmlUtils.js'

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}

function xmlVal(node, tag) {
  return node.querySelector(tag)?.textContent?.trim() || ''
}

async function apiGet(path) {
  const r = await apiRequestRaw(path, { method: 'GET' })
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${path}`)
  return r.text
}

function KpiCard({ label, value, color = 'var(--primary)', loading }) {
  return (
    <div className="bo-card" style={{ minWidth: '190px', flex: '1' }}>
      <p className="bo-muted" style={{ margin: '0 0 4px', fontSize: '13px' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color }}>
        {loading ? '...' : `${fmt(value)} Ar`}
      </p>
    </div>
  )
}

export default function ProfitStatsPage() {
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      // 1. Catégories
      const catMap = new Map()
      parseXml(await apiGet('/categories/?display=full')).querySelectorAll('category').forEach(c => {
        const id   = c.getAttribute('id') || xmlVal(c, 'id')
        const name = (c.querySelector('name > language') || c.querySelector('name'))?.textContent?.trim()
        if (id && name) catMap.set(id, name)
      })

      // 2. Produits → prix_achat + catégorie par défaut
      const prodMap = new Map()
      parseXml(await apiGet('/products/?display=full')).querySelectorAll('product').forEach(p => {
        const id       = p.getAttribute('id') || xmlVal(p, 'id')
        const wholesale = parseFloat(xmlVal(p, 'wholesale_price')) || 0
        const catId    = xmlVal(p, 'id_category_default')
        if (id) prodMap.set(id, { wholesale, catId })
      })

      // 3. Commandes livrées (état 5) → IDs + total HT
      const deliveredIds = new Set()
      let totalVentesHT  = 0
      parseXml(await apiGet('/orders/?filter[current_state]=[5]&display=full')).querySelectorAll('order').forEach(o => {
        const id    = o.getAttribute('id') || xmlVal(o, 'id')
        const total = parseFloat(xmlVal(o, 'total_paid_tax_excl')) || 0
        if (id) { deliveredIds.add(id); totalVentesHT += total }
      })

      // 4. Détails lignes de commande → calcul achats + ventilation par catégorie
      let totalAchatsHT = 0
      const byCat = new Map()

      parseXml(await apiGet('/order_details/?display=full')).querySelectorAll('order_detail').forEach(d => {
        const orderId = xmlVal(d, 'id_order')
        if (!deliveredIds.has(orderId)) return

        const productId = xmlVal(d, 'product_id')
        const qty       = parseFloat(xmlVal(d, 'product_quantity')) || 0
        const unitHT    = parseFloat(xmlVal(d, 'unit_price_tax_excl')) || 0

        const prod      = prodMap.get(productId)
        const wholesale = prod?.wholesale || 0
        const catName   = catMap.get(prod?.catId || '') || 'Non classé'

        totalAchatsHT += qty * wholesale

        if (!byCat.has(catName)) byCat.set(catName, { ventes: 0, achats: 0 })
        byCat.get(catName).ventes += qty * unitHT
        byCat.get(catName).achats += qty * wholesale
      })

      const categories = Array.from(byCat.entries())
        .map(([name, v]) => ({
          name,
          ventes:   v.ventes,
          achats:   v.achats,
          benefice: v.ventes - v.achats,
          marge:    v.ventes > 0 ? ((v.ventes - v.achats) / v.ventes) * 100 : 0,
        }))
        .sort((a, b) => b.benefice - a.benefice)

      setStats({
        totalVentesHT,
        totalAchatsHT,
        totalBenefice: totalVentesHT - totalAchatsHT,
        ordersCount: deliveredIds.size,
        categories,
      })
    } catch (err) {
      setError(err.message || 'Erreur chargement statistiques')
    } finally {
      setLoading(false)
    }
  }

  const beneficeColor = !stats ? 'var(--primary)' : stats.totalBenefice >= 0 ? '#166534' : '#b91c1c'

  return (
    <section className="bo-content">
      <header className="bo-content__header">
        <h2>Statistiques bénéfices</h2>
        <p className="bo-muted">
          Basé sur les commandes livrées (état 5). Tous les montants sont hors taxe.
        </p>
      </header>

      {error ? <p className="bo-error">{error}</p> : null}

      {/* ── KPI cards ── */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
        <KpiCard label="Ventes HT" value={stats?.totalVentesHT} loading={loading} />
        <KpiCard label="Achats HT" value={stats?.totalAchatsHT} loading={loading} color="#b45309" />
        <KpiCard label="Bénéfice total" value={stats?.totalBenefice} loading={loading} color={beneficeColor} />
        <div className="bo-card" style={{ minWidth: '150px', flex: '1' }}>
          <p className="bo-muted" style={{ margin: '0 0 4px', fontSize: '13px' }}>Commandes livrées</p>
          <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)' }}>
            {loading ? '...' : stats?.ordersCount ?? 0}
          </p>
        </div>
      </div>

      {loading ? <p className="bo-muted">Chargement...</p> : null}

      {/* ── Tableau par catégorie ── */}
      {stats?.categories.length > 0 ? (
        <div>
          <h3 style={{ marginBottom: '12px' }}>Détail par catégorie</h3>
          <div style={{ overflowX: 'auto' }}>
            {/* En-tête */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1fr 1fr 80px',
              gap: '12px',
              alignItems: 'center',
              fontWeight: 600,
              fontSize: '13px',
              color: 'var(--muted)',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '8px',
              marginBottom: '6px',
              minWidth: '600px',
            }}>
              <span>Catégorie</span>
              <span style={{ textAlign: 'right' }}>Ventes HT</span>
              <span style={{ textAlign: 'right' }}>Achats HT</span>
              <span style={{ textAlign: 'right' }}>Bénéfice</span>
              <span style={{ textAlign: 'right' }}>Marge</span>
            </div>

            {/* Lignes */}
            <div style={{ display: 'grid', gap: '6px', minWidth: '600px' }}>
              {stats.categories.map((cat) => (
                <div
                  key={cat.name}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1fr 1fr 1fr 80px',
                    gap: '12px',
                    alignItems: 'center',
                    background: '#fff',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '14px',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{cat.name}</span>
                  <span style={{ textAlign: 'right' }}>{fmt(cat.ventes)} Ar</span>
                  <span style={{ textAlign: 'right', color: '#b45309' }}>{fmt(cat.achats)} Ar</span>
                  <span style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    color: cat.benefice >= 0 ? '#166534' : '#b91c1c',
                  }}>
                    {cat.benefice >= 0 ? '+' : ''}{fmt(cat.benefice)} Ar
                  </span>
                  <span style={{
                    textAlign: 'right',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: cat.marge >= 0 ? '#166534' : '#b91c1c',
                  }}>
                    {cat.marge.toFixed(1)}%
                  </span>
                </div>
              ))}

              {/* Ligne total */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1fr 1fr 80px',
                gap: '12px',
                alignItems: 'center',
                background: '#f8fafc',
                border: '2px solid var(--border)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '14px',
                fontWeight: 700,
              }}>
                <span>Total</span>
                <span style={{ textAlign: 'right' }}>{fmt(stats.totalVentesHT)} Ar</span>
                <span style={{ textAlign: 'right', color: '#b45309' }}>{fmt(stats.totalAchatsHT)} Ar</span>
                <span style={{
                  textAlign: 'right',
                  color: stats.totalBenefice >= 0 ? '#166534' : '#b91c1c',
                }}>
                  {stats.totalBenefice >= 0 ? '+' : ''}{fmt(stats.totalBenefice)} Ar
                </span>
                <span style={{
                  textAlign: 'right',
                  fontSize: '13px',
                  color: stats.totalBenefice >= 0 ? '#166534' : '#b91c1c',
                }}>
                  {stats.totalVentesHT > 0
                    ? (((stats.totalVentesHT - stats.totalAchatsHT) / stats.totalVentesHT) * 100).toFixed(1)
                    : '0.0'}%
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && stats?.categories.length === 0 ? (
        <p className="bo-muted">Aucune commande livrée pour calculer les bénéfices.</p>
      ) : null}
    </section>
  )
}
