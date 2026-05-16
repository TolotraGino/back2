# Import CSV Produits

> Pour l import des **commandes CSV** (`date, nom, email, pwd, adresse, achat, etat`), lire aussi: `docs/csv-orders-import.md`.

## Objectif
Importer des produits depuis CSV en automatisant la conversion TTC -> HT et la creation API.

## Fichier implemente
- `eval/src/backoffice/pages/CSVImportPage.jsx`

## Colonnes CSV

### Requises
- `nom`
- `prix_ttc`
- `Taxe`

### Optionnelles
- `reference`
- `date_availability_produit`
- `categorie`
- `prix_achat`

## Import ZIP images (nouveau)
- Tu peux charger un fichier `.zip` contenant les images produits.
- Règle de nommage: le nom du fichier image doit être la `reference` produit.
- Exemples: `T_01.jpg`, `C_03.png`.
- Extensions supportées: `.jpg`, `.jpeg`, `.png`, `.webp`.
- Après création/mise à jour du produit, l'image est envoyée via:
- `POST /api/images/products/{id_product}` (upload image).

## Exemple
```csv
nom,date_availability_produit,reference,prix_ttc,Taxe,categorie,prix_achat
"Produit Test 1","2026-05-11","REF-001",99.90,20,10,50.00
```

## Conversion prix
```text
prix_HT = prix_TTC / (1 + Taxe / 100)
```

## Fonctions a apprendre
- `normalizeDate()` : convertit `DD/MM/YYYY` vers `YYYY-MM-DD`.
- `normalizeCategoryId()` : valide les categories numeriques.
- `slugify()` : genere lien SEO.
- `escapeXml()` : securise le contenu XML.
- `apiPostXml()` : POST XML + retour ID cree.
- `ensureTaxGroupId()` : trouve/cree groupe de taxe Presta.

## Workflow technique
1. Lecture du CSV.
2. Validation des en-tetes.
3. Normalisation des donnees.
4. Generation XML produit.
5. Envoi `POST /api/products/`.
6. Resultat global: succes + erreurs.

## Erreurs frequentes
- `HTTP 400`: XML invalide ou champ manquant.
- `HTTP 401/403`: token API invalide.
- `HTTP 500`: erreur serveur PrestaShop.

## Conseils
- Tester d abord avec 2-3 lignes.
- Verifier `VITE_API_TOKEN` et permissions Webservice.
- Commencer avec une categorie valide de ton catalogue.
