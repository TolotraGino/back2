<?php
class StockapiUpdateModuleFrontController extends ModuleFrontController
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
        header('Content-Type: application/json');

        $wsKey = $this->resolveWsKey();
        if (!$this->isValidWsKey($wsKey)) {
            http_response_code(401);
            die(json_encode(['error' => 'Non autorise']));
        }

        $idProduct          = (int) Tools::getValue('id_product', 0);
        $idProductAttribute = (int) Tools::getValue('id_product_attribute', 0);
        $delta              = (int) Tools::getValue('qty', 0);

        if ($idProduct <= 0) {
            http_response_code(400);
            die(json_encode(['error' => 'id_product invalide']));
        }

        if ($delta <= 0) {
            http_response_code(400);
            die(json_encode(['error' => 'qty doit etre un entier positif']));
        }

        StockAvailable::updateQuantity($idProduct, $idProductAttribute, $delta, null, true);

        $newQty = (int) StockAvailable::getQuantityAvailableByProduct($idProduct, $idProductAttribute);

        die(json_encode([
            'success'    => true,
            'id_product' => $idProduct,
            'delta'      => $delta,
            'quantity'   => $newQty,
        ]));
    }

    private function resolveWsKey()
    {
        $auth = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
        if (preg_match('/^Basic (.+)$/', $auth, $m)) {
            return rtrim((string) base64_decode($m[1]), ':');
        }
        return (string) Tools::getValue('ws_key', '');
    }

    private function isValidWsKey($key)
    {
        if (empty($key)) {
            return false;
        }
        $row = Db::getInstance()->getRow(
            'SELECT id_webservice_account FROM ' . _DB_PREFIX_ . 'webservice_account
             WHERE `key` = \'' . pSQL($key) . '\' AND active = 1'
        );
        return (bool) $row;
    }
}
