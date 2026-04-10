import { useState, useEffect, useCallback } from 'react';
import { getTopParties, type TopParty } from '@/services/dashboard.service';

const formatINR = (value: number): string => {
  return `₹ ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const TopParties = () => {
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable');
  const [parties, setParties] = useState<TopParty[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await getTopParties(activeTab, 5);
    if (res.success && res.data) {
      setParties(res.data);
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    fetchData();

    const handler = () => fetchData();
    window.addEventListener('dashboard-refresh', handler);
    return () => window.removeEventListener('dashboard-refresh', handler);
  }, [fetchData]);

  const maxAmount = parties.length > 0 ? Math.max(...parties.map((p) => p.amount)) : 1;

  return (
    <div className={`card h-full transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
      <div className="card-header">
        <h3 className="card-title">Top Parties</h3>
      </div>

      {/* Tabs */}
      <div className="px-5 pt-1">
        <div className="flex gap-0 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('receivable')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'receivable'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            To Collect
          </button>
          <button
            onClick={() => setActiveTab('payable')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'payable'
                ? 'border-red-400 text-red-500'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            To Pay
          </button>
        </div>
      </div>

      <div className="card-body flex flex-col gap-3.5 p-5">
        {parties.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <i className="ki-filled ki-users text-2xl text-gray-300"></i>
            <span className="text-xs text-gray-400">
              No outstanding {activeTab === 'receivable' ? 'receivables' : 'payables'}
            </span>
          </div>
        ) : (
          parties.map((party, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${activeTab === 'receivable' ? 'bg-green-400' : 'bg-red-400'
                      }`}
                  >
                    {party.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-800 truncate max-w-[120px]">
                    {party.name}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatINR(party.amount)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${activeTab === 'receivable' ? 'bg-green-400' : 'bg-red-400'
                    }`}
                  style={{ width: `${(party.amount / maxAmount) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export { TopParties };
