import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';
import { optimizeImageBacklog } from '../_shared/optimizeBacklog.ts';

// Автономная версия 'optimize-images' — вызывается НЕ админом из
// браузера, а самим Postgres по расписанию (pg_cron + pg_net, см.
// миграцию *_autonomous_image_optimization.sql). Раньше пересжатие
// старых тяжёлых картинок срабатывало, только если админ вручную открыл
// раздел "Товары" — то есть не было по-настоящему автономным, что бы ни
// говорил комментарий в коде. Теперь это происходит само, без участия
// человека, максимум раз в CRON-интервал (см. миграцию) после того, как
// где-то появилась новая тяжёлая картинка.
//
// Защищено отдельным секретом (НЕ паролем от админки) — задаётся один
// раз через `supabase secrets set CRON_SECRET=...` и сравнивается с
// заголовком X-Cron-Secret, который присылает pg_cron. Без совпадения
// секрета — 401, никакой посторонний вызов извне ничего не запустит.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const expected = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('x-cron-secret');
  if (!expected || !provided || provided !== expected) {
    return withCors({ error: 'Не авторизовано' }, 401);
  }

  try {
    const supabase = supabaseAdmin();
    const stats = await optimizeImageBacklog(supabase);
    return withCors(stats);
  } catch (err) {
    return withCors({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
