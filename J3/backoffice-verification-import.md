# Backoffice - Verification des erreurs d import

## Perimetre
Cette verification est appliquee dans l ecran `CSVImportPage` pour les imports:
- produits,
- declinaisons,
- commandes.

## Regles appliquees

### 1) Nom de colonne non conforme
Le systeme rejette le fichier si:
- une colonne obligatoire est absente,
- une colonne inconnue est presente,
- il y a des colonnes en trop (produits/commandes).

#### Colonnes attendues
- Produits: `date_availability_produit, nom, reference, prix_ttc, Taxe, categorie, prix_achat`
- Declinaisons: `reference, specificite, karazany, stock_initial, prix_vente_ttc`
- Commandes: `date, nom, email, pwd, adresse, achat, etat`

### 2) Format de date strict DD/MM/YYYY
Pour les commandes, la colonne `date` doit respecter strictement `DD/MM/YYYY` et representer une date reelle.

Exemples:
- Valide: `05/01/2026`
- Invalide: `2026-01-05`, `5/1/2026`, `31/02/2026`

### 3) Montant positif
Pour les produits, les champs de montant doivent etre strictement positifs (`> 0`):
- `prix_ttc`
- `prix_achat`

Valeurs rejetees: `0`, negatives, non numeriques, vides.

## Comportement de l import
- Les lignes invalides sont ignorees avec message d erreur par ligne.
- Si aucune ligne valide n est trouvee, l import est bloque.
- Les erreurs sont affichees dans l interface backoffice.
