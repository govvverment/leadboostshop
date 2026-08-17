export default function ProductIcon({ kind, size = 40 }) {
  const src = kind === 'account' ? '/icons/product-account.png' : '/icons/product-solution.png';
  return (
    <img
      src={src}
      alt=""
      className="product-icon-img"
      style={{ width: size, height: size }}
    />
  );
}
