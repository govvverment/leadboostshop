import { useAdminAuth } from '../AdminAuthContext';
import AdminLogin from '../screens/AdminLogin';

export default function AdminGuard({ children }) {
  const { isAuthed } = useAdminAuth();
  if (!isAuthed) return <AdminLogin />;
  return children;
}
