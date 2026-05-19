<?php
/**
 * ObjectModel — décrit la structure de la ressource exposée à l'API.
 * PrestaShop s'en sert pour générer le schéma XML (blank / synopsis).
 */
class OrderStateUpdateWebserviceResource extends ObjectModel
{
    public $id_order;
    public $id_order_state;
    public $date_add;

    public static $definition = [
        'table'   => 'orders',           // table existante, pas de création nécessaire
        'primary' => 'id_order',
        'fields'  => [
            'id_order' => [
                'type'     => self::TYPE_INT,
                'validate' => 'isUnsignedId',
                'required' => true,
            ],
            'id_order_state' => [
                'type'     => self::TYPE_INT,
                'validate' => 'isUnsignedId',
                'required' => true,
            ],
            'date_add' => [
                'type'     => self::TYPE_DATE,
                'validate' => 'isDateFormat',
                'required' => false,   // optionnel : si absent → now()
            ],
        ],
    ];

    protected $webserviceParameters = [
        'objectNodeName'  => 'order_state_update',
        'objectsNodeName' => 'order_state_updates',
        'fields'          => [
            'id_order'       => [],
            'id_order_state' => [],
            'date_add'       => [],   // format attendu : Y-m-d H:i:s
        ],
        'associations' => [],
    ];
}

/**
 * Gestionnaire métier — contient toute la logique HTTP (POST / GET / HEAD).
 * Le nom DOIT suivre le pattern : WebserviceSpecificManagement + <CamelCase de la clé du hook>
 * Clé du hook : 'order_state_update'  →  OrderStateUpdate  →  WebserviceSpecificManagementOrderStateUpdate
 */
class WebserviceSpecificManagementOrderStateUpdate implements WebserviceSpecificManagementInterface
{
    protected $output    = '';
    protected $ws_object;
    protected $objOutput;

    /* ── Interface obligatoire ── */
    public function setObjectsArray(&$objs) {}
    public function getObjectsArray()                              { return []; }
    public function setWsObject(WebserviceRequest $obj)            { $this->ws_object = $obj; return $this; }
    public function getWsObject()                                  { return $this->ws_object; }
    public function getContent()                                   { return $this->output; }
    public function setObjectOutput(WebserviceOutputBuilder $obj)  { $this->objOutput = $obj; return $this; }
    public function getObjectOutput()                              { return $this->objOutput; }

    /* ── Point d'entrée principal ── */
    public function manage()
    {
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET' || $method === 'HEAD') {
            return $this->manageGetAndHead();
        }

        if ($method !== 'POST') {
            throw new WebserviceException('Seules les méthodes GET et POST sont acceptées', [405, 405]);
        }

