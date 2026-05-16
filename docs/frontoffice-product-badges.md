# Frontoffice - Marque Produit (HOT / NEW)

## Objectif
Afficher une marque sur les produits selon `date_availability_produit` (champ PrestaShop `available_date`).

Regles:
- `HOT`: produit sorti depuis 1 jour maximum.
- `NEW`: produit sorti depuis plus de 1 jour et jusqu a 7 jours.

## Fichiers implementes
- `eval/src/frontoffice/services/ProductBadgeService.js`
- `eval/src/frontoffice/pages/ProductList.jsx`
- `eval/src/frontoffice/front.css`

## Explication du code de realisation

### 1) Service OO de badge
Fichier: `ProductBadgeService.js`

Methodes:
- `parseDateOnly(value)`:
  - convertit `available_date` en date exploitable (format jour).
- `getDayDiffFromToday(availableDate)`:
  - calcule l ecart en jours entre aujourd hui et la date de sortie.
- `resolveBadge(availableDate)`:
  - retourne:
    - `{ code: 'HOT', className: 'fo-flag-hot' }` si `0 <= jours <= 1`
    - `{ code: 'NEW', className: 'fo-flag-new' }` si `1 < jours <= 7`
    - `null` sinon

### 2) Integration dans la liste produits
Fichier: `ProductList.jsx`

- lecture de `available_date` depuis le XML produit
- appel de `productBadgeService.resolveBadge(availableDate)`
- rendu conditionnel du badge sur la carte produit

### 3) Styles
Fichier: `front.css`

- `.fo-flag-hot`: style badge HOT
- `.fo-flag-new`: style badge NEW

## Utilisation
1. Importer/creer des produits avec `date_availability_produit`.
2. Ouvrir `/shop`.
3. Verifier:
   - produit date <= 1 jour: badge `HOT`
   - produit date <= 7 jours (et > 1): badge `NEW`
   - au-dela: pas de badge
