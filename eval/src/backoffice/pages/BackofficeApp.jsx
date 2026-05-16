import { useState } from 'react'
import {
  loadSession,
  isSessionValid,
  logout,
  login,
} from '../services/auth.js'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'
import '../backoffice.css'
import { getPathname, resolveBackofficePage } from '../../routes.js'

function BackofficeApp() {
  const requestedPage = resolveBackofficePage(getPathname())
  const [session, setSession] = useState(() => {
    const loaded = loadSession()
    if (loaded && !isSessionValid(loaded)) {
      logout()
      return null
    }
    return loaded
  })

  const handleLogin = (username, password) => {
    const result = login(username, password)
    if (result.ok) {
      setSession(result.session)
    }
    return result
  }

  const handleLogout = () => {
    logout()
    setSession(null)
  }

  if (!session || !isSessionValid(session)) {
    return <Login onLogin={handleLogin} />
  }

  return <Dashboard onLogout={handleLogout} initialPage={requestedPage} />
}

export default BackofficeApp
