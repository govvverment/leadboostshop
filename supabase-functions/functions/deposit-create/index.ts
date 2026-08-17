import { verifyTelegramInitData } from '../_shared/telegram.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';

// POST { initData: string, amount: number, network?: 'TRC20'|'ERC20'|'BEP20' }
// Создаёт заявку на пополнение с уникальной суммой (для опознавания
// платежа — ни у одной из трёх сетей нет memo-поля, где можно было бы
// просто передать ID пользователя). Возвращает { requestId,
// uniqueAmount, walletAddress, network, expiresAt }.

const NETWORKS = new Set(['TRC20', 'ERC20', 'BEP20']);

// ERC20 и BEP20 — обе EVM-совместимые сети, у обеих один и тот же
// формат адреса (0x...) и обычно один физический кошелёк подходит
// для обеих (MetaMask и т.п. не разделяют адрес по сетям).
function walletAddressFor(network: string): string {
  if (network === 'TRC20') return Deno.env.get('TRON_WALLET_ADDRESS')!;
  return Deno.env.get('EVM_WALLET_ADDRESS')!;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { initData, amount, network: rawNetwork } = await req.json();
    const network = NETWORKS.has(rawNetwork) ? rawNetwork : 'TRC20';
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

    const result = await verifyTelegramInitData(initData, botToken);
    if (!result.ok) return withCors({ error: result.error }, 401);

    const walletAddress = walletAddressFor(network);
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc('create_deposit_request', {
      p_telegram_id: result.user.id,
      p_amount: amount,
      p_wallet_address: walletAddress,
      p_network: network,
    });

    if (error) return withCors({ error: error.message }, 500);
    if (data.error) return withCors({ error: data.error }, 400);
    return withCors(data);
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
