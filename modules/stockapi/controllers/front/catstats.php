<?php
if (!defined('_PS_VERSION_')) {
    exit;
}

class StockapiCatstatsModuleFrontController extends ModuleFrontController
{
    public function init()
    {
        parent::init();
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }

    public function postProcess()
    {
        header('Content-Type: application/json');

        $wsKey = $this->resolveWsKey();
        if (!$this->isValidWsKey($wsKey)) {
            http_response_code(401);
            die(json_encode(['error' => 'Non autorise']));
        }

        $langId = (int) Configuration::get('PS_LANG_DEFAULT');
        $p      = _DB_PREFIX_;

        // Qté physique = stock disponible PS par catégorie par défaut du produit
        // Qté réservée = articles dans des paniers sans commande associée
        $sql = "
            SELECT
                cl.name            AS category_name,
                c.id_category,
                COALESCE(SUM(sa.quantity), 0)          AS qty_physical,
                COALESCE(SUM(reserved.qty_reserved), 0) AS qty_reserved
            FROM `{$p}product` p
            INNER JOIN `{$p}category` c
                ON c.id_category = p.id_category_default
            INNER JOIN `{$p}category_lang` cl
                ON cl.id_category = c.id_category AND cl.id_lang = {$langId}
            LEFT JOIN `{$p}stock_available` sa
                ON sa.id_product = p.id_product AND sa.id_product_attribute = 0
            LEFT JOIN (
                SELECT cpp.id_product, SUM(cpp.quantity) AS qty_reserved
                FROM `{$p}cart_product` cpp
                LEFT JOIN `{$p}orders` o ON o.id_cart = cpp.id_cart
                WHERE o.id_order IS NULL
                GROUP BY cpp.id_product
            ) AS reserved ON reserved.id_product = p.id_product
            WHERE p.active = 1
              AND c.active = 1
              AND c.id_parent >= 2
            GROUP BY c.id_category, cl.name
            ORDER BY cl.name
        ";

        $rows = Db::getInstance()->executeS($sql);
        if ($rows === false) {
            http_response_code(500);
            die(json_encode(['error' => 'Erreur base de donnees']));
        }

        $categories = [];
        foreach ($rows as $row) {
            $physical  = (int) $row['qty_physical'];
            $reserved  = (int) $row['qty_reserved'];
            $categories[] = [
                'id_category'   => (int) $row['id_category'],
                'name'          => $row['category_name'],
                'qty_physical'  => $physical,
                'qty_reserved'  => $reserved,
                'qty_available' => max(0, $physical - $reserved),
            ];
        }

        die(json_encode(['ok' => true, 'categories' => $categories]));
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
