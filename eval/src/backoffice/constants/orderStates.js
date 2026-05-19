export const ORDER_STATES = {
  CART_ONLY:      14, // panier uniquement, pas encore une commande
  PAID:            2, // paiement accepte (stock PAS encore diminue)
  PREPARING:       3, // en cours de preparation
  DELIVERED:       5, // livre (shipped=1 → le stock DIMINUE ici)
  CANCELLED:       6, // annule
  ERROR:           8, // erreur de paiement
  DEFAULT_CREATE: 13,
}

// Etiquette + couleur pour chaque etat affiche dans la liste
export const ORDER_STATE_META = {
  [ORDER_STATES.CART_ONLY]:  { label: 'Dans le panier', color: '#64748b', bg: '#f1f5f9' },
  [ORDER_STATES.PAID]:       { label: 'Paiement accepte', color: '#1d4ed8', bg: '#eff6ff' },
  [ORDER_STATES.PREPARING]:  { label: 'En preparation', color: '#b45309', bg: '#fffbeb' },
  [ORDER_STATES.DELIVERED]:  { label: 'Livre', color: '#166534', bg: '#f0fdf4' },
  [ORDER_STATES.CANCELLED]:  { label: 'Annule', color: '#b91c1c', bg: '#fef2f2' },
  [ORDER_STATES.ERROR]:      { label: 'Erreur paiement', color: '#9f1239', bg: '#fff1f2' },
  [ORDER_STATES.DEFAULT_CREATE]: { label: 'En attente', color: '#6b7280', bg: '#f9fafb' },
}

// Pour l'import CSV
export const ORDER_STATUS_OPTIONS = {
  paiement_effectue: { label: 'Paiement accepte', id: ORDER_STATES.PAID },
  annule:            { label: 'Annule',            id: ORDER_STATES.CANCELLED },
}
