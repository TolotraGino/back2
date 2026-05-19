<?php
if (!defined('_PS_VERSION_')) {
    exit;
}

class StockapiImportModuleFrontController extends ModuleFrontController
{
    public function init()
    {
        parent::init();
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }

    public function postProcess()
    {
        @set_time_limit(300);
        @ini_set('memory_limit', '256M');
        header('Content-Type: application/json');

        $wsKey = $this->resolveWsKey();
        if (!$this->isValidWsKey($wsKey)) {
            http_response_code(401);
            die(json_encode(['error' => 'Non autorise']));
        }

        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) {
            http_response_code(400);
            die(json_encode(['error' => 'Corps JSON invalide']));
        }

        $products = is_array($body['products'] ?? null) ? $body['products'] : [];
        $variants  = is_array($body['variants']  ?? null) ? $body['variants']  : [];

        $results = [
            'products' => ['success' => 0, 'failed' => 0, 'errors' => []],
            'variants' => ['success' => 0, 'failed' => 0, 'errors' => []],
        ];

        $productIdMap    = []; // reference → id_product
        $combinationsSet = []; // id_product déjà convertis en type=combinations

        // ── Produits ──────────────────────────────────────────────────────────
        foreach ($products as $i => $row) {
            $rowLabel = 'Ligne ' . ($i + 2);
            try {
                $id = $this->processProduct($row, $combinationsSet);
                $ref = trim($row['reference'] ?? '');
                if ($ref) $productIdMap[$ref] = $id;
                $results['products']['success']++;
            } catch (Exception $e) {
                $results['products']['failed']++;
                $results['products']['errors'][] = [
                    'row'   => $rowLabel,
                    'name'  => $row['nom'] ?? '',
                    'error' => $e->getMessage(),
                ];
            }
        }

        // ── Déclinaisons ──────────────────────────────────────────────────────
        foreach ($variants as $i => $row) {
            $rowLabel = 'Ligne ' . ($i + 2);
            try {
                $ref       = trim($row['reference'] ?? '');
                $idProduct = $productIdMap[$ref] ?? $this->findProductIdByReference($ref);
                if (!$idProduct) throw new Exception("Produit introuvable: $ref");
                $this->processVariant($row, $idProduct, $combinationsSet);
                $results['variants']['success']++;
            } catch (Exception $e) {
                $results['variants']['failed']++;
                $results['variants']['errors'][] = [
                    'row'   => $rowLabel,
                    'name'  => $row['reference'] ?? '',
                    'error' => $e->getMessage(),
                ];
            }
        }

