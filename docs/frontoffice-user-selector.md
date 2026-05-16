# Frontoffice - Selection Utilisateur (OO)

## Objectif
Remplacer la page d accueil frontoffice par une page de selection utilisateur:
- liste des utilisateurs existants
- choix du compte avec lequel se connecter
- option `utilisateur anonyme`

## Fichiers implementes
- `eval/src/frontoffice/pages/CustomerSelectPage.jsx`
- `eval/src/frontoffice/models/FrontCustomer.js`
- `eval/src/frontoffice/services/CustomerDirectoryService.js`
- `eval/src/frontoffice/FrontofficeApp.jsx`
- `eval/src/frontoffice/front.css`

## Architecture orientee objet

### Modele
- `FrontCustomer`
  - represente un utilisateur front
  - methode `getDisplayName()`
  - factory `FrontCustomer.anonymous()`

### Service
- `CustomerDirectoryService`
  - charge les clients existants via API `/customers/?display=full`
  - parse XML
  - retourne des instances `FrontCustomer`

### Page
- `CustomerSelectPage`
  - affiche la liste des utilisateurs
  - bouton `Continuer en utilisateur anonyme`
  - callback `onSelectCustomer(customer)`

## Utilisation
1. Ouvrir le frontoffice (`/shop`).
2. Si aucun utilisateur n est connecte:
   - la page de selection s affiche par defaut.
3. Choisir:
   - un utilisateur existant, ou
   - `utilisateur anonyme`.
4. Le choix est sauvegarde (localStorage) et la session front est active.

## Notes metier
- L utilisateur anonyme permet de naviguer sans compte client reel.
- Les actions qui exigent un vrai client peuvent echouer ou demander connexion selon la logique des pages (panier/commandes).
