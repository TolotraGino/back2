# Guide Structure + Hooks + OO

## But
Comprendre clairement comment ton projet est organise et comment coder de nouvelles features sans casser l architecture.

## 1) Structure du projet

### `eval/src/core/`
Infrastructure technique generique.
- Exemple: `core/http/ApiClient.js`
- Role: construire URL API, ajouter auth headers, executer requetes.

### `eval/src/shared/`
Utilitaires reutilisables par frontoffice et backoffice.
- Exemple: `shared/xml/xmlUtils.js`
- Role: parsing XML, extraction de texte, serialisation.

### `eval/src/services/`
Facade globale.
- Exemple: `services/apiService.js`
- Role: exposer `apiRequest`/`apiRequestRaw` en deleguant vers `ApiClient`.

### `eval/src/backoffice/`
- `models/`: objets metier (ex: `Order`)
- `services/`: logique metier (ex: `OrderService`, `AuthService`)
- `pages/`: UI React
- `constants/`: constantes (ex: etats commandes)

### `eval/src/frontoffice/`
- `models/`: objets metier front (ex: `FrontCustomer`)
- `services/`: logique front (panier, filtres, badges, users)
- `hooks/`: hooks custom
- `pages/`: ecrans
- `components/`: composants UI reutilisables

## 2) Pattern model / service / page

### Model
Objet metier avec ses methodes proches.
- `backoffice/models/Order.js`
  - `getDisplayDate()`
  - `getDay()`
  - `getAmountNumber()`

### Service
Logique metier/API.
- `backoffice/services/OrderService.js`:
  - charge commandes API
  - parse XML
  - retourne des `Order`
  - met a jour les etats

### Page
Orchestration UI.
- `backoffice/pages/OrdersPage.jsx`:
  - appelle `OrderService.fetchOrders()`
  - stocke resultat dans state
  - rend la table

## 3) Hooks utilises dans ton projet

### `useState`
Stocke l etat local d une page.
- Exemples:
  - `ProductList.jsx` (`products`, `loading`, filtres)
  - `CSVImportPage.jsx` (fichiers importes, resultats, erreurs)

### `useEffect`
Lance des effets de bord (chargement API, abonnements).
- Exemples:
  - `ProductList.jsx`: chargement produits a l ouverture
  - `FrontofficeApp.jsx`: restauration utilisateur depuis localStorage

### `useMemo`
Memoise un calcul derive (perf + lisibilite).
- Exemples:
  - `ProductList.jsx`: `filteredProducts`, `categories`
  - `DashboardStatsPage.jsx`: totaux d affichage

### `useRef`
Stockage mutable sans re-render.
- Exemple:
  - `CSVImportPage.jsx`: `taxRateCacheRef`, `mgCountryIdRef`

### Hook custom: `useCartCount`
Fichier: `frontoffice/hooks/useCartCount.js`
- ecoute l evenement panier (`fo-cart-updated`)
- recalcule le compteur panier automatiquement

## 4) Exemples OO pris de TON code

### Exemple A - Service metier
`ProductFilterService` (`frontoffice/services/ProductFilterService.js`)
- regroupe la logique de filtre:
  - nom
  - categorie
  - intervalle prix
- la page n a plus besoin de re-ecrire la logique.

### Exemple B - Service regle metier date
`ProductBadgeService` (`frontoffice/services/ProductBadgeService.js`)
- convertit `available_date`
- decide le badge `HOT` / `NEW`.

### Exemple C - Model metier
`FrontCustomer` (`frontoffice/models/FrontCustomer.js`)
- encapsule le format utilisateur
- factory `anonymous()`
- methode `getDisplayName()`.

## 5) Comment ajouter une nouvelle fonctionnalite proprement
1. Mettre les regles metier dans un `service`.
2. Si besoin d un objet riche, creer un `model`.
3. Dans la `page`, appeler le service et afficher.
4. Mettre les helpers transverses dans `shared/`.
5. Documenter la feature dans `docs/`.
