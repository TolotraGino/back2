<?php
class StockapiHistoryModuleFrontController extends ModuleFrontController
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

        $idProduct = (int) Tools::getValue('id_product', 0);
        if ($idProduct <= 0) {
            http_response_code(400);
            die(json_encode(['error' => 'id_product invalide']));
        }

        $rows = Db::getInstance()->executeS(
            'SELECT physical_quantity, sign, last_wa, current_wa, date_add
             FROM ' . _DB_PREFIX_ . 'stock_mvt
             WHERE referer = ' . (int) $idProduct . '
             ORDER BY date_add ASC'
        );

        $byDay = [];
        foreach ($rows as $row) {
            $day = substr($row['date_add'], 0, 10);
            if (!isset($byDay[$day])) {
                $byDay[$day] = [
                    'date'       => $day,
                    'added'      => 0,
                    'qty_before' => (int) $row['last_wa'],
                    'qty_after'  => 0,
                    'operations' => 0,
                ];
            }
            $byDay[$day]['added']      += (int) $row['physical_quantity'];
            $byDay[$day]['qty_after']   = (int) $row['current_wa'];
            $byDay[$day]['operations'] += 1;
        }

        die(json_encode([
            'id_product' => $idProduct,
            'movements'  => array_values($byDay),
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
