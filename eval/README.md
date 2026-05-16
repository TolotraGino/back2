# Eval2026 - Frontoffice / Backoffice PrestaShop

## Demarrage
```bash
cd eval
npm install
npm run dev
```

## Prerequis
- Node.js 20.19+ (ou 22.12+)
- Un acces API PrestaShop (token + URL)

## Variables d environnement
Creer `.env` dans `eval/`:
```env
VITE_API_BASE_URL=http://localhost/api
VITE_API_TOKEN=your_token_here
VITE_API_AUTH_SCHEME=basic
```

## Structure projet
- `src/routes.js`: source unique des routes (front + back + resolvers)
- `src/core/http/`: socle OO HTTP (`ApiClient`)
- `src/frontoffice/`
- `pages/`: ecrans boutique
- `components/`: composants UI
- `services/`: facade + classes metier (ex: `CartService`)
- `hooks/`: hooks custom (`useCartCount`)
- `src/backoffice/`
- `pages/`: login, dashboard, commandes, import, reset
- `services/`: auth + order services OO (`AuthService`, `OrderService`)
- `models/`: modeles metier OO (`Order`)
- `functions/`: catalogues/helpers metier
- `src/services/`: service API partage
- `src/landing/pages/`: page d entree

## Routes
- `/` -> landing
- `/shop` -> frontoffice
- `/product/:id` -> fiche produit
- `/cart` -> panier
- `/orders` -> commandes client
- `/bo` -> backoffice (dashboard)
- `/bo/reset` -> backoffice reset data
- `/bo/orders` -> backoffice commandes
- `/bo/csvimport` -> backoffice import CSV
- `/csvimport` -> alias legacy vers page CSV backoffice

## Guard backoffice
- Les pages backoffice sont protegees par session locale.
- Si session absente/invalide et URL backoffice ouverte directement (ex: `/csvimport`, `/bo/orders`), affichage du login backoffice.

## Docs a lire
- `docs/architecture-oo.md`
- `docs/project-structure.md`
- `docs/guide-structure-hooks-oo.md`
- `docs/frontoffice.md`
- `docs/frontoffice-user-selector.md`
- `docs/frontoffice-product-badges.md`
- `docs/frontoffice-product-search.md`
- `docs/login-front.md`
- `docs/workflow-achat.md`
- `docs/commande.md`
- `docs/csv-import.md`
- `docs/reset-data-plan.md`
- `docs/backoffice-todo.md`
