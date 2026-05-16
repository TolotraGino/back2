export class Order {
  constructor({
    id = 0,
    reference = '',
    customer = '',
    total = '0',
    payment = '',
    date = '',
    currentStateId = 0,
    csvDate = '',
  } = {}) {
    this.id = Number.parseInt(id, 10) || 0
    this.reference = reference
    this.customer = customer
    this.total = total
    this.payment = payment
    this.date = date
    this.currentStateId = Number.parseInt(currentStateId, 10) || 0
    this.csvDate = csvDate
  }

  getDisplayDate() {
    return this.csvDate || this.date
  }

  getAmountNumber() {
    const parsed = Number.parseFloat(this.total || '0')
    return Number.isFinite(parsed) ? parsed : 0
  }

  getDay() {
    const dateValue = this.getDisplayDate()
    if (!dateValue) return ''
    const ddmmyyyy = String(dateValue).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`
    return String(dateValue).slice(0, 10)
  }
}
