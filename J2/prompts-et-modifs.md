# J2 - Prompts et Modifications

## Entree 001 - 2026-05-13
### Prompt
"voici ce que j attend n oublie pas les docs avec signifiaction du code et de son utilisation ,Backoffice
Voici les état des commandes existants que nous allons utiliser (data import modifié)
dans le panier (pas encore dans la commande mais panier)
paiement effecuté
annulé"

### Signification des etats
- `dans_panier`: etat metier du panier (pas un etat de commande).
- `paiement_effectue` (`id: 2`): la commande existe et le paiement est valide.
- `annule` (`id: 6`): la commande est annulee.

### Utilisation metier
- Quand la ligne CSV indique `dans le panier`:
  - on cree le client (si besoin), l adresse, puis le panier.
  - on ne cree pas la commande.
- Quand la ligne CSV indique `paiement effectue`:
  - on cree la commande, puis on applique l etat paiement accepte.
- Quand la ligne CSV indique `annule`:
  - on cree la commande, puis on applique l etat annule.

### Exemples concrets
Exemple 1 - panier uniquement:
```csv
date,nom,email,pwd,adresse,achat,etat
13/05/2026,Rabe,exemple1@mail.com,Test#1234,Analakely,"[(\"T_01\";\"2\";\"kely\")]",dans le panier
```
Resultat attendu:
- panier cree
- aucune commande creee

Exemple 2 - commande payee:
```csv
date,nom,email,pwd,adresse,achat,etat
13/05/2026,Rasoa,exemple2@mail.com,Test#1234,Ankorondrano,"[(\"C_03\";\"1\";\"\")]",paiement effectue
```
Resultat attendu:
- panier cree
- commande creee
- etat final = `paiement_effectue (2)`

Exemple 3 - commande annulee:
```csv
date,nom,email,pwd,adresse,achat,etat
13/05/2026,Rakoto,exemple3@mail.com,Test#1234,67ha,"[(\"T_01\";\"1\";\"ngoza\")]",annule
```
Resultat attendu:
- panier cree
- commande creee
- etat final = `annule (6)`

### Avant de l utiliser en React
- Comprendre d abord le flux metier:
  - `panier` != `commande`
  - `dans_panier` reste au niveau panier
  - `paiement_effectue` et `annule` concernent des commandes existantes
- Verifier les IDs d etat de ton instance PrestaShop (`2`, `6`, `14`) avant de coder.
- Tester le flux avec 3 CSV minimaux (un par etat) avant branchement UI.
- Ensuite seulement, brancher React:
  - select des etats dans le Backoffice (`/bo/orders`)
  - import CSV commandes (`/bo/import`) avec affichage du compteur `Paniers uniquement`.

### Modifications appliquees
- Mise a jour des statuts Backoffice commandes:
  - `paiement_effectue` -> `2`
  - `annule` -> `6`
- Import CSV commandes adapte:
  - Si `etat` = `dans le panier` / `panier` / `cart`:
    - creation `customer + address + cart`
    - pas de creation `order`
  - Ajout du compteur `Paniers uniquement` dans le rapport final.
- Documentation mise a jour:
  - `docs/commande.md`
  - `docs/csv-orders-import.md`

### Fichiers modifies
- `eval/src/backoffice/pages/OrdersPage.jsx`
- `eval/src/backoffice/pages/CSVImportPage.jsx`
- `docs/commande.md`
- `docs/csv-orders-import.md`

---

## Modele pour les prochaines entrees
### Prompt
"..."

### Signification
- ...

### Utilisation
- ...

### Exemples
- ...

### Modifications appliquees
- ...

### Fichiers modifies
- ...

## Historique des changements

### 2026-05-13
- Ajout et documentation du flux `dans le panier` cote import CSV (panier uniquement, sans creation commande).
- Alignement Backoffice commandes: suppression de `dans le panier` des statuts de commande.
- Clarification docs:
  - `docs/csv-orders-import.md`: mapping `etat` + comportement `dans le panier`.
  - `docs/commande.md`: statuts commandes valides et distinction panier/commande.
- Ajout des explications (signification, utilisation, exemples) dans `J2/prompts-et-modifs.md`.

## Explication du code (Entree 001)

### 1) Backoffice commandes (`eval/src/backoffice/pages/OrdersPage.jsx`)
But:
- afficher les commandes
- permettre de changer uniquement les etats de commande valides

Fonctions principales:
- `parseOrderList(xmlText)`:
  - lit la reponse XML de `/orders/`
  - extrait les IDs de commandes
- `parseOrderDetail(xmlText)`:
  - lit le detail d une commande
  - retourne un objet UI (`id`, `reference`, `payment`, `currentStateId`, etc.)
- `resolveStatusKey(currentStateId)`:
  - convertit l ID PrestaShop vers la cle du select React
  - fallback sur `paiement_effectue` si non trouve
- `updateOrderState(orderId, nextStateId)`:
  - fait `GET /orders/{id}`
  - remplace `current_state`
  - fait `PUT /orders/{id}` pour sauvegarder

Modif effectuee:
- retrait de `dans_panier` de `STATUS_OPTIONS`.
- raison: `dans_panier` n est pas un etat de commande.

### 2) Import CSV commandes (`eval/src/backoffice/pages/CSVImportPage.jsx`)
But:
- importer des lignes CSV et creer les objets PrestaShop necessaires.

Fonctions principales:
- `parseOrdersText(text)`:
  - valide les colonnes obligatoires
  - transforme le CSV en objets exploitables
- `normalizeOrderStateId(value)`:
  - mappe le texte `etat` vers un ID metier
  - reconnait `dans le panier` / `panier` / `cart`
