# Frontoffice

## Pages
- **Landing** (`/`) : choix Frontoffice / Backoffice.
- **Selection utilisateur** (`/shop` par defaut si non connecte) : choisir un client existant ou `utilisateur anonyme`.
- **Accueil boutique** (`/shop`) : liste produits.
- **Fiche produit** (`/product/{id}`) : detail + variantes.
- **Panier** (`/cart`) : quantites, adresse, transporteur, validation.
- **Mes commandes** (`/orders`) : historique client.

## Navigation
- `/` : page de choix
- `/shop` : accueil frontoffice
- `/product/{id}` : fiche produit
- `/cart` : panier
- `/orders` : mes commandes
- `/bo` : backoffice
- `/bo/reset` : backoffice reset data
- `/bo/orders` : backoffice commandes
- `/bo/csvimport` : backoffice import CSV
- `/csvimport` : alias legacy backoffice CSV

## Architecture (mise a jour)
- `eval/src/routes.js` (source unique des routes et resolvers)
- `eval/src/frontoffice/FrontofficeApp.jsx`
- `eval/src/frontoffice/pages/`
- `eval/src/frontoffice/components/`
- `eval/src/frontoffice/services/CartService.js` (classe OO)
- `eval/src/frontoffice/services/cartService.js`
- `eval/src/frontoffice/hooks/useCartCount.js`
- `eval/src/services/apiService.js`
- `eval/src/core/http/ApiClient.js` (classe OO)
- `eval/src/landing/pages/Landing.jsx`

## Hook utilise

### `useCartCount()`
- **Fichier** : `eval/src/frontoffice/hooks/useCartCount.js`
- **But** : garder le compteur panier synchronise partout dans le front.
- **Comment** :
- lit le panier via `loadCart()`
- calcule le total via `getCartCount()`
- ecoute l evenement custom retourne par `getCartEventName()`
- met a jour l UI automatiquement quand une ligne panier change

## Services / Fonctions cles

### Service API global
- **Fichier** : `eval/src/services/apiService.js`
- Classe utilisee: `ApiClient` (`eval/src/core/http/ApiClient.js`)
- `apiRequestRaw(path, options)` : facade vers `ApiClient.requestRaw(...)`.
- `apiRequest(path, options)` : facade vers `ApiClient.request(...)`.
- `getApiConfig()` : recupere `VITE_API_BASE_URL` et `VITE_API_TOKEN`.

### Service panier
- **Fichier** : `eval/src/frontoffice/services/cartService.js`
- Classe metier: `CartService` (`eval/src/frontoffice/services/CartService.js`)
- Le fichier `cartService.js` expose les memes fonctions qu avant, mais delegue a l instance OO.

## Logique par page

### `ProductList.jsx`
- `GET /api/products/?display=full`
- enrichit chaque produit avec stock, categorie et TVA
- calcule `priceTtc` depuis `priceHt` + taux
- construit l URL image `/api/images/products/{productId}/{imageId}`

### `ProductPage.jsx`
- charge le produit detaille (`/products/{id}`)
- charge combinaisons/attributs (`/combinations`, `product_option_values`, `product_options`)
- recalcule prix selon impact declinaison
- affiche la quantite en stock disponible sur la fiche produit (simple ou declinaison selectionnee)
- `handleAddToCart()` ajoute la ligne puis redirige vers `/cart`

### `CartPage.jsx`
- lit le panier local
- charge transporteurs (`/carriers/?display=full`)
- cree adresse (`POST /addresses`)
- cree panier Presta (`POST /carts`)
- cree commande (`POST /orders`)
- applique etat via `POST /order_histories`

### `OrdersPage.jsx`
- charge etats (`/order_states/?display=full`)
- charge commandes client (`/orders/?filter[id_customer]=[...]&display=full`)
- mappe `current_state` vers libelle lisible

## Notes techniques
- Si les images ne s affichent pas : verifier `VITE_API_TOKEN` et permissions Webservice.
- Le mot de passe du login front n est pas valide cote Presta via cette API : l identification est basee sur l email client.
- Le routage est centralise dans `eval/src/routes.js` (`ROUTES`, `resolveAppSection`, `resolveFrontofficeRoute`, `resolveBackofficePage`).

## Doc specifique
- `docs/frontoffice-user-selector.md`
- `docs/frontoffice-product-badges.md`
- `docs/frontoffice-product-search.md`
