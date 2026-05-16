import { useEffect, useState } from 'react'
import { getCartCount, getCartEventName, loadCart } from '../services/cartService.js'

export default function useCartCount() {
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const updateCount = () => setCartCount(getCartCount(loadCart()))
    updateCount()
    const eventName = getCartEventName()
    window.addEventListener(eventName, updateCount)
    return () => window.removeEventListener(eventName, updateCount)
  }, [])

  return cartCount
}