        return $this->managePost();
    }

    /* ── Constantes des états métier ── */
    const STATE_PAID             = 2;   // Paiement accepté
    const STATE_DELIVERED        = 5;   // Livré
    const STATE_CANCELLED        = 6;   // Annulé
    const STATE_REMOTE_PAYMENT   = 11;  // Paiement à distance (pass-partout)
    const STATE_ERROR_PAYMENT    = 8;   // Erreur paiement

    /**
     * Matrice des transitions autorisées par current_state.
     */
    protected static $allowedTransitions = [
        self::STATE_PAID      => [self::STATE_DELIVERED, self::STATE_CANCELLED],
        self::STATE_CANCELLED => [self::STATE_PAID],
        // STATE_REMOTE_PAYMENT / STATE_ERROR_PAYMENT : autorisé vers tout
        // STATE_DELIVERED : absent = bloqué
    ];

    protected function validateTransition(int $currentState, int $targetState)
    {
        if ($currentState === self::STATE_REMOTE_PAYMENT || $currentState === self::STATE_ERROR_PAYMENT) {
            return;
        }

        if ($currentState === self::STATE_DELIVERED) {
            throw new WebserviceException(
                'Transition impossible : une commande livrée (état 5) ne peut plus être modifiée.',
                [422, 422]
            );
        }

        $allowed = self::$allowedTransitions[$currentState] ?? [];
        if (!in_array($targetState, $allowed, true)) {
            throw new WebserviceException(
                sprintf(
                    'Transition non autorisée : état actuel %d → état demandé %d. Transitions autorisées : [%s].',
                    $currentState,
                    $targetState,
                    implode(', ', $allowed) ?: 'aucune'
                ),
                [422, 422]
            );
        }
    }

    /* ── POST : changement d'état ── */
    protected function managePost()
    {
        $body = $this->getRequestBody();

        $idOrder      = (int) ($body['id_order']       ?? 0);
        $idOrderState = (int) ($body['id_order_state'] ?? 0);

        $rawDate = trim($body['date_add'] ?? '');
        $dateAdd = ($rawDate !== '' && Validate::isDateFormat($rawDate))
            ? $rawDate
            : date('Y-m-d H:i:s');

        if (!$idOrder || !$idOrderState) {
            throw new WebserviceException('id_order et id_order_state sont obligatoires', [400, 400]);
        }

        $order = new Order($idOrder);
        if (!Validate::isLoadedObject($order)) {
            throw new WebserviceException('Commande introuvable : id_order = ' . $idOrder, [404, 404]);
        }

        $orderState = new OrderState($idOrderState);
        if (!Validate::isLoadedObject($orderState)) {
            throw new WebserviceException('Statut introuvable : id_order_state = ' . $idOrderState, [404, 404]);
        }

        $this->validateTransition((int) $order->current_state, $idOrderState);

        $history                 = new OrderHistory();
        $history->id_order       = $order->id;
        $history->id_order_state = $idOrderState;

        if ($idOrderState === self::STATE_DELIVERED) {
            // Livraison uniquement : PS gère le mouvement de stock nativement
            $history->changeIdOrderState($idOrderState, $order);
        } else {
            // Autres transitions : mise à jour de l'état SANS décrémenter le stock
            $order->current_state = $idOrderState;
            if ($orderState->paid) {
                $order->valid = 1; // marquer commande validée si état = payé
            }
            $order->update();
        }

        $history->addWithemail(true);

        $resource                 = $this->buildResourceObject();
        $resource->id             = $idOrder;
        $resource->id_order       = $idOrder;
        $resource->id_order_state = $idOrderState;
        $resource->date_add       = $dateAdd;

        $this->output = $this->objOutput->getContent(
            ['empty' => $this->buildResourceObject(), $resource],
            null,
            'full',
            $this->ws_object->depth,
            WebserviceOutputBuilder::VIEW_DETAILS
        );

        return true;
    }

    /* ── GET / HEAD : schéma ou liste fictive ── */
    protected function manageGetAndHead()
    {
        $resource = $this->buildResourceObject();
        $this->ws_object->resourceConfiguration = $resource->getWebserviceParameters();

        if (isset($this->ws_object->urlFragments['schema'])) {
            $schema = $this->ws_object->urlFragments['schema'];
            if (!in_array($schema, ['blank', 'synopsis'])) {
                throw new WebserviceException('schema doit être blank ou synopsis', [400, 400]);
            }

            $this->output = $this->objOutput->getContent(
                ['empty' => $resource],
                $schema,
                'full',
                $this->ws_object->depth,
                WebserviceOutputBuilder::VIEW_DETAILS
            );

            return true;
        }

        if (!$this->ws_object->setFieldsToDisplay()) {
            return false;
        }

        $resource->id             = 1;
        $resource->id_order       = 0;
        $resource->id_order_state = 0;

        $this->output = $this->objOutput->getContent(
            ['empty' => $this->buildResourceObject(), $resource],
            null,
            $this->ws_object->fieldsToDisplay,
            $this->ws_object->depth,
            WebserviceOutputBuilder::VIEW_LIST
        );

        return true;
    }

    /* ── Helpers ── */
    protected function buildResourceObject()
    {
        return new OrderStateUpdateWebserviceResource();
    }

    protected function getRequestBody()
    {
        $rawBody = file_get_contents('php://input');
        $json    = json_decode($rawBody, true);

        if (is_array($json)) {
            return $json;
        }

        if (trim($rawBody) === '') {
            return [];
        }

        $xml = @simplexml_load_string($rawBody);
        if ($xml === false) {
            return [];
        }

        if (isset($xml->order_state_update)) {
            $xml = $xml->order_state_update;
        }

        return [
            'id_order'       => (string) $xml->id_order,
            'id_order_state' => (string) $xml->id_order_state,
            'date_add'       => (string) $xml->date_add,
        ];
    }
}
