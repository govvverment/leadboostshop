import { supabaseAdmin } from './supabaseAdmin.ts';

export async function requireAdminSession(
  req: Request
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return { ok: false, status: 401, error: 'Не авторизовано' };

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('admin_sessions').select('*').eq('token', token).maybeSingle();

  if (error || !data) return { ok: false, status: 401, error: 'Сессия недействительна' };

  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('admin_sessions').delete().eq('token', token);
    return { ok: false, status: 401, error: 'Сессия истекла, войдите заново' };
  }

  return { ok: true };
}