        die(json_encode([
            'ok'          => true,
            'results'     => $results,
            'product_ids' => $productIdMap,
        ]));
    }

    // ── Traitement d'un produit ───────────────────────────────────────────────

    private function processProduct(array $row, array &$combinationsSet): int
    {
        $reference   = trim($row['reference']            ?? '');
        $nom         = trim($row['nom']                  ?? '');
        $priceHt     = (float) ($row['price_ht']         ?? 0);
        $wholesale   = (float) ($row['wholesale_price']  ?? 0);
        $taxGroupId  = (int)   ($row['id_tax_rules_group']  ?? 1);
        $categoryId  = (int)   ($row['id_category_default'] ?? 2);
        $hasVariants = !empty($row['has_variants']);
        $availDate   = trim($row['available_date'] ?? '');
        $langId      = (int) Configuration::get('PS_LANG_DEFAULT');

        if (!$reference) throw new Exception('Référence manquante');

        $existingId = $this->findProductIdByReference($reference);

        if ($existingId) {
            $product = new Product($existingId);
            $product->price              = $priceHt;
            $product->id_tax_rules_group = $taxGroupId;
            if ($wholesale > 0) $product->wholesale_price = $wholesale;
            if ($availDate)     $product->available_date  = $availDate;
            $product->active = 1;
            if (!$product->save()) throw new Exception("Mise à jour échouée: $reference");

            if ($hasVariants && !in_array($existingId, $combinationsSet, true)) {
                $this->ensureTypeCombinations($existingId);
                $combinationsSet[] = $existingId;
            }
            return $existingId;
        }

        $product = new Product();
        $product->name                = [$langId => $nom];
        $product->link_rewrite        = [$langId => $this->slugify($nom)];
        $product->reference           = $reference;
        $product->price               = $priceHt;
        $product->wholesale_price     = $wholesale;
        $product->id_tax_rules_group  = $taxGroupId;
        $product->id_category_default = $categoryId;
        $product->id_shop_default     = (int) Configuration::get('PS_SHOP_DEFAULT');
        $product->active              = 1;
        $product->available_for_order = 1;
        $product->show_price          = 1;
        $product->visibility          = 'both';
        $product->minimal_quantity    = 1;
        $product->state               = Product::STATE_SAVED;
        if ($availDate)     $product->available_date = $availDate;
        if ($hasVariants)   $product->product_type   = 'combinations';

        if (!$product->add()) throw new Exception("Création échouée: $reference");

        if ($categoryId) $product->addToCategories([$categoryId]);
        if ($hasVariants) $combinationsSet[] = (int) $product->id;

        return (int) $product->id;
    }

    // ── Traitement d'une déclinaison ─────────────────────────────────────────

    private function processVariant(array $row, int $idProduct, array &$combinationsSet): void
    {
        $specificite = trim($row['specificite']     ?? '');
        $karazany    = trim($row['karazany']        ?? '');
        $quantity    = (int)   ($row['stock_initial']    ?? 0);
        $priceImpact = (float) ($row['price_impact_ht']  ?? 0);
        $idAttrGroup = (int)   ($row['id_attribute_group'] ?? 0);
        $idAttrValue = (int)   ($row['id_attribute_value']  ?? 0);
        $comboRef    = trim($row['combo_reference'] ?? '');

        // Pas de déclinaison → stock de base
        if (!$specificite || !$karazany) {
            if ($quantity > 0) StockAvailable::setQuantity($idProduct, 0, $quantity);
            return;
        }

        if (!in_array($idProduct, $combinationsSet, true)) {
            $this->ensureTypeCombinations($idProduct);
            $combinationsSet[] = $idProduct;
        }

        if (!$idAttrGroup || !$idAttrValue) {
            throw new Exception("Attributs manquants pour '$karazany'");
        }

        $combination                   = new Combination();
        $combination->id_product       = $idProduct;
        $combination->reference        = $comboRef;
        $combination->price            = $priceImpact;
        $combination->minimal_quantity = 1;

        if (!$combination->add()) throw new Exception("Création déclinaison échouée: $karazany");

        $combination->setAttributes([$idAttrValue]);
        StockAvailable::setQuantity($idProduct, (int) $combination->id, $quantity);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function ensureTypeCombinations(int $productId): void
    {
        $product = new Product($productId);
        if ($product->product_type !== 'combinations') {
            $product->product_type = 'combinations';
            $product->save();
            StockAvailable::setQuantity($productId, 0, 0);
        }
    }

    private function findProductIdByReference(string $ref): int
    {
        if (!$ref) return 0;
        return (int) Db::getInstance()->getValue(
            'SELECT id_product FROM `' . _DB_PREFIX_ . 'product`
             WHERE reference = \'' . pSQL($ref) . '\''
        );
    }

    private function slugify(string $str): string
    {
        $str = mb_strtolower(trim($str));
        $str = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $str);
        $str = preg_replace('/[^a-z0-9\s\-]/', '', $str);
        $str = preg_replace('/[\s\-]+/', '-', $str);
        return trim($str, '-') ?: 'produit';
    }

    private function resolveWsKey(): string
    {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/^Basic (.+)$/', $auth, $m)) {
            return rtrim((string) base64_decode($m[1]), ':');
        }
        return (string) Tools::getValue('ws_key', '');
    }

    private function isValidWsKey(string $key): bool
    {
        if (empty($key)) return false;
        return (bool) Db::getInstance()->getRow(
            'SELECT id_webservice_account FROM `' . _DB_PREFIX_ . 'webservice_account`
             WHERE `key` = \'' . pSQL($key) . '\' AND active = 1'
        );
    }
}
