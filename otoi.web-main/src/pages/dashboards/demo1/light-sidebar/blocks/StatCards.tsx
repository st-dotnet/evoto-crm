import { Fragment, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  navigateTo?: string;
}

const formatINR = (value: number): string => {
  return `₹ ${value.toLocaleString('en-IN')}`;
};

/* ── Skeleton placeholder ── */
const StatCardSkeleton = () => (
  <div className="card border-l-4 border-l-gray-200 bg-gray-50 p-5 flex flex-col gap-2 animate-pulse">
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4 bg-gray-200 rounded" />
        <div className="w-24 h-3 bg-gray-200 rounded" />
      </div>
    </div>
    <div className="w-32 h-7 bg-gray-200 rounded" />
    <div className="flex justify-between mt-1">
      <div className="w-28 h-3 bg-gray-200 rounded" />
      <div className="w-20 h-3 bg-gray-200 rounded" />
    </div>
  </div>
);

const StatCards = () => {
  const navigate = useNavigate();
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

  if (loading) {
    return (
      <Fragment>
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </Fragment>
    );
  }

  const cards: IStatCard[] = [
    {
      label: 'To Collect (Net)',
      amount: summary ? formatINR(summary.to_collect) : '—',
      icon: 'ki-filled ki-entrance-left',
      borderColor: 'border-l-green-500',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-500',
      labelColor: 'text-green-600',
      navigateTo: '/invoices/list',
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
      navigateTo: '/purchases/purchase-invoices',
      subText: summary ? (
        <div className="flex justify-between text-[11px] text-gray-500 mt-0.5">
          <span>Purchases: {formatINR(summary.total_payables_gross)}</span>
          {summary.credit_notes_refund > 0 && <span>+ Refund: {formatINR(summary.credit_notes_refund)}</span>}
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
      navigateTo: '/payment-in',
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
          onClick={() => card.navigateTo && navigate(card.navigateTo)}
          className={`card border-l-4 ${card.borderColor} ${card.bgColor} p-5 flex flex-col gap-1 cursor-pointer
                      hover:shadow-md hover:scale-[1.02] transition-all duration-200`}
        >
          <div className="flex items-center justify-between mb-1">
            <div
              className={`flex items-center gap-1.5 text-xs font-medium ${card.labelColor}`}
            >
              <i className={`${card.icon} text-sm`}></i>
              <span>{card.label}</span>
            </div>
            <i className="ki-filled ki-arrow-right text-xs text-gray-400 group-hover:text-gray-600 transition-colors"></i>
          </div>
          <span className="text-2xl font-bold text-gray-900 leading-none">{card.amount}</span>
          {card.subText && <div>{card.subText}</div>}
        </div>
      ))}
    </Fragment>
  );
};

export { StatCards };
