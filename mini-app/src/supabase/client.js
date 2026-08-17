import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// Может быть пустым, если Supabase ещё не настроен (например, при
// локальной разработке без .env) — тогда приложение просто останется
// на моковых данных, см. AppContext.
export const supabase =
  config.supabaseUrl && config.supabaseAnonKey
    ? createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;
