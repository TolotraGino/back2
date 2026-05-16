export class ProductBadgeService {
  parseDateOnly(value) {
    const raw = String(value || '').trim()
    if (!raw) return null
    const yyyyMmDd = raw.slice(0, 10)
    const date = new Date(`${yyyyMmDd}T00:00:00`)
    return Number.isNaN(date.getTime()) ? null : date
  }

  getDayDiffFromToday(availableDate) {
    const productDate = this.parseDateOnly(availableDate)
    if (!productDate) return Number.POSITIVE_INFINITY

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffMs = today.getTime() - productDate.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }

  resolveBadge(availableDate) {
    const days = this.getDayDiffFromToday(availableDate)
    if (days >= 0 && days <= 1) {
      return { code: 'HOT', className: 'fo-flag-hot' }
    }
    if (days > 1 && days <= 7) {
      return { code: 'NEW', className: 'fo-flag-new' }
    }
    return null
  }
}
