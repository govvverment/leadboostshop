import { useApp } from '../context/AppContext';

export default function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className="toast toast--success">
      <span className="toast__icon">✓</span>
      {toast}
    </div>
  );
}
