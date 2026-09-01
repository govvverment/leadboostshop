export default function EmptyState({ icon = '◌', title, subtitle, action, square }) {
  return (
    <div className="empty-state">
      <div className={'empty-state__icon' + (square ? ' empty-state__icon--square' : '')}>{icon}</div>
      <p className="empty-state__title">{title}</p>
      {subtitle && <p className="empty-state__subtitle">{subtitle}</p>}
      {action}
    </div>
  );
}
