import { CartService } from './CartService.js'

const cartService = new CartService()

export const loadCart = () => cartService.loadCart()
export const saveCart = (cart) => cartService.saveCart(cart)
export const getCartCount = (cart) => cartService.getCartCount(cart)
export const addToCart = (item, quantity = 1) => cartService.addToCart(item, quantity)
export const updateCartItem = (lineId, quantity) => cartService.updateCartItem(lineId, quantity)
export const removeCartItem = (lineId) => cartService.removeCartItem(lineId)
export const clearCart = () => cartService.clearCart()
export const loadCustomer = () => cartService.loadCustomer()
export const saveCustomer = (customer) => cartService.saveCustomer(customer)
export const clearCustomer = () => cartService.clearCustomer()
export const loadToken = () => cartService.loadToken()
export const saveToken = (token) => cartService.saveToken(token)
export const clearToken = () => cartService.clearToken()
export const createToken = () => cartService.createToken()
export const getCartEventName = () => cartService.cartEventName
