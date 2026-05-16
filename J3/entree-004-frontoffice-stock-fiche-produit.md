# J3 - FrontOffice - Afficher la quantite en stock sur la fiche produit

## Objectif
Afficher clairement la quantite en stock disponible sur la fiche produit FrontOffice.

## Modification realisee
- Fichier modifie: `eval/src/frontoffice/pages/ProductPage.jsx`
- Ajout d une ligne dans les metadonnees produit:
  - `Quantite disponible : X`

## Comportement
- Produit simple (sans declinaison selectionnee):
  - utilise le stock produit (`product.quantity`).
- Produit avec declinaison selectionnee:
  - utilise le stock de la declinaison (`combinationStock`).
- Quantite finalisee:
  - forcee a une valeur numerique >= 0 pour eviter un affichage incoherent.

## Affichage
La fiche produit affiche maintenant:
- statut stock (en stock / rupture) dans le bloc achat,
- quantite numerique explicite dans le bloc meta produit.
