import { ApiClient } from '../core/http/ApiClient.js'

export function getApiConfig() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  const token = import.meta.env.VITE_API_TOKEN || ''
  const authScheme = import.meta.env.VITE_API_AUTH_SCHEME || ''

  return { baseUrl, token, authScheme }
}

export function createApiClient() {
  return new ApiClient(getApiConfig())
}

export async function apiRequest(path, options = {}) {
  return createApiClient().request(path, options)
}

export async function apiRequestRaw(path, options = {}) {
  return createApiClient().requestRaw(path, options)
}

export async function testApiConnection(path = '/health') {
  if (!path) {
    return { ok: false, status: 0, data: null }
  }

  const { token } = getApiConfig()
  if (!token) {
    return { ok: false, status: 0, data: { error: 'Missing token' } }
  }

  return apiRequest(path, { method: 'GET' })
}
