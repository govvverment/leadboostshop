import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import { depositPresets, depositCurrency } from '../../mock/data';

// BEP20 временно скрыт: бэкенд для него уже готов (deposit-create/
// deposit-check полностью поддерживают эту сеть), но Etherscan для
// BSC (chainid=56) требует платный план — на бесплатном ключе запрос
// всегда возвращает "Free API access is not supported for this chain".
// Как только план оплачен — просто вернуть 'BEP20' в этот список,
// больше никаких правок не нужно.
const NETWORKS = ['TRC20', 'ERC20'];

export default function BalanceDeposit() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [network, setNetwork] = useState(NETWORKS[0]);

  const numeric = Number(amount) || 0;

  return (
    <Screen title="Пополнение баланса">
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Пополнение баланса</h1>
      </div>

      <h3 className="section__title">Сумма пополнения</h3>
      <div className="amount-input">
        <span className="amount-input__prefix">$</span>
        <input
          type="number"
          placeholder="Введите сумму"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="preset-row">
        {depositPresets.map((p) => (
          <button
            key={p}
            className={'preset-chip' + (Number(amount) === p ? ' is-active' : '')}
            onClick={() => setAmount(String(p))}
          >
            ${p}
          </button>
        ))}
      </div>

      <h3 className="section__title">Способ оплаты</h3>
      <div className="currency-row currency-row--active">
        <svg className="currency-row__icon" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#26A17B" />
          <path
            fill="#fff"
            d="M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.775 1.657m0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117"
          />
        </svg>
        <div className="currency-row__body">
          <span className="currency-row__title">{depositCurrency.title}</span>
          <span className="currency-row__subtitle">{depositCurrency.subtitle}</span>
        </div>
        <span className="currency-row__check">✓</span>
      </div>

      <h3 className="section__title">Сеть</h3>
      <div className="network-row">
        {NETWORKS.map((n) => (
          <button
            key={n}
            className={'network-chip' + (network === n ? ' is-active' : '')}
            onClick={() => setNetwork(n)}
          >
            {n}
          </button>
        ))}
      </div>

      <button
        className="btn btn--primary btn--block btn--sticky"
        disabled={!numeric || numeric <= 0}
        onClick={() => navigate('/balance/deposit/payment', { state: { amount: numeric, network } })}
      >
        Продолжить
      </button>
    </Screen>
  );
}
