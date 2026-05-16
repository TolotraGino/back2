# Login frontoffice

## Objectif metier
- Identifier un client pour lier panier, adresses et commandes.
- Le mot de passe saisi est uniquement UI dans la version actuelle.
- La verification se fait par recherche client sur email dans PrestaShop.

## Fichier principal
- `eval/src/frontoffice/FrontofficeApp.jsx`

## Fonctions utilisees

### `handleLoginSubmit(event)`
- Nettoie l email (`trim`).
- Appelle `GET /api/customers/?filter[email]=[...]&display=full`.
- Parse le XML client.
- Construit l objet `customer` (`id`, `email`, `firstname`, `lastname`, `secure_key`).
- Sauvegarde avec `saveCustomer(customer)`.
- Genere/sauvegarde un token front via `createToken()` + `saveToken()`.

### `handleLogout()`
- Reset des states React du header.
- Nettoie les donnees locales:
- `clearCart()`
- `clearCustomer()`
- `clearToken()`

## Hook lie au login
- `useCartCount()` reste actif apres login/logout pour recalculer le badge panier.
- Fichier: `eval/src/frontoffice/hooks/useCartCount.js`.

## Service utilise
- `eval/src/frontoffice/services/cartService.js`
- `eval/src/services/apiService.js`

## Comportement UI
- Bouton `Connexion` affiche/masque un panneau de login.
- En cas d erreur API ou client absent: message dans `loginError`.
- Si client connecte: affichage nom/email + bouton `Deconnexion`.
