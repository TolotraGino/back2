# Workflow d'achat frontoffice

## Objectif
Comprendre le parcours complet d achat: connexion client, ajout panier, validation commande, suivi.

## Fichiers impliques
- `eval/src/frontoffice/FrontofficeApp.jsx`
- `eval/src/frontoffice/pages/ProductPage.jsx`
- `eval/src/frontoffice/pages/CartPage.jsx`
- `eval/src/frontoffice/pages/OrdersPage.jsx`
- `eval/src/frontoffice/services/cartService.js`
- `eval/src/frontoffice/hooks/useCartCount.js`
- `eval/src/services/apiService.js`

## Parcours utilisateur
1. Connexion client par email.
2. Consultation et selection d un produit.
3. Choix eventuel de declinaison (taille, couleur).
4. Ajout au panier.
5. Saisie adresse + choix transporteur.
6. Creation commande en paiement a la livraison.
7. Consultation de l historique dans `Mes commandes`.

## Fonctions et hooks cle
- `handleLoginSubmit()` : recherche client via `/customers`.
- `addToCart()` : ajoute produit/declinaison dans localStorage.
- `useCartCount()` : met a jour badge panier automatiquement.
- `handleQuantityChange()` / `handleRemove()` : edition panier.
- `createCart()` : cree un panier Presta (`POST /carts`).
- `createOrder()` : cree la commande (`POST /orders`).
- `createOrderHistory()` : applique un etat (`POST /order_histories`).

## Ressources API principales
- `GET /api/products/{id}`
- `GET /api/combinations/?filter[id_product]=[...]`
- `GET /api/stock_availables`
- `POST /api/addresses`
- `GET /api/carriers/?display=full`
- `POST /api/carts`
- `POST /api/orders`
- `POST /api/order_histories`
- `GET /api/orders/?filter[id_customer]=[...]&display=full`

## Notes metier
- Paiement front actuel: `Paiement a la livraison`.
- L etat de commande cible est actuellement `13` (a verifier selon ton PrestaShop).
- Les erreurs API sont remontees dans l interface (`error`).
