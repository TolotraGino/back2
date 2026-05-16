export default function ProductCard({ product }) {
  const go = () => {
    window.location.href = `/product/${product.id}`
  }

  return (
    <article className="fo-card" onClick={go}>
      {product.imageUrl ? (
        <img className="fo-card__image" src={product.imageUrl} alt={product.name || 'Produit'} />
      ) : (
        <div className="fo-card__image fo-card__image--empty">Sans image</div>
      )}
      <h3>{product.name || 'Produit'}</h3>
      <p className="fo-ref">Ref: {product.reference || '—'}</p>
      <p className="fo-price">{product.price ? `${product.price} €` : ''}</p>
      <button type="button" onClick={(e) => { e.stopPropagation(); go(); }} className="fo-button">Voir</button>
    </article>
  )
}
