import React from 'react';

export default function Navbar({ onLogout }) {
  return (
    <header className="ps-header">
      {/* Barre supérieure (Top Nav) */}
      
      {/* Barre principale (Logo + Menu + Recherche) */}
      <div className="ps-header-main">
        <div className="ps-container ps-flex-header">
          <div className="ps-logo"> 
            <span className="my">New</span><span className="store">store</span>
          </div>
          
        

          
        </div>
      </div>

      {/* Sous-menu (Ex: Papeterie, Accessoires maison) */}
      
    </header>
  );
}