import accountIcon from '../assets/icons/product-account.png';
import solutionIcon from '../assets/icons/product-solution.png';

// Импорт вместо строкового пути к public/ — Vite вшивает файл (меньше
// 4кб) в бандл как base64, иконка-заглушка рисуется сразу же, без
// отдельного сетевого запроса за картинкой.
export default function ProductIcon({ kind, size = 40 }) {
  const src = kind === 'account' ? accountIcon : solutionIcon;
  return (
    <img
      src={src}
      alt=""
      className="product-icon-img"
      style={{ width: size, height: size }}
    />
  );
}