- `parsePurchaseItems(rawValue)`:
  - decode la colonne `achat`
  - retourne references + quantites + variantes
- `buildCartXml(...)`:
  - construit le XML pour creer le panier
- `buildOrderXml(...)`:
  - construit le XML pour creer la commande
- `createOrderHistory(orderId, orderStateId)`:
  - applique l etat final via historique de commande

Modif effectuee:
- ajout de la logique `dans le panier`:
  - si etat vide ou panier => creation `customer/address/cart` seulement
  - pas de creation de `order`
- ajout du compteur `cartsOnly` dans le rapport d import.

### 3) Documentation mise a jour
- `docs/commande.md`:
  - precise que `dans_panier` n est pas un etat commande
  - conserve uniquement `paiement_effectue` et `annule` pour `/bo/orders`
- `docs/csv-orders-import.md`:
  - decrit le mapping `etat`
  - explique le comportement specifique panier uniquement

### Resume des modifications finales
- Separation claire entre panier et commande.
- Import plus robuste: etat vide ou `dans le panier` n engendre pas de fausse commande.
- Backoffice commandes aligne metier: uniquement les vrais etats de commande.

## Entree 002 - 2026-05-13
### Prompt
"Tableau de bord
Par jour
nb de commande
montant
Total général"

### Document detaille
- Voir: `J2/entree-002-dashboard-par-jour.md`

### Resume
- Besoin: stats journalieres commandes (nb + montant) et total general.
- Regle cle: `dans le panier` n est pas une commande, donc non compte dans ces stats.

## Entree 003 - 2026-05-14
### Prompt
"transforme tout mon projet on orientation objet et met a jours tous les docs"

### Modifications appliquees (OO)
- Ajout du client HTTP OO:
  - `eval/src/core/http/ApiClient.js`
- Refactor service API partage en facade OO compatible:
  - `eval/src/services/apiService.js`
- Ajout service auth OO + facade legacy:
  - `eval/src/backoffice/services/AuthService.js`
  - `eval/src/backoffice/services/auth.js`
- Ajout modele/service commandes OO:
  - `eval/src/backoffice/models/Order.js`
  - `eval/src/backoffice/services/OrderService.js`
- Refactor pages backoffice vers couche OO:
  - `eval/src/backoffice/pages/OrdersPage.jsx`
  - `eval/src/backoffice/pages/DashboardStatsPage.jsx`
- Ajout service panier OO + facade legacy:
  - `eval/src/frontoffice/services/CartService.js`
  - `eval/src/frontoffice/services/cartService.js`

### Documentation mise a jour
- `docs/architecture-oo.md` (nouveau)
- `eval/README.md`
- `docs/frontoffice.md`
- `docs/backoffice-todo.md`
- `docs/commande.md`
- `docs/csv-orders-import.md`

### Utilisation
- Le projet reste en composants React fonctionnels cote UI.
- La logique metier/API est maintenant centralisee dans des classes OO.
- Les anciennes fonctions exportees sont conservees via facades pour compatibilite.

## Entree 004 - 2026-05-15
### Prompt
"dans mon csvimport modifie l affichage pour qu un seul bouton import pour les 3 csv et il ne sont pas dependant et un bouton different pour l import image"

### Modifications appliquees
- Un seul bouton `Importer tous les CSV` pour:
  - produits
  - declinaisons
  - commandes
- Les flux ne sont pas dependants:
  - si un CSV n est pas charge, l autre peut quand meme etre importe.
- Bouton images conserve a part:
  - `Importer les images ZIP`

### Fichiers modifies
- `eval/src/backoffice/pages/CSVImportPage.jsx`

## Entree 005 - 2026-05-15
### Prompt
"Frontoffice ... page d accueil par defaut = liste utilisateurs existants ... option utilisateur anonyme"

### Modifications appliquees
- Ajout page de selection utilisateur frontoffice.
- Choix d un client existant.
- Ajout option `utilisateur anonyme`.
- Implementation orientee objet:
  - modele `FrontCustomer`
  - service `CustomerDirectoryService`

### Fichiers modifies
- `eval/src/frontoffice/models/FrontCustomer.js`
- `eval/src/frontoffice/services/CustomerDirectoryService.js`
- `eval/src/frontoffice/pages/CustomerSelectPage.jsx`
- `eval/src/frontoffice/FrontofficeApp.jsx`
- `eval/src/frontoffice/front.css`
- `docs/frontoffice-user-selector.md`

## Entree 006 - 2026-05-15
### Prompt
"mettre une marque sur les produits ... HOT 1j ... NEW 1 semaine"

### Modifications appliquees
- Ajout regle badge produit basee sur `available_date`:
  - `HOT` si <= 1 jour
  - `NEW` si <= 7 jours (et > 1 jour)
- Implementation orientee objet:
  - service `ProductBadgeService`
- Rendu badge dynamique dans la carte produit.

### Fichiers modifies
- `eval/src/frontoffice/services/ProductBadgeService.js`
- `eval/src/frontoffice/pages/ProductList.jsx`
- `eval/src/frontoffice/front.css`
- `docs/frontoffice-product-badges.md`

## Entree 007 - 2026-05-15
### Prompt
"implémenter une recherche multicritère par produit (nom, catégorie, intervalle de prix)"

### Modifications appliquees
- Ajout recherche multicritere sur `/shop`:
  - nom
  - categorie
  - prix min/max
- Implementation orientee objet:
  - service `ProductFilterService`
- UI filtres + liste filtree.

### Fichiers modifies
- `eval/src/frontoffice/services/ProductFilterService.js`
- `eval/src/frontoffice/pages/ProductList.jsx`
- `eval/src/frontoffice/front.css`
- `docs/frontoffice-product-search.md`
