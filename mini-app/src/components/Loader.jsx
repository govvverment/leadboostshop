import { useLocale } from '../context/LocaleContext';

export function LoaderDefault({ label }) {
  const { t } = useLocale();
  return (
    <div className="loader-default">
      <span className="spinner spinner--lg" />
      <span className="loader-default__label">{label ?? t('loader.loading')}</span>
    </div>
  );
}

export function LoaderCompact() {
  return <span className="spinner spinner--sm" />;
}

export function ErrorState({ message, subtitle, onRetry }) {
  const { t } = useLocale();
  const resolvedMessage = message ?? t('loader.errorTitle');
  const resolvedSubtitle = subtitle === undefined ? t('loader.errorSubtitle') : subtitle;
  return (
    <div className="error-state">
      <div className="error-state__icon">!</div>
      <p className="error-state__message">{resolvedMessage}</p>
      {resolvedSubtitle && <p className="error-state__subtitle">{resolvedSubtitle}</p>}
      {onRetry && (
        <button className="btn btn--primary" onClick={onRetry}>
          {t('loader.retry')}
        </button>
      )}
    </div>
  );
}
