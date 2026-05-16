# Backoffice TODO

## Pages done
- Login page (admin/admin hardcoded)
- Dashboard page (sidebar nav + API test button)
- Reset data page (DELETE resources by category)
- Orders page (GET list + PUT state updates)
- CSV import page (products TTC -> HT + taxes + variantes)

## Architecture actuelle
- Routes centralisees: `eval/src/routes.js`
- Pages: `eval/src/backoffice/pages/`
- Services backoffice: `eval/src/backoffice/services/`
- Modeles backoffice: `eval/src/backoffice/models/`
- Fonctions utilitaires backoffice: `eval/src/backoffice/functions/`
- Service API partage: `eval/src/services/apiService.js` (facade OO)
- Client HTTP OO: `eval/src/core/http/ApiClient.js`

## Features completed
- Login local + session localStorage TTL 8h
- Token de session type fake JWT
- Validation de session par `exp`
- Logout et purge session
- Guard de routes backoffice (URL directes protegees)
- Service API centralise (`apiRequest`, `apiRequestRaw`, `testApiConnection`)
- Reset data multi-ressources avec IDs proteges
- Orders list + update d etat (GET XML + PUT XML)
- CSV import avec conversion TTC->HT

## Hooks utilises
- Hooks React: `useState`, `useEffect`, `useMemo`, `useRef` selon les pages.
- Hook custom backoffice: aucun pour l instant.

## Key Functions

### Authentication (`eval/src/backoffice/services/auth.js`)
- classe `AuthService` dans `eval/src/backoffice/services/AuthService.js`
- facade legacy dans `auth.js`

### API Service (`eval/src/services/apiService.js`)
- classe `ApiClient` (`eval/src/core/http/ApiClient.js`)
- facade `apiRequestRaw`, `apiRequest`, `testApiConnection`, `getApiConfig`

### Reset Data (`eval/src/backoffice/pages/ResetDataPage.jsx`)
- `parseResourceIds(resource, xmlText)`
- `deleteResourceItems(resource)`
- `toggleAll()` / `toggleCategory()` / `toggleItem()`
- `handleConfirm()`
- Catalogue: `eval/src/backoffice/functions/resetDataCatalog.js`

### Orders (`eval/src/backoffice/pages/OrdersPage.jsx`)
- modele `Order` (`eval/src/backoffice/models/Order.js`)
- service `OrderService` (`eval/src/backoffice/services/OrderService.js`)
- page `OrdersPage` utilise la couche OO pour chargement + update

### CSV Import (`eval/src/backoffice/pages/CSVImportPage.jsx`)
- `normalizeHeader()`, `normalizeNumber()`, `normalizeTaxRate()`
- `parseXml()`, `serializeXml()`, `extractApiErrorMessage()`
- `apiGetXml()`, `apiPostXml()`, `apiPutXml()`
- `ensureTaxGroupId(csvTaxRate)`
- `build...Xml(...)` (product, declinaison, stock)

## TODO next
- Ajouter React Router pour navigation sans reload (optionnel)
- Extraire helpers XML communs vers `backoffice/functions/xmlHelpers.js`
- Ajouter tests unitaires sur `auth.js` et fonctions CSV
- Ajouter audit log des imports CSV
- Ajouter pagination/filtre sur commandes
