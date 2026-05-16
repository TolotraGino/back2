import React from 'react'
import './App.css'
import BackofficeApp from './backoffice/pages/BackofficeApp.jsx'
import FrontofficeApp from './frontoffice/FrontofficeApp.jsx'
import Landing from './landing/pages/Landing.jsx'
import Navbar from './frontoffice/components/Navbar.jsx' // Assure-toi que le chemin est bon
import { getPathname, resolveAppSection } from './routes.js'

function App() {
  const path = getPathname()

  // Fonction de déconnexion
  const handleLogout = () => {
    console.log("Utilisateur déconnecté");
    // Optionnel : effacer le localStorage.clear() si tu as un token
    window.location.href = "/"; // Redirige vers la landing ou login
  };

  // 1. Cas de la Landing Page (Pas de Navbar)
  const section = resolveAppSection(path)

  if (section === 'landing') {
    return <Landing />
  }

  // 2. Cas du Backoffice (Pas la même Navbar en général)
  if (section === 'backoffice') {
    return <BackofficeApp />
  }

  // 3. Cas du Frontoffice (On affiche la Navbar PrestaShop ici !)
  return (
    <div className="app-wrapper">
      <Navbar onLogout={handleLogout} />
      
      <main className="app-main">
        {/* Ici FrontofficeApp gère tes routes /product, /cart etc. */}
        <FrontofficeApp />
      </main>
    </div>
  )
}

export default App
