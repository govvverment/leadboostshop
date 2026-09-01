import { useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';

// Настоящее модальное окно снизу — поверх текущего экрана, высотой
// по контенту (не на весь экран), с затемнением фона. Раньше эти
// экраны (подтверждение покупки/результат) рендерились как обычные
// полноэкранные страницы с шапкой — просто визуально стилизованные
// под "шторку", но по факту занимали весь vh.
//
// Закрытие — двумя стандартными для bottom sheet способами:
//   1) тап по затемнённому фону вокруг шторки;
//   2) свайп вниз за "ручку" (серую полоску) сверху шторки.
// По умолчанию закрытие — navigate(-1), можно переопределить через
// onDismiss (например, чтобы отключить закрытие на время загрузки —
// см. ConfirmationSheet.jsx).
const DISMISS_THRESHOLD = 90; // px — после этого свайп считается «отпустил, закрывай»

export default function SheetOverlay({ children, onDismiss, className }) {
  const navigate = useNavigate();
  const close = onDismiss || (() => navigate(-1));

  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef(null);

  const handlePointerDown = (e) => {
    dragStartY.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (dragStartY.current == null) return;
    const delta = e.clientY - dragStartY.current;
    if (delta > 0) setDragY(delta); // тянуть можно только вниз
  };

  const endDrag = () => {
    if (dragStartY.current == null) return;
    dragStartY.current = null;
    setDragging(false);
    if (dragY > DISMISS_THRESHOLD) {
      close();
    } else {
      setDragY(0); // не дотянули — шторка возвращается на место
    }
  };

  return (
    <div
      className="sheet-overlay"
      onClick={(e) => {
        // Тап должен закрывать, только если он пришёлся именно в
        // затемнённую область фона, а не всплыл из чего-то внутри шторки.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={'sheet' + (className ? ` ${className}` : '') + (dragging ? ' sheet--dragging' : '')}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          className="sheet__handle-zone"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="sheet__handle" />
        </div>
        {children}
      </div>
    </div>
  );
}
