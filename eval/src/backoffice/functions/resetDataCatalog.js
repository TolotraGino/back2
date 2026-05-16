



export const RESET_CATEGORIES = [
  {
    id: 'catalog',
    label: 'Produits',
    items: [
      // Prix spécifiques d'abord (dépend de produits/combinaisons)
      'specific_prices',
      // Variantes/stock avant produit parent
      'stock_availables',
      'combinations',
      // Options/valeurs de déclinaisons
      'product_option_values',
      'product_options',
      // Produits et catégories
      'products',
      'categories',
    ],
  },

  {
    id: 'customers',
    label: 'Clients',
    items: [
      // Adresses avant clients
      'addresses',
      'customers',
    ],
  },

  {
    id: 'orders',
    label: 'Commandes',
    items: [
      // Détails/historique/paiement avant commande parent
      'order_details',
      'order_histories',
      'order_payments',
      'orders',
      // Activer seulement si tu veux supprimer des états personnalisés.
      // Certains états natifs sont protégés côté PrestaShop.
      // 'order_states',
    ],
  },

  {
    id: 'localization',
    label: 'Taxes',
    items: [
      'tax_rules',
      'tax_rule_groups',
      'taxes',
    ],
  },

  {
    id: 'stock',
    label: 'Panier',
    items: [
      'carts',
    ],
  },
];
