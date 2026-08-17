export function LoaderDefault({ label = 'Загрузка...' }) {
  return (
    <div className="loader-default">
      <span className="spinner spinner--lg" />
      <span className="loader-default__label">{label}</span>
    </div>
  );
}

export function LoaderCompact() {
  return <span className="spinner spinner--sm" />;
}

export function ErrorState({ message = 'Не удалось загрузить данные', onRetry }) {
  return (
    <div className="error-state">
      <div className="error-state__icon">!</div>
      <p className="error-state__message">{message}</p>
      {onRetry && (
        <button className="btn btn--secondary" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}
