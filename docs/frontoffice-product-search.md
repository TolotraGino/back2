# Frontoffice - Recherche Multicritere Produits

## Objectif
Permettre une recherche multicritere sur la liste des produits:
- nom
- categorie
- intervalle de prix (min/max)

## Fichiers implementes
- `eval/src/frontoffice/services/ProductFilterService.js`
- `eval/src/frontoffice/pages/ProductList.jsx`
- `eval/src/frontoffice/front.css`

## Explication du code de realisation

### 1) Service OO de filtrage
Fichier: `ProductFilterService.js`

Methodes principales:
- `matchesName(product, query)`:
  - filtre par nom (contains, insensible a la casse)
- `matchesCategory(product, category)`:
  - filtre par categorie exacte (normalisee en minuscule)
- `matchesPriceRange(product, minPrice, maxPrice)`:
  - filtre par prix TTC dans l intervalle saisi
- `filterProducts(products, criteria)`:
  - combine les 3 criteres en une seule passe

### 2) Integration page produit
Fichier: `ProductList.jsx`

Ajouts:
- etats React:
  - `nameQuery`
  - `selectedCategory`
  - `minPrice`
  - `maxPrice`
- `categories` calculees via `useMemo` depuis les produits charges
- `filteredProducts` calculees via `ProductFilterService`

Affichage:
- barre de filtres (input nom, select categorie, min/max prix)
- grille basee sur `filteredProducts`
- message si aucun resultat

### 3) Styles
Fichier: `front.css`

Nouvelles classes:
- `.fo-product-filters`
- `.fo-filter-input`
- `.fo-empty-search`

## Utilisation
1. Ouvrir `/shop`.
2. Renseigner un ou plusieurs criteres:
   - nom
   - categorie
   - prix min / max
3. La liste se met a jour automatiquement.
