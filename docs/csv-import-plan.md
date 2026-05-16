# Plan import CSV (Backoffice)

## Objectif
Importer des produits (et leurs variantes) depuis CSV avec validations, conversion de prix et creation API PrestaShop.

## Fichier principal
- `eval/src/backoffice/pages/CSVImportPage.jsx`

## Plan fonctionnel
1. Charger et parser le CSV produit.
2. Valider les colonnes obligatoires.
3. Normaliser nombres, dates, taxes.
4. Convertir TTC -> HT.
5. Resoudre/creer le groupe de taxe (`id_tax_rules_group`).
6. Creer le produit en XML (`POST /products`).
7. Creer variantes si fichier variantes fourni.
8. Creer/mettre a jour les stocks.
9. Afficher un resume de resultats.

## Fonctions importantes a connaitre
- `normalizeHeader()`, `normalizeNumber()`, `normalizeTaxRate()`
- `parseXml()`, `serializeXml()`, `extractApiErrorMessage()`
- `apiGetXml()`, `apiPostXml()`, `apiPutXml()`
- `ensureTaxGroupId(csvTaxRate)`
- `stripReadOnlyFields(productNode)`

## Hooks utilises
- `useState` pour l etat du formulaire/import.
- `useRef` pour le cache de taxes (`taxRateCacheRef`) et le pays MG (`mgCountryIdRef`).

## Points de vigilance
- Toujours echapper XML via `escapeXml()`.
- Les IDs d etat/categories dependent de ton instance.
- Le fichier CSV doit etre propre (separateur, en-tetes, encodage).
