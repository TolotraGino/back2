# J3 - Gestion stock et evolution journaliere

## Objectif
Ajouter une page backoffice pour:
- ajouter du stock a un produit,
- afficher un tableau d evolution du stock par jour pour un produit.

## Emplacement
- Page: `eval/src/backoffice/pages/StockPage.jsx`
- Navigation BO: `eval/src/backoffice/pages/Dashboard.jsx`
- Route: `/bo/stock`

## Fonctionnement

### 1) Ajout stock produit
- Recherche produit par `reference` via API PrestaShop:
  - `GET /products/?filter[reference]=[...]&display=full`
- Recuperation du stock associe (`stock_availables`) pour `id_product_attribute=0`.
- Si stock inexistant: creation automatique d un `stock_available` avec quantite `0`.
- Saisie d une quantite strictement positive.
- Mise a jour stock par `PUT /stock_availables/{id}` avec nouvelle quantite.

### 2) Journal des mouvements
- Chaque ajout stock reussi est logge localement (localStorage):
  - cle: `bo_stock_journal_v1`
  - donnees: date/heure, produit, stock avant, quantite ajoutee, stock apres, statut.
- En cas d echec API, une entree d erreur est aussi enregistree.

### 3) Tableau evolution journaliere
- Filtre sur la reference produit courante.
- Groupement des mouvements valides par jour.
- Colonnes affichees:
  - Date
  - Ajout total du jour
  - Stock debut -> stock fin
  - Nombre d operations du jour

## Notes
- Cette evolution est basee sur les mouvements effectues via cette page (journal local), pas sur un historique natif PrestaShop.
- Si besoin d un historique global multi-utilisateur, prevoir une persistence serveur/Bdd.
