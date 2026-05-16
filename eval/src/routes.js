export const ROUTES = {
  landing: '/',
  frontoffice: {
    shop: '/shop',
    cart: '/cart',
    orders: '/orders',
    productPrefix: '/product/',
  },
  backoffice: {
    base: '/bo',
    reset: '/bo/reset',
    orders: '/bo/orders',
    stock: '/bo/stock',
    csvImport: '/bo/csvimport',
    legacyCsvImport: '/csvimport',
  },
}

export function getPathname() {
  return typeof window !== 'undefined' ? window.location.pathname : ROUTES.landing
}

export function resolveAppSection(pathname) {
  if (pathname === ROUTES.landing || pathname === '') {
    return 'landing'
  }

  const { backoffice } = ROUTES
  const isBackofficePath =
    pathname.startsWith(backoffice.base) || pathname === backoffice.legacyCsvImport

  return isBackofficePath ? 'backoffice' : 'frontoffice'
}

export function resolveBackofficePage(pathname) {
  const { backoffice } = ROUTES

  if (pathname === backoffice.csvImport || pathname === backoffice.legacyCsvImport) {
    return 'csv'
  }

  if (pathname === backoffice.orders) {
    return 'orders'
  }

  if (pathname === backoffice.stock) {
    return 'stock'
  }

  return 'reset'
}

export function resolveFrontofficeRoute(pathname) {
  const { frontoffice } = ROUTES

  if (pathname.startsWith(frontoffice.productPrefix)) {
    const productId = pathname.replace(frontoffice.productPrefix, '').split('/')[0]
    return { page: 'product', productId }
  }

  if (pathname.startsWith(frontoffice.cart)) {
    return { page: 'cart' }
  }

  if (pathname.startsWith(frontoffice.orders)) {
    return { page: 'orders' }
  }

  return { page: 'shop' }
}
