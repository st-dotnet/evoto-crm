import { Fragment, useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getLatestTransactions, type Transaction } from '@/services/dashboard.service';

const TYPE_BADGE_MAP: Record<string, string> = {
  'Sales Invoices': 'badge-success',
  'Payment In': 'badge-success',
  'Add Money': 'badge-info',
  'Purchase Invoices': 'badge-warning',
  'Purchase Orders': 'badge-primary',
  'Payment Out': 'badge-danger',
  'Quotation / Estimate': 'badge-info',
  'Credit Note': 'badge-danger',
  'Debit Note': 'badge-success',
};

type FilterTab = 'All' | 'Sales' | 'Purchases' | 'Payments';

const TAB_TYPES: Record<FilterTab, string[]> = {
  All: [],
  Sales: ['Sales Invoices', 'Quotation / Estimate', 'Credit Note'],
  Purchases: ['Purchase Invoices', 'Purchase Orders', 'Debit Note'],
  Payments: ['Payment In', 'Payment Out'],
};

const formatINR = (value: number): string => {
  return `₹ ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/* ── Skeleton row ── */
const SkeletonRow = () => (
  <tr className="animate-pulse">
    <td><div className="w-20 h-4 bg-gray-200 rounded" /></td>
    <td><div className="w-24 h-5 bg-gray-200 rounded-full" /></td>
    <td><div className="w-16 h-4 bg-gray-200 rounded" /></td>
    <td><div className="w-28 h-4 bg-gray-200 rounded" /></td>
    <td className="text-end"><div className="w-20 h-4 bg-gray-200 rounded ml-auto" /></td>
  </tr>
);

const LatestTransactions = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('All');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await getLatestTransactions(10);
    if (res.success && res.data) {
      setTransactions(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const handler = () => fetchData();
    window.addEventListener('dashboard-refresh', handler);
    return () => window.removeEventListener('dashboard-refresh', handler);
  }, [fetchData]);

  const filteredTxns =
    activeTab === 'All'
      ? transactions
      : transactions.filter((t) => TAB_TYPES[activeTab].includes(t.type));

  const displayedTxns = filteredTxns.slice(0, 5);

  const tabs: FilterTab[] = ['All', 'Sales', 'Purchases', 'Payments'];

  return (
    <Fragment>
      <div className="card">
        <div className="card-header flex-col items-start gap-0 pb-0">
          <h3 className="card-title mb-3">Latest Transactions</h3>

          {/* Filter tabs */}
          <div className="flex gap-0 border-b border-gray-200 w-full -mb-px">
            {tabs.map((tab) => {
              const count =
                tab === 'All'
                  ? transactions.length
                  : transactions.filter((t) => TAB_TYPES[tab].includes(t.type)).length;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {tab}
                  {!loading && (
                    <span
                      className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab
                        ? 'bg-primary/10 text-primary'
                        : 'bg-gray-100 text-gray-400'
                        }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card-body p-0">
          <div className="scrollable-x-auto">
            <table className="table table-auto table-border">
              <thead>
                <tr>
                  <th className="min-w-[130px]">
                    <span className="text-gray-700 font-normal">Date</span>
                  </th>
                  <th className="min-w-[160px]">
                    <span className="text-gray-700 font-normal">Type</span>
                  </th>
                  <th className="min-w-[100px]">
                    <span className="text-gray-700 font-normal">Txn No</span>
                  </th>
                  <th className="min-w-[170px]">
                    <span className="text-gray-700 font-normal">Party Name</span>
                  </th>
                  <th className="min-w-[120px] text-end">
                    <span className="text-gray-700 font-normal">Amount</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                ) : displayedTxns.length === 0 ? null : (
                  displayedTxns.map((txn, index) => (
                    <tr
                      key={index}
                      onClick={() => txn.route_path && navigate(txn.route_path)}
                      className={txn.route_path ? "cursor-pointer hover:bg-gray-50 transition-colors" : ""}
                    >
                      <td>
                        <span className="text-sm text-gray-800">
                          {formatDate(txn.date)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm ${TYPE_BADGE_MAP[txn.type] || 'badge-light'} badge-outline`}
                        >
                          {txn.type}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-gray-800">{txn.txn_no}</span>
                      </td>
                      <td>
                        <span className="text-sm text-gray-900 font-medium">
                          {txn.party_name}
                        </span>
                      </td>
                      <td className="text-end">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatINR(txn.amount)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-footer justify-center">
          <Link
            to="/transactions"
            className="btn btn-link text-primary hover:text-primary-active text-sm font-medium"
          >
            See All Transactions
          </Link>
        </div>
      </div>
    </Fragment>
  );
};

export { LatestTransactions };
