import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import { terms } from '../../mock/data';

export default function ProfileTerms() {
  const navigate = useNavigate();
  return (
    <Screen title="Условия и политика">
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Условия и политика</h1>
      </div>
      <p className="hint-text">Последнее обновление: {terms.updatedAt}</p>

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
