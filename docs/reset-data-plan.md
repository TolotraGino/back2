# Plan Reset Data

## Objectif
Supprimer des ressources PrestaShop par categories depuis le backoffice.

## Fichiers
- `eval/src/backoffice/pages/ResetDataPage.jsx`
- `eval/src/backoffice/functions/resetDataCatalog.js`
- `eval/src/services/apiService.js`

## Fonctionnement
1. L utilisateur coche des ressources (`products`, `orders`, etc.).
2. L app charge la liste des IDs via API XML.
3. Les IDs proteges sont filtres.
4. Suppression element par element.
5. Un resume par ressource est affiche.

## Fonctions cles
- `parseResourceIds(resource, xmlText)`
- `deleteResourceItems(resource)`
- `toggleAll()`
- `toggleCategory(category)`
- `toggleItem(item)`
- `handleConfirm()`

## Protection
- IDs proteges actuellement:
- `customers`: `[1]`
- `products`: `[1, 2]`

## Bonnes pratiques
- Lancer sur un environnement de test d abord.
- Ne pas inclure de ressources critiques si doute.
- Sauvegarder la base avant reset massif.
