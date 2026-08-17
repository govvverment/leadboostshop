import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router сам не сбрасывает прокрутку при переходе между
// экранами (в отличие от обычного перехода по ссылкам) — каждый
// новый экран без этого открывается там же, где была прокрутка на
// предыдущем.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
