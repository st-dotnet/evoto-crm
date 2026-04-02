import { Fragment, useState, useEffect, useCallback } from 'react';
import { getDashboardSummary, type DashboardSummary } from '@/services/dashboard.service';

interface IStatCard {
  label: string;
  amount: string;
  icon: string;
  borderColor: string;
  bgColor: string;
  iconColor: string;
  labelColor: string;
  subText?: React.ReactNode;
}

const formatINR = (value: number): string => {
  return `₹ ${value.toLocaleString('en-IN')}`;
};

const StatCards = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await getDashboardSummary();
    if (res.success && res.data) {
      setSummary(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const handler = () => fetchData();
    window.addEventListener('dashboard-refresh', handler);
    return () => window.removeEventListener('dashboard-refresh', handler);
  }, [fetchData]);

  const cards: IStatCard[] = [
    {
      label: 'To Collect (Net)',
      amount: summary ? formatINR(summary.to_collect) : '—',
      icon: 'ki-filled ki-entrance-left',
      borderColor: 'border-l-green-500',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-500',
      labelColor: 'text-green-600',
      subText: summary ? (
        <div className="flex justify-between text-[11px] text-gray-500 mt-0.5">
          <span>Invoices: {formatINR(summary.total_receivables_gross)}</span>
          {summary.total_credit_notes > 0 && <span>- CN: {formatINR(summary.total_credit_notes)}</span>}
        </div>
      ) : null
    },
    {
      label: 'To Pay (Net)',
      amount: summary ? formatINR(summary.to_pay) : '—',
      icon: 'ki-filled ki-exit-right',
      borderColor: 'border-l-red-400',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-400',
      labelColor: 'text-red-500',
      subText: summary ? (
        <div className="flex justify-between text-[11px] text-gray-500 mt-0.5">
          <span>Purchases: {formatINR(summary.total_payables_gross)}</span>
          {summary.total_debit_notes > 0 && <span>- DN: {formatINR(summary.total_debit_notes)}</span>}
        </div>
      ) : null
    },
    {
      label: 'Total Cash + Bank Balance',
      amount: summary ? formatINR(summary.cash_bank_balance) : '—',
      icon: 'ki-filled ki-bank',
      borderColor: 'border-l-violet-500',
      bgColor: 'bg-violet-50',
      iconColor: 'text-violet-500',
      labelColor: 'text-violet-600',
      subText: summary ? (
        <div className="flex justify-between gap-4 text-[11px] text-gray-500 mt-0.5">
          <span>Cash: {formatINR(summary.cash_in_hand)}</span>
          <span>Bank: {formatINR(summary.bank_balance)}</span>
        </div>
      ) : null
    },
  ];

  return (
    <Fragment>
      {cards.map((card, index) => (
        <div
          key={index}
          className={`card border-l-4 ${card.borderColor} ${card.bgColor} p-5 flex flex-col gap-1 transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}
        >
          <div className="flex items-center justify-between mb-1">
            <div
              className={`flex items-center gap-1.5 text-xs font-medium ${card.labelColor}`}
            >
              <i className={`${card.icon} text-sm`}></i>
              <span>{card.label}</span>
            </div>
            <button className="btn btn-icon btn-xs btn-light btn-clear opacity-50 hover:opacity-100">
              <i className="ki-filled ki-eye text-sm"></i>
            </button>
          </div>
          <span className="text-2xl font-bold text-gray-900 leading-none">{card.amount}</span>
          {card.subText && <div>{card.subText}</div>}
        </div>
      ))}
    </Fragment>
  );
};

export { StatCards };
