# J2 - Entree 002 - Tableau de bord (Par jour)

## Prompt
"Tableau de bord
Par jour
nb de commande
montant
Total général"

## Objectif metier
Afficher dans le Backoffice un tableau de bord journalier avec:
- nombre de commandes par jour
- montant total par jour
- total general (toutes les lignes affichees)

## Signification des indicateurs
- `nb de commande`:
  - nombre de commandes creees sur une date donnee
- `montant`:
  - somme des montants (`total_paid_tax_incl`) des commandes de cette date
- `Total general`:
  - somme finale des montants de toutes les dates retournees

## Perimetre fonctionnel propose
- Source de donnees: ressource `orders` via API PrestaShop.
- Regroupement: par date (jour) a partir de `date_add`.
- Affichage attendu:
  - colonne `Date`
  - colonne `Nb commandes`
  - colonne `Montant`
  - ligne de fin `Total general`

## Modifications techniques detaillees (effectuees)

### 1) Navigation dashboard
Fichier cible:
- `eval/src/backoffice/pages/Dashboard.jsx`

Modif:
- Ajouter un menu `Statistiques` dans la sidebar.
- Ajouter un rendu conditionnel d une nouvelle page `DashboardStatsPage`.

### 2) Nouvelle page de stats
Fichier cree:
- `eval/src/backoffice/pages/DashboardStatsPage.jsx`

Logique:
- Charger les commandes via `apiRequestRaw('/orders/')` puis details `/orders/{id}`.
- Parser XML pour recuperer:
  - `date_add`
  - `total_paid_tax_incl`
- Grouper les commandes par jour.
- Calculer:
  - `count` par jour
  - `amount` par jour
  - `grandTotal`
- Trier les jours (du plus recent au plus ancien ou inverse selon besoin UX).

### 3) Fonctions a utiliser/ajouter
- `parseOrderList(xmlText)`
- `parseOrderDetail(xmlText)` (version orientee stats)
- `groupOrdersByDay(orders)`
- `formatMoney(value)`
- `computeGrandTotal(groupedRows)`

### 4) Styles
Fichier cible:
- `eval/src/backoffice/backoffice.css`

Modif:
- Ajouter les classes pour le tableau de stats et la ligne de total general.

## Code ajoute (resume des fonctions)
- `loadCsvOrderDateMap()`:
  - charge les dates CSV memorisees dans le localStorage (si disponibles)
- `parseOrderList(xmlText)`:
  - extrait la liste des IDs de commandes depuis la reponse XML `/orders/`
- `parseOrderDetail(xmlText, csvMap)`:
  - extrait `id`, `date` et `total_paid_tax_incl` d une commande
- `normalizeDay(value)`:
  - normalise la date au format `YYYY-MM-DD`
- `formatAmount(value)`:
  - formatte le montant en affichage francais avec 2 decimales
- `DashboardStatsPage`:
  - charge les commandes
  - groupe par jour (`count`, `amount`)
  - calcule `totalGeneral`
  - affiche le tableau + ligne `Total general`

## Modifications effectuees (fichiers)
- `eval/src/backoffice/pages/DashboardStatsPage.jsx` (nouveau)
- `eval/src/backoffice/pages/Dashboard.jsx` (ajout menu + rendu page stats)
- `eval/src/backoffice/backoffice.css` (styles tableau stats)

## Utilisation (mode operatoire)
1. Se connecter au Backoffice.
2. Ouvrir le menu `Statistiques`.
3. Lire les lignes par date:
   - `Nb commandes`
   - `Montant`
4. Verifier la derniere ligne `Total general`.

## Exemples de lecture
Exemple:
- `2026-05-10` -> `3 commandes` -> `154000`
- `2026-05-11` -> `1 commande` -> `20000`
- `Total general` -> `174000`

Interpretation:
- 4 commandes sur la periode affichee
- chiffre total cumule = 174000

## Regles metier a respecter
- `dans le panier` n est pas une commande.
- Les paniers sans commande ne doivent pas etre comptes dans `nb de commande`.
- Le montant vient des commandes creees uniquement.

## Tests recommandés
- Cas 1: aucune commande
  - tableau vide
  - total general = 0
- Cas 2: plusieurs commandes le meme jour
  - aggregation correcte (count + somme)
- Cas 3: plusieurs jours
  - une ligne par jour + total general correct

## Fichiers impactes (plan)
- `eval/src/backoffice/pages/Dashboard.jsx`
- `eval/src/backoffice/pages/DashboardStatsPage.jsx` (nouveau)
- `eval/src/backoffice/backoffice.css`
- `docs/` (ajout d une doc d utilisation si necessaire)
