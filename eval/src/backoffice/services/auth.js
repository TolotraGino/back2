import { AuthService } from './AuthService.js'

const authService = new AuthService()

export function createSession(username) {
  return authService.createSession(username)
}

export function saveSession(session) {
  return authService.saveSession(session)
}

export function loadSession() {
  return authService.loadSession()
}

export function clearSession() {
  return authService.clearSession()
}

export function isSessionValid(session) {
  return authService.isSessionValid(session)
}

export function login(username, password) {
  return authService.login(username, password)
}

export function logout() {
  return authService.logout()
}

export function getDefaultCredentials() {
  return authService.getDefaultCredentials()
}
