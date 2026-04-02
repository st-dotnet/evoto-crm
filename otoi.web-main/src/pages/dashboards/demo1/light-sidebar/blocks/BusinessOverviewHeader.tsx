import { useState, useEffect, useCallback } from 'react';
import { getDashboardSummary, type DashboardSummary } from '@/services/dashboard.service';

const BusinessOverviewHeader = () => {
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const formatTimestamp = () => {
    const now = new Date();
    return (
      now.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }) +
      ' | ' +
      now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    );
  };

  useEffect(() => {
    setLastUpdate(formatTimestamp());
  }, []);

  const handleRefresh = () => {
    setLastUpdate(formatTimestamp());
    // Dispatch a custom event so all dashboard cards can re-fetch
    window.dispatchEvent(new CustomEvent('dashboard-refresh'));
  };

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold text-gray-900">Business Overview</h1>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Last Update: {lastUpdate}</span>
        <button
          className="btn btn-icon btn-xs btn-light btn-clear"
          title="Refresh"
          onClick={handleRefresh}
        >
          <i className="ki-filled ki-arrows-circle text-base"></i>
        </button>
      </div>
    </div>
  );
};

export { BusinessOverviewHeader };
