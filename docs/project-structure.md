# Structure Projet (Convention)

## Objectif
Garder une arborescence claire, scalable, et facile a maintenir.

## Regles de placement

### `eval/src/core/`
- Infrastructure technique generique (independante du metier).
- Exemple: client HTTP, gestion bas niveau reseau.
- Fichier actuel: `core/http/ApiClient.js`.

### `eval/src/shared/`
- Utilitaires reutilisables entre frontoffice et backoffice.
- Pas de logique metier specifique.
- Exemple: `shared/xml/xmlUtils.js`.

### `eval/src/services/`
- Facades globales de l application (point d entree commun).
- Peuvent deleguer vers `core/` ou vers services de domaine.
- Exemple: `services/apiService.js`.

### `eval/src/backoffice/`
- `pages/`: ecrans React backoffice.
- `services/`: logique metier backoffice (classes OO).
- `models/`: objets metier backoffice.
- `constants/`: constantes metier backoffice.
- `functions/`: fonctions utilitaires legacy backoffice.

### `eval/src/frontoffice/`
- `pages/`: ecrans React boutique.
- `components/`: composants UI reutilisables.
- `services/`: logique metier/session/panier frontoffice.
- `hooks/`: hooks React custom.

## Guide pratique (ou mettre un nouveau code)
- Nouvelle integration HTTP ou auth transport: `core/`
- Helper XML/format/date partage: `shared/`
- Regle metier commandes backoffice: `backoffice/services` (+ `models` si objet metier)
- Composant visuel reutilisable front: `frontoffice/components`
- Etat local + UX d une page precise: dans `pages/` de cette zone

## Regles anti-desordre
- Eviter les fonctions utilitaires dupliquees dans les pages.
- Extraire les constantes magiques vers `constants/`.
- Une page React orchestre; un service OO execute la logique metier.
- `shared/` ne depend ni de `frontoffice/` ni de `backoffice/`.
