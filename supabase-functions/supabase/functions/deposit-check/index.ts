import { verifyTelegramInitData } from '../_shared/telegram.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';

// POST { initData: string, requestId: string }
// Проверяет заявку на пополнение: если ещё не подтверждена — спрашивает
// блокчейн (TronGrid для TRC20, Etherscan multichain API для ERC20/
// BEP20), не пришёл ли перевод USDT на наш кошелёк с точно такой
// уникальной суммой. Нашли — атомарно зачисляем баланс.
// Возвращает { status: 'pending' | 'confirmed' | 'expired', amount? }.

const USDT_CONTRACT_TRC20 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const USDT_CONTRACT_ERC20 = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDT_CONTRACT_BEP20 = '0x55d398326f99059fF775485246999027B3197955';
const AMOUNT_EPSILON = 0.0000005; // защита от погрешности плавающей точки

interface DepositRequest {
  wallet_address: string;
  network: string;
  unique_amount: string | number;
  created_at: string;
}

// TronGrid — свои поля (block_timestamp в мс, decimals внутри token_info).
async function findTronMatch(req: DepositRequest, target: number, sinceMs: number): Promise<string | null> {
  const tronApiKey = Deno.env.get('TRONGRID_API_KEY')!;
  const url =
    `https://api.trongrid.io/v1/accounts/${req.wallet_address}/transactions/trc20` +
    `?contract_address=${USDT_CONTRACT_TRC20}&limit=30&order_by=block_timestamp,desc`;
  const resp = await fetch(url, { headers: { 'TRON-PRO-API-KEY': tronApiKey } });
  const json = await resp.json();
  const transfers: Array<Record<string, unknown>> = json.data ?? [];

  const match = transfers.find((tx) => {
    if (tx.to !== req.wallet_address) return false;
    if (Number(tx.block_timestamp) < sinceMs) return false;
    const decimals = Number((tx.token_info as Record<string, unknown> | undefined)?.decimals ?? 6);
    const amount = Number(tx.value) / 10 ** decimals;
    return Math.abs(amount - target) < AMOUNT_EPSILON;
  });
  return match ? String(match.transaction_id) : null;
}

// Etherscan multichain API (Bot API V2) — один и тот же формат и для
// Ethereum (chainid=1), и для BSC (chainid=56), просто разный
// контракт USDT и chainid. timeStamp у них в секундах (не мс).
async function findEvmMatch(req: DepositRequest, target: number, sinceMs: number): Promise<string | null> {
  const apiKey = Deno.env.get('ETHERSCAN_API_KEY')!;
  const chainId = req.network === 'BEP20' ? 56 : 1;
  const contract = req.network === 'BEP20' ? USDT_CONTRACT_BEP20 : USDT_CONTRACT_ERC20;
  const url =
    `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokentx` +
    `&contractaddress=${contract}&address=${req.wallet_address}&sort=desc&apikey=${apiKey}`;
  const resp = await fetch(url);
  const json = await resp.json();
  const transfers: Array<Record<string, unknown>> = Array.isArray(json.result) ? json.result : [];

  const match = transfers.find((tx) => {
    if (String(tx.to).toLowerCase() !== req.wallet_address.toLowerCase()) return false;
    if (Number(tx.timeStamp) * 1000 < sinceMs) return false;
    const decimals = Number(tx.tokenDecimal ?? 6);
    const amount = Number(tx.value) / 10 ** decimals;
    return Math.abs(amount - target) < AMOUNT_EPSILON;
  });
  return match ? String(match.hash) : null;
}

async function findMatch(req: DepositRequest, target: number, sinceMs: number): Promise<string | null> {
  if (req.network === 'ERC20' || req.network === 'BEP20') return findEvmMatch(req, target, sinceMs);
  return findTronMatch(req, target, sinceMs);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { initData, requestId } = await req.json();
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

    const result = await verifyTelegramInitData(initData, botToken);
    if (!result.ok) return withCors({ error: result.error }, 401);

    const supabase = supabaseAdmin();
    const { data: depositReq, error: reqError } = await supabase
      .from('deposit_requests')
      .select('*')
      .eq('id', requestId)
      .eq('user_id', result.user.id)
      .single();

    if (reqError || !depositReq) return withCors({ error: 'Заявка не найдена' }, 404);

    if (depositReq.status === 'confirmed') {
      return withCors({ status: 'confirmed', amount: Number(depositReq.unique_amount) });
    }

    if (new Date(depositReq.expires_at).getTime() < Date.now()) {
      if (depositReq.status === 'pending') {
        await supabase.from('deposit_requests').update({ status: 'expired' }).eq('id', requestId);
      }
      return withCors({ status: 'expired' });
    }

    const target = Number(depositReq.unique_amount);
    const requestCreatedMs = new Date(depositReq.created_at).getTime();
    const txHash = await findMatch(depositReq, target, requestCreatedMs);

    if (!txHash) return withCors({ status: 'pending' });

    const { data: confirmData, error: confirmError } = await supabase.rpc('confirm_deposit', {
      p_request_id: requestId,
      p_tx_hash: txHash,
    });
    if (confirmError) return withCors({ error: confirmError.message }, 500);
    return withCors(confirmData);
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
