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
};

const formatINR = (value: number): string => {
  return `₹ ${value.toLocaleString('en-IN')}`;
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

const LatestTransactions = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await getLatestTransactions(5);
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

  return (
    <Fragment>
      <div className={`card transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
        <div className="card-header">
          <h3 className="card-title">Latest Transactions</h3>
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
                {transactions.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500 py-6">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn, index) => (
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
