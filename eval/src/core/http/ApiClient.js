export class ApiClient {
  constructor({ baseUrl = '/api', token = '', authScheme = '' } = {}) {
    this.baseUrl = this.normalizeBaseUrl(baseUrl)
    this.token = token
    this.authScheme = String(authScheme || '').toLowerCase()
  }

  normalizeBaseUrl(baseUrl) {
    if (!baseUrl) return '/api'
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  }

  resolveAuthHeader(token) {
    if (this.authScheme === 'basic') return `Basic ${btoa(`${token}:`)}`
    if (this.authScheme === 'bearer') return `Bearer ${token}`
    if (token.includes('.')) return `Bearer ${token}`
    return `Basic ${btoa(`${token}:`)}`
  }

  resolveUrl(path) {
    if (path.startsWith('http')) return path
    return `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
  }

  withAuthHeaders(headers = new Headers()) {
    if (this.token && !headers.has('Authorization')) {
      headers.set('Authorization', this.resolveAuthHeader(this.token))
    }
    return headers
  }

  async request(path, options = {}) {
    const headers = this.withAuthHeaders(new Headers(options.headers || {}))
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(this.resolveUrl(path), {
      ...options,
      headers,
    })

    let data = null
    try {
      data = await response.json()
    } catch {
      data = null
    }

    return { ok: response.ok, status: response.status, data }
  }

  async requestRaw(path, options = {}) {
    const headers = this.withAuthHeaders(new Headers(options.headers || {}))
    const response = await fetch(this.resolveUrl(path), {
      ...options,
      headers,
    })
    const text = await response.text()
    return { ok: response.ok, status: response.status, text }
  }
}
