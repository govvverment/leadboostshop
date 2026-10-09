import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import { terms } from '../../mock/data';
import { useLocale } from '../../context/LocaleContext';

// Текст самих условий (terms.sections) — длинный юридический документ,
// хранится как данные (mock/data.js) только на русском и не переводится
// автоматически. Переведена только "обёртка" экрана вокруг него.
export default function ProfileTerms() {
  const navigate = useNavigate();
  const { t } = useLocale();
  return (
    <Screen title={t('terms.title')}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          ‹
        </button>
        <h1 className="page-head__title">{t('terms.title')}</h1>
      </div>
      <p className="hint-text">{t('terms.lastUpdated', { date: terms.updatedAt })}</p>

      <div className="terms">
        {terms.sections.map((s) => (
          <div key={s.title} className="terms__section">
            <h3 className="terms__heading">{s.title}</h3>
            {s.body.split('\n\n').map((block, i) => (
              <p key={i} className="terms__block">
                {block}
              </p>
            ))}
          </div>
        ))}
      </div>
    </Screen>
  );
}
