import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY подставляются Supabase
// автоматически в каждую Edge Function — их не нужно задавать вручную
// через `supabase secrets set`. А вот TELEGRAM_BOT_TOKEN — нужно.
export function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}
