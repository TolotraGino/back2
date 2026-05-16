# Architecture Orientee Objet (OO)

## Objectif
Structurer le projet autour de classes metier et services, tout en gardant les composants React fonctionnels pour l UI.

## Principe
- UI React: composants + hooks.
- Metier et integration API: classes OO.
- Compatibilite: les anciens helpers exportes restent utilisables.

## Classes introduites

### API
- `eval/src/core/http/ApiClient.js`
  - classe `ApiClient`
  - responsabilites: auth header, resolution URL, requetes JSON/RAW

- `eval/src/services/apiService.js`
  - facade compatible (`apiRequest`, `apiRequestRaw`, `testApiConnection`)
  - delegue a `ApiClient`

### Backoffice
- `eval/src/backoffice/services/AuthService.js`
  - classe `AuthService`
  - session locale, login/logout, validation `exp`, fake JWT local

- `eval/src/backoffice/services/auth.js`
  - facade legacy vers `AuthService`

- `eval/src/backoffice/models/Order.js`
  - classe `Order`
  - responsabilites: date d affichage, montant numerique, jour normalise

- `eval/src/backoffice/services/OrderService.js`
  - classe `OrderService`
  - responsabilites:
    - lecture commandes API
    - parsing XML vers objets `Order`
    - mise a jour etat commande
    - agregation commandes par jour

### Frontoffice
- `eval/src/frontoffice/services/CartService.js`
  - classe `CartService`
  - responsabilites: persistance panier/client/token + operations panier

- `eval/src/frontoffice/services/cartService.js`
  - facade legacy vers `CartService`

## Pages branchees en OO
- `eval/src/backoffice/pages/OrdersPage.jsx`
  - utilise `OrderService` + `Order`
- `eval/src/backoffice/pages/DashboardStatsPage.jsx`
  - utilise `OrderService.groupByDay()`

## Limites actuelles
- `CSVImportPage.jsx` et `CartPage.jsx` contiennent encore beaucoup de logique locale; prochaine etape recommandee: extraire en classes metier dediees.
