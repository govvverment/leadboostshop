// Показывает первую букву ника/имени на цветном кружке — так же,
// как сам Telegram делает для пользователей без фото профиля.
// Цвет выбирается детерминированно по строке (один и тот же ник
// всегда даёт один и тот же цвет), а не случайно при каждом рендере.

const PALETTE = ['#5440aa', '#2e8b6f', '#c2703d', '#3d7ec2', '#a3448f', '#5f8c3e'];

function colorFor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function LetterAvatar({ name, size = 36 }) {
  const clean = (name || '?').replace('@', '');
  const letter = clean[0]?.toUpperCase() || '?';

  return (
    <span
      className="letter-avatar"
      style={{
        width: size,
        height: size,
        background: colorFor(clean),
        fontSize: size * 0.42,
      }}
    >
      {letter}
    </span>
  );
}
