export class FrontCustomer {
  constructor({
    id = '',
    email = '',
    firstname = '',
    lastname = '',
    secure_key = '',
    anonymous = false,
  } = {}) {
    this.id = String(id || '')
    this.email = String(email || '')
    this.firstname = String(firstname || '')
    this.lastname = String(lastname || '')
    this.secure_key = String(secure_key || '')
    this.anonymous = Boolean(anonymous)
  }

  static anonymous() {
    return new FrontCustomer({
      id: 'anonymous',
      email: 'anonyme@local',
      firstname: 'Utilisateur',
      lastname: 'anonyme',
      anonymous: true,
    })
  }

  getDisplayName() {
    if (this.anonymous) return 'Utilisateur anonyme'
    const full = `${this.firstname} ${this.lastname}`.trim()
    return full || this.email || 'Utilisateur'
  }
}
