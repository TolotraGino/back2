import { useEffect, useState } from 'react'
import CartPage from './pages/CartPage.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import ProductList from './pages/ProductList.jsx'
import ProductPage from './pages/ProductPage.jsx'
import CustomerSelectPage from './pages/CustomerSelectPage.jsx'
import useCartCount from './hooks/useCartCount.js'
import {
  clearCart,
  clearCustomer,
  clearToken,
  createToken,
  loadCustomer,
  saveCustomer,
  saveToken,
} from './services/cartService.js'
import './front.css'
import { getPathname, resolveFrontofficeRoute, ROUTES } from '../routes.js'

export default function FrontofficeApp() {
  const [customer, setCustomer] = useState(null)
  const cartCount = useCartCount()
  const path = getPathname()

  useEffect(() => {
    const stored = loadCustomer()
    if (stored) setCustomer(stored)
  }, [])

  const handleSelectCustomer = (selectedCustomer) => {
    setCustomer(selectedCustomer)
    saveCustomer(selectedCustomer)
    saveToken(createToken())
  }

  const handleLogout = () => {
    setCustomer(null)
    clearCart()
    clearCustomer()
    clearToken()
  }

  const frontRoute = resolveFrontofficeRoute(path)

  let content = customer ? <ProductList /> : <CustomerSelectPage onSelectCustomer={handleSelectCustomer} />
  if (frontRoute.page === 'product') {
    content = <ProductPage id={frontRoute.productId} />
  } else if (frontRoute.page === 'cart') {
    content = <CartPage customer={customer} />
  } else if (frontRoute.page === 'orders') {
    content = <OrdersPage customer={customer} />
  }

  return (
    <div className="fo-shell">
      <header className="fo-header">
        <div className="fo-header-row">
          <h1 className="fo-header-title">Mini Boutique</h1>
          <div className="fo-header-actions">
            <nav className="fo-nav">
              <button type="button" onClick={() => (window.location.href = ROUTES.frontoffice.shop)} className="fo-nav-button">
                Boutique
              </button>
              <button type="button" onClick={() => (window.location.href = ROUTES.frontoffice.cart)} className="fo-nav-button">
                Panier <span className="fo-cart-count">{cartCount}</span>
              </button>
              <button type="button" onClick={() => (window.location.href = ROUTES.frontoffice.orders)} className="fo-nav-button">
                Mes commandes
              </button>
            </nav>
            {customer ? (
              <div className="fo-login-user">
                <span>{customer.anonymous ? 'Utilisateur anonyme' : (customer.firstname ? `${customer.firstname} ${customer.lastname || ''}`.trim() : customer.email)}</span>
                <button className="fo-login-button" type="button" onClick={handleLogout}>
                  Deconnexion
                </button>
              </div>
            ) : (
              <button className="fo-login-button" type="button" onClick={() => (window.location.href = ROUTES.frontoffice.shop)}>
                Choisir utilisateur
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="fo-main">
        {content}
      </main>
    </div>
  )
}
