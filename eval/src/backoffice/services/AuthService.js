export class AuthService {
  constructor({
    sessionKey = 'backoffice_session',
    defaultUser = 'admin',
    defaultPass = 'admin',
    sessionTtlSeconds = 60 * 60 * 8,
  } = {}) {
    this.sessionKey = sessionKey
    this.defaultUser = defaultUser
    this.defaultPass = defaultPass
    this.sessionTtlSeconds = sessionTtlSeconds
  }

  base64UrlEncode(value) {
    const base64 = btoa(value)
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  }

  createFakeJwt(payload) {
    const header = { alg: 'HS256', typ: 'JWT' }
    const headerPart = this.base64UrlEncode(JSON.stringify(header))
    const payloadPart = this.base64UrlEncode(JSON.stringify(payload))
    const signaturePart = this.base64UrlEncode('local-dev-signature')
    return `${headerPart}.${payloadPart}.${signaturePart}`
  }

  getUnixSeconds() {
    return Math.floor(Date.now() / 1000)
  }

  createSession(username) {
    const exp = this.getUnixSeconds() + this.sessionTtlSeconds
    const payload = { sub: username, role: 'admin', exp }
    return {
      token: this.createFakeJwt(payload),
      exp,
      user: { username, role: 'admin' },
    }
  }

  saveSession(session) {
    localStorage.setItem(this.sessionKey, JSON.stringify(session))
  }

  loadSession() {
    const raw = localStorage.getItem(this.sessionKey)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  clearSession() {
    localStorage.removeItem(this.sessionKey)
  }

  isSessionValid(session) {
    if (!session?.exp) return false
    return session.exp > this.getUnixSeconds()
  }

  login(username, password) {
    const isValid = username === this.defaultUser && password === this.defaultPass
    if (!isValid) return { ok: false, error: 'Invalid credentials' }

    const session = this.createSession(username)
    this.saveSession(session)
    return { ok: true, session }
  }

  logout() {
    this.clearSession()
  }

  getDefaultCredentials() {
    return { username: this.defaultUser, password: this.defaultPass }
  }
}
