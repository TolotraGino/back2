export const ORDER_STATES = {
  PAID: 2,
  CANCELLED: 6,
  ERROR: 8,
  CART_ONLY: 14,
  DEFAULT_CREATE: 13,
}

export const ORDER_STATUS_OPTIONS = {
  paiement_effectue: { label: 'Paiement accepte', id: ORDER_STATES.PAID },
  annule: { label: 'Annule', id: ORDER_STATES.CANCELLED },
}
