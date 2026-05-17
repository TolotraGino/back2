# Documentation technique — Application `eval`

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Point d'entrée et démarrage](#2-point-dentrée-et-démarrage)
3. [Système de routage (routes.js)](#3-système-de-routage-routesjs)
4. [App.jsx — Aiguilleur principal](#4-appjsx--aiguilleur-principal)
5. [Landing Page](#5-landing-page)
6. [Frontoffice](#6-frontoffice)
7. [Backoffice](#7-backoffice)
8. [Couche HTTP — ApiClient et apiService](#8-couche-http--apiclient-et-apiservice)
9. [Utilitaires XML partagés](#9-utilitaires-xml-partagés)
10. [Résumé des flux principaux](#10-résumé-des-flux-principaux)

---

## 1. Vue d'ensemble

L'application est une **SPA React** (Vite + React 19) connectée à l'API REST de **PrestaShop**. Elle est divisée en trois sections indépendantes, choisies dynamiquement selon l'URL, sans React Router :

| Section | URL | Rôle |
|---|---|---|
| Landing | `/` | Page d'accueil avec choix d'interface |
| Frontoffice | `/shop`, `/cart`, `/orders`, `/product/:id` | Boutique client |
| Backoffice | `/bo`, `/bo/orders`, `/bo/stock`, `/bo/csvimport`, `/bo/reset` | Administration |

Il n'y a **pas de router déclaratif**. La navigation se fait par `window.location.href = '...'` (redirection dure, rechargement de page complet).

---

## 2. Point d'entrée et démarrage

### `main.jsx`

```
createRoot(document.getElementById('root')).render(<App />)
```

C'est le point d'entrée standard Vite/React. Il monte le composant `App` dans la `div#root` du fichier `index.html`.

### `package.json`

Dépendances principales :
- **react / react-dom 19** — framework UI
- **jszip** — lecture de fichiers ZIP (import d'images)
- **vite** — bundler et serveur de développement

Commandes :
- `npm run dev` — démarre le serveur local
- `npm run build` — compile pour la production

---

## 3. Système de routage (`routes.js`)

Ce fichier est le **seul endroit** où les URLs sont définies. Il exporte des constantes et des fonctions pour lire l'URL actuelle.

### Constante `ROUTES`

Toutes les routes de l'application en un seul objet :

```js
ROUTES.landing           // '/'
ROUTES.frontoffice.shop  // '/shop'
ROUTES.frontoffice.cart  // '/cart'
ROUTES.frontoffice.orders// '/orders'
ROUTES.frontoffice.productPrefix // '/product/'
ROUTES.backoffice.base   // '/bo'
ROUTES.backoffice.orders // '/bo/orders'
ROUTES.backoffice.stock  // '/bo/stock'
ROUTES.backoffice.csvImport     // '/bo/csvimport'
ROUTES.backoffice.legacyCsvImport // '/csvimport'  (ancienne URL)
ROUTES.backoffice.reset  // '/bo/reset'
```

### `getPathname()`

Lit `window.location.pathname` (retourne `/` en environnement non-navigateur, par sécurité).

### `resolveAppSection(pathname)` → `'landing' | 'backoffice' | 'frontoffice'`

Décide quelle grande section afficher :
- `'/'` ou vide → `'landing'`
- commence par `/bo` ou est `/csvimport` → `'backoffice'`
- tout le reste → `'frontoffice'`

### `resolveBackofficePage(pathname)` → `'csv' | 'orders' | 'stock' | 'reset'`

Depuis une URL backoffice, retourne le nom de la page active. Valeur par défaut : `'reset'`.

### `resolveFrontofficeRoute(pathname)` → `{ page, productId? }`

Depuis une URL frontoffice, retourne quelle page afficher :
- `/product/42` → `{ page: 'product', productId: '42' }`
- `/cart` → `{ page: 'cart' }`
- `/orders` → `{ page: 'orders' }`
- autre → `{ page: 'shop' }`

---

## 4. `App.jsx` — Aiguilleur principal

`App` est le composant racine. Il lit le pathname une seule fois au montage, résout la section et rend le bon sous-composant :

```
pathname → resolveAppSection(pathname)
  'landing'    → <Landing />
  'backoffice' → <BackofficeApp />
  'frontoffice'→ <Navbar> + <FrontofficeApp />
```

**Fonction `handleLogout`** : vide le localStorage et redirige vers `/`. Elle est passée à `<Navbar>` sous la prop `onLogout`.

---

## 5. Landing Page

### `Landing.jsx`

Composant purement statique. Affiche deux liens :
- `href="/shop"` → ouvre le frontoffice
- `href="/bo"` → ouvre le backoffice

Aucune logique métier.

---

## 6. Frontoffice

### 6.1 `FrontofficeApp.jsx` — Chef d'orchestre du frontoffice

C'est le composant principal du frontoffice. Il gère :

**État global :**
- `customer` — le client connecté (objet `FrontCustomer` ou `null`)
- `cartCount` — nombre d'articles dans le panier (via le hook `useCartCount`)

**Au montage (`useEffect`)** : charge le client depuis le localStorage avec `loadCustomer()`.

**`handleSelectCustomer(selectedCustomer)`** : appelée quand un client choisit son identité. Sauvegarde le client (`saveCustomer`) et crée un token de session aléatoire (`createToken` + `saveToken`).

**`handleLogout()`** : réinitialise tout — client, panier, token.

**Rendu conditionnel selon l'URL** :

```
resolveFrontofficeRoute(path)
  page = 'product' → <ProductPage id={...} />
  page = 'cart'    → <CartPage customer={...} />
  page = 'orders'  → <OrdersPage customer={...} />
  page = 'shop'    → <ProductList /> si customer, sinon <CustomerSelectPage />
```

Le header contient la navigation (boutons qui font `window.location.href = ...`) et affiche le nom du client connecté avec un bouton Déconnexion.

---

### 6.2 `CustomerSelectPage.jsx` — Sélection du client

Affiché quand personne n'est connecté sur `/shop`.

Au montage, appelle `CustomerDirectoryService.listCustomers()` qui fait un `GET /customers/?display=full` sur l'API PrestaShop et retourne la liste des clients.

L'utilisateur peut :
- Cliquer sur un client existant → appelle `onSelectCustomer(customer)`
- Cliquer sur "Continuer en anonyme" → appelle `onSelectCustomer(FrontCustomer.anonymous())`

---

### 6.3 `ProductList.jsx` — Liste des produits

Au montage, enchaîne plusieurs appels API pour construire chaque produit :

1. `GET /products/?display=full` — liste brute
2. Pour chaque produit : `GET /stock_availables/?filter[id_product]=[id]` — quantité
3. `GET /categories/{id}` — nom de la catégorie
4. `GET /tax_rule_groups/{id}` → `GET /tax_rules/{id}` → `GET /taxes/{id}` — taux de TVA
5. Calcule le prix TTC : `priceHT * (1 + taxRate/100)`
6. `ProductBadgeService.resolveBadge(availableDate)` — badge HOT/NEW selon la date

**Filtrage local** (sans appel API) via `ProductFilterService` :
- `nameQuery` — filtre par nom (recherche partielle insensible à la casse)
- `selectedCategory` — filtre par catégorie exacte
- `minPrice / maxPrice` — filtre par fourchette de prix TTC

Cliquer sur une card redirige vers `/product/{id}`.

**`buildImageUrl(productId, imageId)`** : construit l'URL de l'image en ajoutant `?ws_key=TOKEN` si un token API est défini.

**`roundPrice(value)`** : parse un string en float, retourne `'0.00'` si invalide.

---

### 6.4 `ProductPage.jsx` — Fiche produit

Reçoit l'`id` du produit en prop (extrait de l'URL par `routes.js`).

Au montage, enchaîne les mêmes appels que ProductList pour récupérer les détails, plus :
- `GET /combinations/?filter[id_product]=[id]` — déclinaisons (taille, couleur, etc.)
- Pour chaque déclinaison : `GET /product_option_values/{id}` et `GET /product_options/{id}` pour récupérer les noms d'attributs et les groupes

**Gestion des déclinaisons :**
- `attributeGroups` — liste des groupes (ex: Taille, Couleur)
- `selectedAttributes` — map `{ groupId → valueId }` des sélections de l'utilisateur
- `selectedCombination` — la déclinaison qui correspond aux attributs sélectionnés (cherché par correspondance de `attributeValueIds`)
- Un `useEffect` séparé surveille `selectedCombination` pour charger le stock spécifique à la déclinaison

**`handleAddToCart()`** :
1. Calcule le prix avec l'impact de la déclinaison : `basePriceHt + priceImpact`
2. Appelle `addToCart(...)` (CartService)
3. Redirige vers `/cart`

---

### 6.5 `CartPage.jsx` — Panier et passage de commande

Gère l'affichage du panier et tout le processus de checkout.

**État local :**
- `cart` — articles (chargés depuis localStorage via `loadCart()`)
- `carriers` — transporteurs récupérés depuis `GET /carriers/?display=full`
- Champs d'adresse : `address1`, `postcode`, `city`, `countryId`, `addressAlias`

**Fonctions helpers (XML builders) :**

| Fonction | Rôle |
|---|---|
| `buildAddressXml({...})` | Construit le XML d'une adresse PrestaShop |
| `buildCartXml({...})` | Construit le XML d'un panier avec ses lignes |
| `buildOrderXml({...})` | Construit le XML d'une commande complète |
| `buildOrderHistoryXml(orderId, stateId)` | Construit le XML d'un historique d'état |

**`handleCheckout()`** — Processus de commande en 5 étapes séquentielles :
1. Crée l'adresse : `POST /addresses`
2. Crée le panier : `POST /carts`
3. Crée la commande : `POST /orders`
4. Crée l'historique d'état : `POST /order_histories`
5. Supprime les paiements auto-créés : `clearOrderPayments()` → `GET /order_payments/` → `DELETE` pour chaque

En cas de succès : vide le panier, affiche la référence de commande.

**`handleQuantityChange(lineId, value)`** : appelle `updateCartItem` (CartService) et met à jour l'état local.

**`handleRemove(lineId)`** : appelle `removeCartItem` et met à jour l'état.

**Totaux** calculés avec `useMemo` sur le tableau `cart` — recalculés automatiquement quand le panier change.

---

### 6.6 `OrdersPage.jsx` — Mes commandes

Affiché uniquement si un `customer` est connecté.

Appels API au montage :
1. `GET /order_states/?display=full` → construit une map `{ stateId → label }`
2. `GET /orders/?filter[id_customer]=[id]` → liste des commandes du client

Affiche chaque commande avec : référence, date, état (résolu depuis la map), total, moyen de paiement.

---

### 6.7 Services frontoffice

#### `CartService.js`

Classe gérant la persistance du panier dans le `localStorage`.

| Méthode | Rôle |
|---|---|
| `loadCart()` | Lit `fo_cart` depuis localStorage, normalise les `lineId` |
| `saveCart(cart)` | Sauvegarde et émet l'événement `fo-cart-updated` |
| `addToCart(item, qty)` | Ajoute ou incrémente une ligne (identifiée par `id + attributeId`) |
| `updateCartItem(lineId, qty)` | Met à jour la quantité d'une ligne |
| `removeCartItem(lineId)` | Supprime une ligne |
| `clearCart()` | Vide le panier |
| `getLineId(item)` | Génère `"id-attributeId"` comme clé unique de ligne |
| `notifyCartUpdated()` | Dispatche un `CustomEvent` pour notifier les autres composants |
| `createToken()` | Génère un token aléatoire (random base36 + timestamp base36) |
| `loadCustomer()` / `saveCustomer()` / `clearCustomer()` | Persistance du client dans `fo_customer` |
| `loadToken()` / `saveToken()` / `clearToken()` | Persistance du token dans `fo_customer_token` |

Le fichier `cartService.js` (minuscule) est une façade : il instancie `CartService` et réexporte toutes ses méthodes comme fonctions simples.

#### `CustomerDirectoryService.js`

Une seule méthode : `listCustomers()` → `GET /customers/?display=full`, parse le XML, retourne des instances de `FrontCustomer`.

#### `ProductFilterService.js`

Filtre pur (sans appel API). Méthodes :
- `matchesName(product, query)` — recherche insensible à la casse et aux accents
- `matchesCategory(product, category)` — correspondance exacte
- `matchesPriceRange(product, min, max)` — comparaison numérique sur `priceTtc`
- `filterProducts(products, { nameQuery, category, minPrice, maxPrice })` — combine les trois

#### `ProductBadgeService.js`

Calcule le badge affiché sur les cartes produits selon la `available_date` :
- 0 ou 1 jour depuis la date de dispo → badge **HOT** (rouge)
- 2 à 7 jours → badge **NEW** (vert)
- Plus de 7 jours → aucun badge

---

### 6.8 Modèle `FrontCustomer.js`

Classe représentant un client côté frontoffice.

| Propriété | Type | Description |
|---|---|---|
| `id` | string | ID PrestaShop |
| `email` | string | Email |
| `firstname` / `lastname` | string | Prénom / Nom |
| `secure_key` | string | Clé sécurisée PrestaShop (utilisée lors de la création de commande) |
| `anonymous` | boolean | Vrai pour un utilisateur anonyme |

**`FrontCustomer.anonymous()`** — méthode statique qui retourne un client anonyme pré-rempli.

**`getDisplayName()`** — retourne le nom complet ou l'email, ou `'Utilisateur anonyme'`.

---

### 6.9 Hook `useCartCount.js`

Hook React qui :
1. Au montage, lit le nombre d'articles avec `getCartCount(loadCart())`
2. S'abonne à l'événement `fo-cart-updated` (émis par `CartService.notifyCartUpdated()`)
3. Met à jour le compteur à chaque modification du panier
4. Se désabonne au démontage

Utilisé dans `FrontofficeApp` pour afficher le badge du panier dans la navigation.

---

## 7. Backoffice

### 7.1 `BackofficeApp.jsx` — Gardien de session

Gère l'authentification avant de donner accès au dashboard.

**Au montage** : charge la session depuis le localStorage (`loadSession()`). Si elle est expirée (`isSessionValid()` retourne `false`), la détruit immédiatement (`logout()`).

**`handleLogin(username, password)`** : appelle `login()`. Si succès, met à jour l'état `session` avec la session créée.

**`handleLogout()`** : appelle `logout()`, remet `session` à `null`.

**Rendu :**
- Pas de session valide → `<Login onLogin={handleLogin} />`
- Session valide → `<Dashboard onLogout={handleLogout} initialPage={requestedPage} />`

`requestedPage` est résolu depuis l'URL au montage (via `resolveBackofficePage`), donc naviguer directement vers `/bo/orders` ouvre directement la page commandes.

---

### 7.2 `AuthService.js`

Classe gérant toute la logique d'authentification.

| Méthode | Rôle |
|---|---|
| `login(username, password)` | Vérifie `admin/admin`, crée et sauvegarde une session |
| `createSession(username)` | Génère un faux JWT + timestamp d'expiration (8h) |
| `createFakeJwt(payload)` | Encode header + payload + signature fixe en Base64URL |
| `saveSession(session)` | `localStorage.setItem('backoffice_session', JSON.stringify(session))` |
| `loadSession()` | `localStorage.getItem` + `JSON.parse` |
| `clearSession()` | `localStorage.removeItem('backoffice_session')` |
| `isSessionValid(session)` | Vérifie que `session.exp > Date.now()/1000` |
| `logout()` | Appelle `clearSession()` |
| `getDefaultCredentials()` | Retourne `{ username: 'admin', password: 'admin' }` |

Le fichier `auth.js` (minuscule) est une façade : instancie `AuthService` et réexporte ses méthodes comme fonctions simples.

---

### 7.3 `Login.jsx` — Formulaire de connexion

Formulaire contrôlé React avec deux champs (username, password). Les champs sont pré-remplis avec les credentials par défaut (`getDefaultCredentials()`).

**`handleSubmit(event)`** :
1. Appelle `onLogin(username, password)` (prop injectée par `BackofficeApp`)
2. Si erreur → affiche le message d'erreur
3. Si succès → `BackofficeApp` met à jour `session`, ce qui provoque le rendu de `Dashboard`

---

### 7.4 `Dashboard.jsx` — Navigation principale du backoffice

Sidebar + contenu. Gère l'état `activePage` pour switcher entre les sous-pages **sans rechargement** (contrairement au frontoffice).

**Navigation (sidebar) :**
- Bouton "Reinitialiser donnees" → `activePage = 'reset'`
- Bouton "Commandes" → `activePage = 'orders'`
- Bouton "Statistiques" → `activePage = 'stats'`
- Bouton "Import CSV" → `activePage = 'csv'`
- Bouton "Gestion stock" → `activePage = 'stock'`

**`handleTestApi()`** : teste la connexion à l'API en faisant `GET /customers/`. Affiche "Connexion OK" ou "KO" avec le code HTTP.

Rendu conditionnel (if/else sur `activePage`) :
```
'reset'  → <ResetDataPage />
'orders' → <OrdersPage />
'stats'  → <DashboardStatsPage />
'csv'    → <CSVImportPage />
'stock'  → <StockPage />
```

---

### 7.5 `ResetDataPage.jsx` — Réinitialisation des données

Page permettant de supprimer des ressources PrestaShop en masse.

**Constantes importantes :**
- `PROTECTED_IDS` — IDs qu'on ne supprime jamais (ex: clients id=1, catégories id=1 et 2)
- `DELETE_PRIORITY` — ordre de suppression (enfants avant parents, pour éviter les erreurs de clé étrangère)
- `RESOURCE_DEPENDENCIES` — quand on sélectionne une ressource, ses dépendances sont ajoutées automatiquement (ex: supprimer `products` force aussi `specific_prices`, `stock_availables`, `combinations`, `order_details`)

**Fonctions internes :**

| Fonction | Rôle |
|---|---|
| `isProtectedNode(resource, node)` | Vérifie si un nœud est dans `PROTECTED_IDS` ou marqué `unremovable` |
| `parseResourceNodes(resource, xmlText)` | Parse le XML et retourne les nœuds enfants du container |
| `getNodeLabel(node)` | Génère un label lisible `#id - nom` |
| `previewResourceItems(resource)` | Liste les IDs supprimables vs protégés sans supprimer |
| `deleteResourceItems(resource)` | Supprime avec jusqu'à 4 passes (pour les ressources liées entre elles). Pour `stock_availables`, fallback: met la quantité à 0 si DELETE échoue |
| `buildItemList(categories)` | Aplatit les catégories en liste d'items |
| `sortItemsByDeletePriority(items)` | Trie selon `DELETE_PRIORITY` |
| `expandItemsWithDependencies(items)` | Ajoute récursivement les dépendances manquantes |

**Actions UI :**
- **Prévisualiser** (`handlePreview`) : appelle `previewResourceItems` pour chaque item sélectionné, affiche les labels avant suppression
- **Confirmer** (`handleConfirm`) : supprime réellement, affiche un journal horodaté en temps réel
- **Tout sélectionner / Tout désélectionner** : toggle sur toutes les ressources disponibles

**`resetStockAvailableQuantity(stockId)`** : Fallback spécial pour PrestaShop qui refuse souvent DELETE sur les stocks — fait un GET puis un PUT avec `quantity=0`.

---

### 7.6 `CSVImportPage.jsx` — Import CSV

Page la plus complexe de l'application. Gère l'import de 3 types de CSV et d'un ZIP d'images.

#### Formats CSV acceptés

**CSV Produits** (colonnes obligatoires) :
```
date_availability_produit, nom, reference, prix_ttc, Taxe, categorie, prix_achat
```

**CSV Déclinaisons** :
```
reference, specificite, karazany, stock_initial, prix_vente_ttc
```

**CSV Commandes** :
```
date, nom, email, pwd, adresse, achat, etat
```

Les en-têtes acceptent des **alias** (ex: `name` = `nom`, `price` = `prix_ttc`, etc.) définis dans les objets `PRODUCT_HEADER_ALIASES`, `VARIANT_HEADER_ALIASES`, `ORDER_HEADER_ALIASES`.

#### Fonctions de parsing CSV

| Fonction | Rôle |
|---|---|
| `parseCSVLine(line)` | Parse une ligne CSV en gérant les guillemets et les virgules dans les valeurs |
| `parseCsvText(text)` | Parse le CSV produits, valide les colonnes et les données ligne par ligne |
| `parseVariantsText(text)` | Parse le CSV déclinaisons |
| `parseOrdersText(text)` | Parse le CSV commandes |
| `canonicalizeHeader(header, aliases)` | Normalise un en-tête (minuscules + déaccentuation) et le mappe vers son alias canonique |

#### Fonctions de normalisation

| Fonction | Rôle |
|---|---|
| `normalizeNumber(value)` | Parse un nombre (gère virgule et %) |
| `normalizeTaxRate(taxRate)` | Parse un taux de TVA |
| `normalizeDate(value)` | Convertit `DD/MM/YYYY` → `YYYY-MM-DD` |
| `normalizeInt(value, fallback)` | Parse un entier avec valeur par défaut |
| `slugify(value)` | Convertit un nom en slug URL (minuscules, tirets) |
| `escapeXml(str)` | Échappe les caractères spéciaux XML (`&`, `<`, `>`, etc.) |
| `splitCustomerName(fullName)` | Sépare prénom et nom (premier mot = prénom, reste = nom) |
| `normalizeOrderStateId(value)` | Mappe un label d'état ("annulé", "accepté"...) vers l'ID PrestaShop correspondant |

#### Gestion de la TVA — `ensureTaxGroupId(csvTaxRate)`

Fonction clé. Pour un taux de TVA CSV (ex: `20%`) :
1. Cherche dans le cache (`taxRateCacheRef`) si déjà résolu
2. Cherche dans `GET /taxes/?display=full` une taxe avec ce taux exact
3. Si trouvée, remonte vers son groupe via `GET /tax_rules/`
4. Sinon, crée : taxe → groupe → règle (liée à Madagascar via `getMadagascarCountryId()`)
5. Met le résultat en cache

**`taxRateCacheRef`** est un `useRef` (persiste entre les renders sans causer de re-render).

**`convertPriceToHTMapped(priceTTC, csvTaxRate)`** : calcule le prix HT à partir du TTC en utilisant le taux PS réel (après mapping).

#### Import Catalogue — `importCatalogCsv()`

Boucle sur les produits CSV :
1. Résout la catégorie (`ensureCategoryId` — cherche ou crée)
2. Résout/crée le groupe TVA (`ensureTaxGroupId`)
3. Si produit existant (par référence) → met à jour prix et TVA via PUT
4. Sinon → crée le produit via POST
5. Upload l'image si présente dans le ZIP

Boucle sur les déclinaisons CSV :
1. Trouve le produit parent dans le cache ou via API
2. Résout/crée le groupe d'attributs (`ensureAttributeGroupId`)
3. Résout/crée la valeur d'attribut (`ensureAttributeValueId`)
4. Passe le produit en type `combinations` si ce n'est pas fait
5. Crée la combinaison avec son impact de prix
6. Met à jour le stock

En fin de boucle : `refreshProductCombinationsCache()` pour que PrestaShop affiche correctement les déclinaisons.

#### Import Commandes — `importOrdersCsv()`

Pour chaque ligne :
1. Cherche ou crée le client par email (`findCustomerByEmail` / `createCustomerFromRow`)
2. Parse les achats : format `[["REF", qte, "variante"], ...]` via `parsePurchaseItems()`
3. Résout chaque produit + déclinaison → calcule prix HT/TTC
4. Crée l'adresse de livraison
5. Crée le panier
6. Si l'état = "panier" → s'arrête là (pas de commande créée)
7. Sinon → crée la commande + historique d'état
8. Sauvegarde la date CSV dans localStorage (`bo_csv_order_date_map_v1`)

#### Gestion des images ZIP — `handleImagesZipChange()`

Lit le ZIP via JSZip, mappe chaque fichier image par sa **référence produit** (nom du fichier sans extension, normalisé en majuscules). Ignore les fichiers macOS (`__MACOSX/`, `.DS_Store`).

`handleImportImagesOnly()` : pour chaque référence dans le ZIP, cherche le produit et upload l'image via `POST /images/products/{id}` avec un `FormData`.

---

### 7.7 `StockPage.jsx` — Gestion du stock

Permet de rechercher un produit par référence et d'ajouter du stock.

**Fonctions API (module-level, pas dans le composant) :**

| Fonction | Rôle |
|---|---|
| `findProductByReference(ref)` | `GET /products/?filter[reference]=[ref]` → retourne `{ id, reference, name }` |
| `getOrCreateStockAvailable(productId, combinationId)` | Cherche le stock dispo ou le crée (POST) si absent |
| `updateStockQuantity(stockId, nextQty)` | GET le stock → modifie le nœud `quantity` → PUT |

**Journal local (`bo_stock_journal_v1`)** : chaque ajout de stock est enregistré dans le localStorage avec timestamp, référence, quantité avant/après, statut. Limité à 1000 entrées.

**`dailyRows`** (calculé avec `useMemo`) : regroupe les entrées du journal par jour pour la référence courante — affiche les opérations, le total ajouté, et le stock début/fin de journée.

**`handleSearch()`** : charge le produit + son stock depuis l'API.

**`handleAddStock()`** : calcule `before + qtyToAdd = after`, appelle `updateStockQuantity()`, enregistre dans le journal.

---

### 7.8 `OrderService.js` — Service commandes backoffice

Utilisé par `DashboardStatsPage` et `OrdersPage` backoffice.

| Méthode | Rôle |
|---|---|
| `fetchOrders()` | GET liste des IDs → GET détail de chaque → parse XML → retourne des `Order[]` |
| `parseOrderList(xmlText)` | Extrait les IDs depuis le XML de liste |
| `parseOrderDetail(xmlText, csvMap)` | Crée un objet `Order` depuis le XML d'une commande. Injecte la date CSV si disponible dans `csvMap` |
| `updateOrderState(orderId, nextStateId)` | GET le XML de la commande → modifie `current_state` → PUT |
| `groupByDay(orders)` | Regroupe les commandes par jour, calcule count + montant total par jour |
| `loadCsvOrderDateMap()` | Lit la map `bo_csv_order_date_map_v1` du localStorage |

---

### 7.9 Modèle `Order.js`

Représente une commande backoffice.

| Méthode | Rôle |
|---|---|
| `getDisplayDate()` | Retourne `csvDate` si disponible, sinon `date` (date API) |
| `getAmountNumber()` | Parse `total` en float |
| `getDay()` | Extrait `YYYY-MM-DD` depuis la date d'affichage (supporte DD/MM/YYYY et ISO) |

---

### 7.10 Constantes `orderStates.js`

```js
ORDER_STATES = {
  PAID: 2,       // Paiement accepté
  CANCELLED: 6,  // Annulé
  ERROR: 8,      // Erreur paiement
  CART_ONLY: 14, // Panier seulement
  DEFAULT_CREATE: 13, // État à la création
}
```

`ORDER_STATUS_OPTIONS` : options affichables dans les sélecteurs d'état (limité à "Paiement accepté" et "Annulé").

---

## 8. Couche HTTP — `ApiClient` et `apiService`

### `ApiClient.js`

Classe générique pour les appels HTTP vers l'API PrestaShop.

**Constructeur** : accepte `{ baseUrl, token, authScheme }`.

| Méthode | Rôle |
|---|---|
| `normalizeBaseUrl(baseUrl)` | Supprime le `/` final de l'URL de base |
| `resolveUrl(path)` | Si `path` commence par `http`, l'utilise tel quel. Sinon, concatène avec `baseUrl` |
| `resolveAuthHeader(token)` | Détecte le schéma : `basic` → `Basic base64(token:)`, `bearer` → `Bearer token`, ou auto-détection (`.` dans token → Bearer, sinon Basic) |
| `withAuthHeaders(headers)` | Ajoute l'en-tête `Authorization` si `token` est défini |
| `request(path, options)` | Appel HTTP → parse JSON → retourne `{ ok, status, data }` |
| `requestRaw(path, options)` | Appel HTTP → retourne le texte brut → `{ ok, status, text }` |

`requestRaw` est utilisé pour le XML PrestaShop (l'API répond en XML, pas JSON).

### `apiService.js`

Façade qui lit la configuration depuis les variables d'environnement Vite :

| Variable | Description | Défaut |
|---|---|---|
| `VITE_API_BASE_URL` | URL de base de l'API PrestaShop | `/api` |
| `VITE_API_TOKEN` | Clé d'authentification PrestaShop | `''` |
| `VITE_API_AUTH_SCHEME` | Schéma d'auth (`basic` ou `bearer`) | `''` |

| Fonction exportée | Rôle |
|---|---|
| `getApiConfig()` | Lit les env vars et retourne la config |
| `createApiClient()` | Instancie un `ApiClient` avec la config |
| `apiRequest(path, options)` | Raccourci vers `client.request()` (JSON) |
| `apiRequestRaw(path, options)` | Raccourci vers `client.requestRaw()` (XML) |
| `testApiConnection(path)` | Teste la connexion en faisant GET sur le chemin donné. Retourne `{ ok: false }` si token manquant |

---

## 9. Utilitaires XML partagés

### `xmlUtils.js`

| Fonction | Rôle |
|---|---|
| `parseXml(text)` | `new DOMParser().parseFromString(text, 'application/xml')` |
| `serializeXml(doc)` | `new XMLSerializer().serializeToString(doc)` |
| `getXmlText(node, selector)` | Équivalent de `node.querySelector(selector)?.textContent?.trim() \|\| ''` |
| `getFirstIdFromXml(doc, tagName)` | Cherche `tagName` dans le doc, retourne l'attribut `id` ou le texte du nœud `<id>` |
| `extractApiErrorMessage(text)` | Parse le XML d'erreur PrestaShop, extrait `<error><message>...</message></error>` |

---

## 10. Résumé des flux principaux

### Flux : Connexion frontoffice

```
/shop → FrontofficeApp monte → loadCustomer() depuis localStorage
  → null → affiche CustomerSelectPage
  → clic client → handleSelectCustomer(client)
                → saveCustomer(client)
                → saveToken(createToken())
                → setCustomer(client)
                → affiche ProductList
```

### Flux : Achat

```
ProductList → clic produit → window.location.href = '/product/42'
ProductPage → charge détails API (produit + stock + TVA + déclinaisons)
  → user choisit variante + quantité
  → handleAddToCart()
    → addToCart(item, qty) [CartService, localStorage]
    → window.location.href = '/cart'
CartPage → affiche articles, transporteurs
  → user remplit adresse → handleCheckout()
    → POST /addresses → addressId
    → POST /carts → cartId
    → POST /orders → orderId
    → POST /order_histories → état appliqué
    → DELETE /order_payments/* → nettoyage
    → clearCart() → panier vidé
```

### Flux : Connexion backoffice

```
/bo → BackofficeApp monte
  → loadSession() depuis localStorage
  → session invalide → affiche Login
  → handleLogin('admin', 'admin')
    → AuthService.login() → crée faux JWT, sauvegarde session
    → setSession(session) → affiche Dashboard
  → session valide au reload → affiche directement Dashboard
```

### Flux : Import CSV Produits

```
handleFileChange → FileReader → parseCsvText()
  → validation colonnes + données
  → setProducts(data)

handleImport → importCatalogCsv()
  → pour chaque produit:
    ensureCategoryId() → GET /categories/?filter[name]  (ou POST si nouvelle)
    ensureTaxGroupId() → GET /taxes/ → GET /tax_rules/  (ou crée taxe+groupe+règle)
    findProductByReference() → GET /products/?filter[reference]
    → existe: PUT /products/{id} (mise à jour prix + TVA)
    → nouveau: POST /products/
    → uploadProductImage() → POST /images/products/{id}
  → pour chaque déclinaison:
    ensureAttributeGroupId() → GET/POST /product_options/
    ensureAttributeValueId() → GET/POST /product_option_values/
    ensureProductTypeCombinations() → GET+PUT /products/{id}
    POST /combinations/
    setStockQuantity() → GET+PUT /stock_availables/{id}
  → refreshProductCombinationsCache() → GET+PUT pour chaque produit avec déclinaisons
```

### Flux : Réinitialisation des données

```
User sélectionne ressources → handlePreview()
  → expandItemsWithDependencies() → ajoute les dépendances
  → sortItemsByDeletePriority() → ordre correct
  → pour chaque item: previewResourceItems() → GET /{resource}/

handleConfirm()
  → même expansion + tri
  → pour chaque item: deleteResourceItems()
    → GET /{resource}/ → liste des IDs
    → jusqu'à 4 passes: DELETE /{resource}/{id} (ou PUT quantity=0 pour stocks)
```
