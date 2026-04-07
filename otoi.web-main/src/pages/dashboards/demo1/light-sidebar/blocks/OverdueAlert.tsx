import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getOverdueInvoices, type OverdueSummary } from '@/services/dashboard.service';

const formatINR = (value: number): string => {
  return `₹ ${value.toLocaleString('en-IN')}`;
};

const OverdueAlert = () => {
  const [overdue, setOverdue] = useState<OverdueSummary | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await getOverdueInvoices();
    if (res.success && res.data) {
      setOverdue(res.data);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const handler = () => fetchData();
    window.addEventListener('dashboard-refresh', handler);
    return () => window.removeEventListener('dashboard-refresh', handler);
  }, [fetchData]);

  if (!overdue || overdue.total_count === 0 || dismissed) return null;

  return (
    <div className="relative overflow-hidden rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4">
      {/* Decorative accent */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-100">
            <i className="ki-filled ki-notification-bing text-amber-600 text-lg"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {overdue.total_count} overdue invoice{overdue.total_count > 1 ? 's' : ''}
              <span className="font-bold text-red-600 ml-1.5">
                ({formatINR(overdue.total_amount)})
              </span>
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {overdue.oldest_days > 0 && `Oldest: ${overdue.oldest_days} days overdue`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/invoices/list"
            className="btn btn-sm bg-amber-500 hover:bg-amber-600 text-white border-amber-500 text-xs"
          >
            View Overdue
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="btn btn-icon btn-xs btn-light btn-clear text-amber-600 hover:text-amber-800"
          >
            <i className="ki-filled ki-cross text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export { OverdueAlert };
