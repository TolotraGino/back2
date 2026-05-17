<?php
if (!defined('_PS_VERSION_')) {
    exit;
}

class Stockapi extends Module
{
    public function __construct()
    {
        $this->name = 'stockapi';
        $this->tab = 'administration';
        $this->version = '1.0.0';
        $this->author = 'Custom';
        $this->need_instance = 0;
        parent::__construct();
        $this->displayName = 'Stock API';
        $this->description = 'Endpoint custom pour la mise a jour du stock via StockAvailable::updateQuantity.';
    }

    public function install()
    {
        return parent::install();
    }

    public function uninstall()
    {
        return parent::uninstall();
    }
}
