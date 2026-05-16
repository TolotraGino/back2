# Page Commandes (Backoffice)

## Objectif
Afficher toutes les commandes et permettre de modifier leur etat.

## Fichier implemente
- `eval/src/backoffice/pages/OrdersPage.jsx`
- `eval/src/backoffice/services/OrderService.js`
- `eval/src/backoffice/models/Order.js`
- Styles: `eval/src/backoffice/backoffice.css`
- API shared service: `eval/src/services/apiService.js`

## Etats disponibles (mapping actuel)
- `paiement_effectue` -> `2`
- `annule` -> `6`

### Signification metier
- `paiement_effectue (2)`: commande validee avec paiement accepte.
- `annule (6)`: commande annulee.
- `dans_panier`: ce n est pas un etat de commande, c est un etat metier du panier (avant creation commande).

## Classes / fonctions utilisees dans `OrdersPage`

### Couche OO
- `OrderService.fetchOrders()` : charge toutes les commandes et retourne des objets `Order`.
- `OrderService.updateOrderState(orderId, nextStateId)` : met a jour l etat de commande via XML.
- `Order.getDisplayDate()` : renvoie `csvDate` ou `date_add`.
- `Order.getAmountNumber()` : convertit le montant en nombre exploitable.

### Parsing XML
- `parseOrderList(xmlText)` : extrait la liste des IDs depuis `/api/orders/`.
- `getText(node, tag)` : helper de lecture XML.
- `parseOrderDetail(xmlText)` : transforme un XML commande en objet UI.
- `resolveStatusKey(currentStateId)` : convertit l ID Presta vers cle interne du select.

### Mise a jour etat
- `updateOrderState(orderId, nextStateId)` :
- charge la commande (`GET /orders/{id}`)
- met a jour `current_state` + `xlink:href`
- renvoie la commande en `PUT /orders/{id}`

## Utilisation Backoffice
- Ouvrir `/bo/orders`.
- Lire la liste des commandes.
- Modifier la colonne `Etat` avec le select (`Paiement accepte`, `Annule`).
- Le changement est envoye directement a PrestaShop via API.

### React / UX
- `loadOrders()` dans `useEffect` : charge liste + details.
- `handleStatusChange(orderId, nextStatusKey)` : met a jour API puis state local React.

## Hook custom
- Aucun hook custom dans cette page.
- Hooks React utilises: `useState`, `useEffect`, `useMemo`.

## Ameliorations recommandees
- Ajouter pagination/filtre date.
- Ajouter confirmation avant changement d etat.
- Centraliser fonctions XML dans `backoffice/functions/` si la logique grandit.
