# Documentation — Stock API & Gestion de stock

Projet : backoffice React + module PrestaShop custom `stockapi`  
PrestaShop : 8.2.6 à `/opt/lampp/htdocs/back/`  
React SPA : `/home/gino/Documents/GitHub/back2/eval/`

---

## Déploiement rapide (copier-coller)

```bash
# Copier les 3 fichiers du module vers PrestaShop en une seule fois
sudo cp /home/gino/Documents/GitHub/back2/modules/stockapi/stockapi.php \
        /opt/lampp/htdocs/back/modules/stockapi/stockapi.php

sudo cp /home/gino/Documents/GitHub/back2/modules/stockapi/controllers/front/update.php \
        /opt/lampp/htdocs/back/modules/stockapi/controllers/front/update.php

sudo cp /home/gino/Documents/GitHub/back2/modules/stockapi/controllers/front/history.php \
        /opt/lampp/htdocs/back/modules/stockapi/controllers/front/history.php
```

---

## 1. Arborescence du module

```
modules/stockapi/
├── stockapi.php                          # Déclaration du module PS
└── controllers/front/
    ├── update.php                        # POST  — ajoute du stock
    └── history.php                       # GET   — historique journalier
```

---

## 2. Déploiement du module vers PrestaShop

À chaque modification des fichiers PHP du module :

```bash
sudo cp /home/gino/Documents/GitHub/back2/modules/stockapi/controllers/front/update.php \
        /opt/lampp/htdocs/back/modules/stockapi/controllers/front/update.php

sudo cp /home/gino/Documents/GitHub/back2/modules/stockapi/controllers/front/history.php \
        /opt/lampp/htdocs/back/modules/stockapi/controllers/front/history.php

sudo cp /home/gino/Documents/GitHub/back2/modules/stockapi/stockapi.php \
        /opt/lampp/htdocs/back/modules/stockapi/stockapi.php
```

---

## 3. Commandes SQL utiles

### Vérifier les mouvements de stock créés par l'API
```sql
SELECT id_stock_mvt, id_stock, physical_quantity, sign,
       last_wa, current_wa, referer, date_add
FROM ps_stock_mvt
ORDER BY id_stock_mvt DESC
LIMIT 20;
```

### Vérifier les stocks disponibles d'un produit
```sql
SELECT id_stock_available, id_product, id_product_attribute, quantity
FROM ps_stock_available
WHERE id_product = <id_produit>
ORDER BY id_product_attribute;
```

### Activer la boutique (si erreur 503 maintenance)
```sql
UPDATE ps_configuration SET value = '1' WHERE name = 'PS_SHOP_ENABLE';
```

### Vérifier que la raison de mouvement id=1 existe (requise par PS back-office)
```sql
SELECT * FROM ps_stock_mvt_reason_lang WHERE id_stock_mvt_reason = 1;
```

### Vérifier les déclinaisons (combinations) d'un produit
```sql
SELECT id_product_attribute, id_product, reference
FROM ps_product_attribute
WHERE id_product = <id_produit>;
```

### Lancer le client MySQL XAMPP
```bash
/opt/lampp/bin/mysql -u root prestashop
```

---

## 4. Endpoints du module `stockapi`

### POST — Ajouter du stock

```
POST /index.php?fc=module&module=stockapi&controller=update&ws_key=<CLE>
Content-Type: application/x-www-form-urlencoded

id_product=24&id_product_attribute=0&qty=4
```

**Paramètres :**

| Paramètre              | Type | Description                                      |
|------------------------|------|--------------------------------------------------|
| `id_product`           | int  | ID du produit PS (obligatoire, > 0)              |
| `id_product_attribute` | int  | ID de la déclinaison, `0` = produit de base      |
| `qty`                  | int  | Quantité à ajouter (obligatoire, > 0)            |
| `ws_key`               | str  | Clé webservice PS (en GET car Apache bloque Authorization) |

**Réponse succès :**
```json
{ "success": true, "id_product": 24, "delta": 4, "quantity": 30 }
```

---

### GET — Historique journalier

```
GET /index.php?fc=module&module=stockapi&controller=history&id_product=24&ws_key=<CLE>
```

**Réponse :**
```json
{
  "id_product": 24,
  "movements": [
    { "date": "2026-05-17", "added": 7, "qty_before": 22, "qty_after": 29, "operations": 2 }
  ]
}
```

---

## 5. Pourquoi `ws_key` en GET et non en header Authorization

Apache (XAMPP) supprime le header `Authorization` avant que PHP le reçoive pour les
front controllers de modules PS. Le header `HTTP_AUTHORIZATION` est toujours vide.  
**Solution :** passer `ws_key` en paramètre GET dans l'URL.

---

## 6. Pourquoi stocker `id_stock_available` dans `id_stock`

Le back-office PS (`StockMovementRepository`) fait :

```sql
INNER JOIN ps_stock_available sa ON (sa.id_stock_available = sm.id_stock)
```

Si `id_stock = 0`, la jointure échoue et le mouvement n'apparaît **pas** dans l'onglet
**Mouvements de stock** du back-office.

Le champ `referer` (= `id_product`) sert à notre endpoint `history` pour filtrer
les mouvements par produit quand ASM n'est pas activé.

---

## 7. Lancer l'application React (dev)

```bash
cd /home/gino/Documents/GitHub/back2/eval
npm run dev
```

Le proxy Vite redirige automatiquement :
- `/api/*`       → `http://localhost/back/api/*`
- `/index.php*`  → `http://localhost/back/index.php*`

---

## 8. Variables d'environnement React

Fichier `.env` ou `.env.local` dans `eval/` :

```env
VITE_API_BASE_URL=http://localhost:5173/api
VITE_API_TOKEN=<CLE_WEBSERVICE_PS>
```

La clé webservice se trouve dans :  
**PS back-office → Paramètres avancés → Services Web**

---

## 9. Points clés de l'architecture

| Besoin | Solution |
|--------|----------|
| Mise à jour stock en 1 seul appel | `StockAvailable::updateQuantity($idProduct, $idAttr, $delta)` dans `update.php` |
| Historique visible dans PS back-office | Stocker `id_stock_available` réel dans `ps_stock_mvt.id_stock` |
| Filtrer historique par produit (sans ASM) | Stocker `id_product` dans `ps_stock_mvt.referer` |
| Recherche par référence de déclinaison | Chercher d'abord dans `/products/`, puis dans `/combinations/` via l'API REST PS |
| Sélecteur de déclinaison | Fetch `/combinations/?filter[id_product]=[id]` puis `<select>` dans le formulaire |
