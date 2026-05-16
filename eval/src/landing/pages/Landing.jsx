import '../landing.css'

export default function Landing() {
  return (
    <div className="landing-shell">
      <div className="landing-card">
        <h1>Bienvenue</h1>
        <p>Choisissez l'interface :</p>
        <div className="landing-actions">
          <a className="landing-button" href="/shop">Frontoffice</a>
          <a className="landing-button landing-secondary" href="/bo">Backoffice</a>
        </div>
      </div>
    </div>
  )
}
