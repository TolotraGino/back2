import { useState } from 'react'
import { getDefaultCredentials } from '../services/auth.js'

function Login({ onLogin }) {
  const defaults = getDefaultCredentials()
  const [username, setUsername] = useState(defaults.username)
  const [password, setPassword] = useState(defaults.password)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    const result = onLogin(username.trim(), password)
    if (!result.ok) {
      setError(result.error)
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
  }

  return (
    <main className="bo-shell">
      <section className="bo-card">
        <div className="bo-header">
          <p className="bo-kicker">Backoffice</p>
          <h1>Welcome back</h1>
          <p className="bo-subtitle">Use the default admin credentials to continue.</p>
        </div>

        <form className="bo-form" onSubmit={handleSubmit}>
          <label className="bo-field">
            <span>Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>

          <label className="bo-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <p className="bo-error">{error}</p> : null}

          <button className="bo-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="bo-hint">
          <div>
            <span>Default user</span>
            <strong>{defaults.username}</strong>
          </div>
          <div>
            <span>Default password</span>
            <strong>{defaults.password}</strong>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Login
