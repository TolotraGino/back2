# TODO Global - Frontoffice / Backoffice

| Ligne | Categorie | Module | Page | Description tache | Type | Estimation (min) | Temps passe (min) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Backoffice | Gestion Login | `/bo` | Creer formulaire login admin | Affichage | 20 | 15 |
| 2 | Backoffice | Gestion Login | `/bo` | Styliser ecran login | Metier | 30 | 35 |
| 3 | Backoffice | Gestion Login | `/bo` | Verifier credentials admin/admin | Integration | 15 | 10 |
| 3.1 | Backoffice | Gestion Login | `/bo` | Pre-remplir login/mdp par defaut dans le formulaire | Affichage | 10 | 8 |
| 4 | Backoffice | Gestion Login | `/bo` | Creer session locale (fake JWT + exp) | Base | 25 | 20 |
| 5 | Backoffice | Gestion Login | `/bo` | Rediriger vers login si session absente | Integration | 20 | 25 |
| 6 | Backoffice | Reset Data | `/bo/reset` | Afficher categories reset + items | Affichage | 25 | 20 |
| 7 | Backoffice | Reset Data | `/bo/reset` | Gerer selection globale + par categorie | Metier | 25 | 30 |
| 8 | Backoffice | Reset Data | `/bo/reset` | Supprimer ressources selectionnees | Integration | 40 | 55 |
| 9 | Backoffice | Reset Data | `/bo/reset` | Fallback stock_availables vers quantity=0 | Metier | 20 | 35 |
| 10 | Backoffice | Reset Data | `/bo/reset` | Afficher resultat suppression par ressource | Affichage | 15 | 12 |
| 11 | Backoffice | Import CSV | `/bo/csvimport` | Upload fichier CSV produits | Affichage | 20 | 18 |
| 12 | Backoffice | Import CSV | `/bo/csvimport` | Parser colonnes et normaliser donnees | Metier | 45 | 60 |
| 13 | Backoffice | Import CSV | `/bo/csvimport` | Conversion TTC -> HT + taxes | Metier | 35 | 45 |
| 14 | Backoffice | Import CSV | `/bo/csvimport` | Creer produits/declinaisons via API | Integration | 60 | 90 |
| 15 | Backoffice | Import CSV | `/bo/csvimport` | Afficher erreurs API et resume import | Affichage | 25 | 20 |
| 15.1 | Backoffice | Import Data Mai 26 | `/bo/csvimport` | Gerer import des 3 CSV du contenu `import-data-mai-26` | Integration | 60 | 80 |
| 15.2 | Backoffice | Import Data Mai 26 | `/bo/csvimport` | Prendre en compte le CSV modifie le 11/05 a 13:15 (version rouge) | Metier | 30 | 50 |
| 15.3 | Backoffice | Import Images | `/bo/csvimport` | Ajouter import du fichier `images.zip` pour les images produits | Integration | 50 | 0 |
| 16 | Backoffice | Commandes | `/bo/orders` | Lister commandes | Affichage | 20 | 18 |
| 17 | Backoffice | Commandes | `/bo/orders` | Charger details commande | Integration | 35 | 30 |
| 18 | Backoffice | Commandes | `/bo/orders` | Changer statut commande (PUT XML) | Metier | 30 | 28 |
| 19 | Backoffice | Commandes | `/bo/orders` | Gérer etats de commande + labels | Integration | 25 | 22 |
| 19.1 | Backoffice | Commandes | `/bo/orders` | Ajouter action etat `paiement effectue` | Metier | 15 | 0 |
| 19.2 | Backoffice | Commandes | `/bo/orders` | Ajouter action etat `annule` | Metier | 15 | 0 |
| 20 | Backoffice | Dashboard | `/bo` | Navigation sidebar reset/commandes/import | Affichage | 20 | 15 |
| 21 | Frontoffice | Landing | `/` | Ecran choix Frontoffice / Backoffice | Affichage | 20 | 15 |
| 22 | Frontoffice | Boutique | `/shop` | Lister produits | Affichage | 35 | 30 |
| 23 | Frontoffice | Boutique | `/shop` | Mapper prix TTC + stock + categorie | Metier | 30 | 35 |
| 24 | Frontoffice | Fiche Produit | `/product/{id}` | Afficher detail produit + image | Affichage | 30 | 28 |
| 25 | Frontoffice | Fiche Produit | `/product/{id}` | Gérer declinaisons et impacts prix | Metier | 45 | 65 |
| 26 | Frontoffice | Panier | `/cart` | Ajouter/supprimer/modifier quantite | Metier | 40 | 50 |
| 27 | Frontoffice | Panier | `/cart` | Afficher transporteurs et total commande | Affichage | 30 | 25 |
| 28 | Frontoffice | Panier | `/cart` | Creer adresse + panier + commande via API | Integration | 75 | 120 |
| 28.1 | Frontoffice | Checkout | `/cart` | Limiter le paiement a `paiement a la livraison` uniquement | Metier | 20 | 0 |
| 28.2 | Frontoffice | Checkout | `/cart` | Appliquer `0` frais de livraison | Metier | 10 | 0 |
| 29 | Frontoffice | Commandes Client | `/orders` | Lister commandes du client | Affichage | 30 | 25 |
| 30 | Frontoffice | Commandes Client | `/orders` | Mapper etat commande en libelle | Metier | 25 | 20 |
| 31 | Frontoffice | Login Client | Header | Afficher panneau connexion client | Affichage | 20 | 18 |
| 32 | Frontoffice | Login Client | Header | Identifier client via email (API customers) | Integration | 30 | 35 |
| 33 | Frontoffice | Session Client | Global | Sauvegarder customer + token localStorage | Base | 15 | 12 |
| 34 | Frontoffice | Navigation | Global | Centraliser routes dans `src/routes.js` | Base | 25 | 20 |
| 35 | Frontoffice | Navigation | Global | Navigation boutons (shop/cart/orders) | Integration | 20 | 15 |
| 36 | Frontoffice | Selection Utilisateur | `/shop` | Remplacer l accueil front par liste utilisateurs existants | Affichage | 35 | 40 |
| 37 | Frontoffice | Selection Utilisateur | `/shop` | Ajouter option `utilisateur anonyme` | Metier | 20 | 25 |
| 38 | Frontoffice | Produits | `/shop` | Marquage dynamique `HOT/NEW` selon `date_availability_produit` | Metier | 35 | 35 |
| 39 | Frontoffice | Produits | `/shop` | Ajouter recherche multicritere (nom, categorie, intervalle de prix) | Integration | 40 | 45 |
| 40 | Backoffice | Import CSV | `/bo/csvimport` | Unifier en un seul bouton import pour 3 CSV independants | Integration | 30 | 35 |
| 41 | Documentation | Architecture | `docs/` | Ajouter guide structure model/service/page + hooks + exemples OO | Base | 30 | 30 |
| 42 | Backoffice | Commandes | `/bo/csvimport` | Mapper `dans le panier` (cart only), `paiement effectue`, `annule` pour import commandes | Metier | 25 | 30 |
| 43 | Backoffice | Commandes | `/bo/orders` | Conserver uniquement les etats commande reels (`paiement effectue`, `annule`) | Metier | 20 | 20 |
| 44 | Backoffice | Dashboard | `/bo` | Afficher stats par jour: nb commandes, montant, total general | Integration | 45 | 55 |
| 45 | Backoffice | Import Declinaisons | `/bo/csvimport` | Gerer le cas `1 import declinaison` sans combinaison (stock base, pas de combinaison creee) | Metier | 30 | 35 |
| 46 | Documentation | J2 | `J2/` | Reporter tous les prompts J2 + modifications + usages | Base | 30 | 35 |

## Notes
- Ce tableau suit le format de ta capture: `Categorie`, `Module`, `Page`, `Description tache`, `Type`.
- Types proposes:
- `Affichage`: UI / rendu ecran
- `Metier`: regles fonctionnelles
- `Integration`: appels API / liaisons entre modules
- `Base`: structure / fondation technique
- `Temps passe = 0`: tache planifiee mais non demarree.

## J2 - Recap
- Backoffice:
  - Etats import commandes: `dans le panier` (cart only), `paiement effectue`, `annule`.
  - Etats page commandes: uniquement etats de commande reels.
  - Dashboard par jour: `nb commandes`, `montant`, `total general`.
  - Import CSV: un seul bouton pour les 3 CSV, import images separe.
  - Declinaisons: supporter cas sans combinaison.
- Frontoffice:
  - Accueil par defaut: selection utilisateur existant.
  - Option `utilisateur anonyme`.
  - Badge produit selon `date_availability_produit`: `HOT` (<=1j), `NEW` (<=7j).
  - Recherche multicritere produits: `nom`, `categorie`, `intervalle de prix`.
- Documentation:
  - Docs dediees par fonctionnalite + historique J2 dans `J2/prompts-et-modifs.md`.
