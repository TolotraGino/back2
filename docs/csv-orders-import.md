# Import CSV Commandes (via Webservice PrestaShop)

## Objectif
Importer des commandes depuis un CSV contenant les colonnes:
- `date`
- `nom`
- `email`
- `pwd`
- `adresse`
- `achat`
- `etat`

Le flux cree les ressources PrestaShop via API:
1. `customers` (si le client n existe pas)
2. `addresses`
3. `carts`
4. `orders`
5. `order_histories`

## Fichier implemente
- `eval/src/backoffice/pages/CSVImportPage.jsx`

## Note architecture OO
- Le projet est maintenant oriente objet sur ses couches principales (`ApiClient`, `OrderService`, `CartService`, `AuthService`).
- Cette page conserve encore une logique metier volumineuse locale; une extraction future vers `CsvOrderImportService` est recommandee.

## Nouveau champ d import ajoute
Dans la page d import CSV, un nouveau bloc est disponible:
- **"3) Charger le CSV commandes"**
- Input fichier CSV
- Apercu des 10 premieres lignes
- Bouton **"Importer commandes CSV"**
- Rapport final succes/erreurs

## Format attendu du CSV
Exemple:
```csv
date,nom,email,pwd,adresse,achat,etat
09/05/2026,Rakoto,rakoto@yopmail.com,XvzsX5O0!GBD0uXQ,Andoharanofotsy,"[(\"T_01\";\"3\";\"ngoza\")]",paiement accepté
16/04/2026,Rajao,rajao1970@yopmail.com,BAC?UoxjQIV;Na8ix,Analakely,"[(\"T_01\";\"2\";\"kely\"),(\"C_03\";\"1\";\"\")]",paiement accepté
```

## Colonne `achat`
`achat` doit contenir une liste d articles sous forme de tuples:
- reference produit
- quantite
- variante (optionnelle)

Exemples valides:
- `[("T_01";"3";"ngoza")]`
- `[("T_01";"2";"kely"),("C_03";"1";"")]`

Le parseur convertit automatiquement `;` vers `,` pour interpreter les tuples.

## Detail du flux technique

### 1) Parsing CSV commandes
Fonctions principales:
- `parseOrdersText(text)`
- `parsePurchaseItems(rawValue)`

Validation minimale:
- colonnes obligatoires presentes
- `nom`, `email`, `achat` non vides

### 2) Client
Fonctions:
- `findCustomerByEmail(email)`
- `createCustomerFromRow(row)`

Comportement:
- si email existe: reutilise le client
- sinon: cree un client (`firstname`, `lastname`, `email`, `passwd`, groupe 3)

### 3) Adresse
Fonction:
- `createAddressForCustomer(customer, row)`

Champs envoyes:
- `id_customer`
- `id_country`
- `alias`
- `lastname`
- `firstname`
- `address1`
- `postcode`
- `city`

### 4) Lignes panier
Fonctions:
- `findProductByReference(reference)`
- `resolveCombinationByVariant(productId, variantLabel)`

Pour chaque ligne `achat`:
- resolution produit par reference
- resolution declinaison (si variante fournie)
- recuperation prix HT + taux taxe
- calcul TTC

### 5) Creation cart
Fonction:
- `buildCartXml(...)`

API:
- `POST /api/carts`

### 6) Creation order
Fonctions:
- `normalizeOrderStateId(value)`
- `buildOrderXml(...)`

API:
- `POST /api/orders`

Etat mappe depuis `etat`:
- `dans le panier` / `panier` / `cart` -> `14`
- `paiement accepte` -> `2`
- `annule` -> `6`
- `echec/erreur` -> `8`
- sinon -> `14`

Comportement specifique `dans le panier`:
- le flux cree `customer`, `address`, `cart`
- il ne cree pas de `order`
- le rapport final incremente `Paniers uniquement`

### 7) Historique etat
Fonction:
- `createOrderHistory(orderId, orderStateId)`

API:
- `POST /api/order_histories`

## Fonctions ajoutees (resume)
- `handleOrdersFileChange`
- `handleOrderImport`
- `parseOrdersText`
- `parsePurchaseItems`
- `normalizeOrderStateId`
- `splitCustomerName`
- `normalizeCustomerPassword`
- `findCustomerByEmail`
- `createCustomerFromRow`
- `createAddressForCustomer`
- `resolveCarrierId`
- `resolveCombinationByVariant`
- `buildCartXml`
- `buildOrderXml`
- `createOrderHistory`

## Gestion erreurs
Les erreurs sont affichees ligne par ligne:
- client introuvable/non cree
- produit reference introuvable
- format `achat` invalide
- erreur HTTP PrestaShop (400/401/403/500)

## Prerequis API (droits webservice)
La cle API doit avoir au minimum:
- `GET/POST` sur `customers`
- `POST` sur `addresses`
- `GET/POST` sur `carts`
- `GET/POST` sur `orders`
- `POST` sur `order_histories`
- `GET` sur `products`, `combinations`, `product_option_values`, `tax_rule_groups`, `tax_rules`, `taxes`, `carriers`

## Points d attention
- `pwd` doit respecter la validation PrestaShop (`isPasswd`).
- les references produits du CSV doivent exister.
- les variantes texte doivent correspondre aux valeurs d attribut existantes (sinon fallback combinaison `0`).
- les IDs d etats peuvent varier selon ton instance; adapte le mapping si besoin.

## References officielles PrestaShop utilisees
- Webservice resources index: https://devdocs.prestashop-project.org/8/webservice/resources/
- Customers resource: https://devdocs.prestashop-project.org/8/webservice/resources/customers/
- Carts resource: https://devdocs.prestashop-project.org/8/webservice/resources/carts/
- Orders resource: https://devdocs.prestashop-project.org/8/webservice/resources/orders/
- Order histories resource: https://devdocs.prestashop-project.org/8/webservice/resources/order_histories/
- Carriers resource: https://devdocs.prestashop-project.org/8/webservice/resources/carriers/
