import axios from 'axios';

const API_URL = import.meta.env.VITE_APP_API_URL;

const getAuthToken = (): string | null => {
  try {
    const authData = localStorage.getItem('OTOI-auth-v1.0.0.1');
    if (!authData) return null;
    const parsedAuth = JSON.parse(authData);
    return parsedAuth.token || parsedAuth.access_token || parsedAuth.accessToken || null;
  } catch {
    return null;
  }
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  to_collect: number;
  to_pay: number;
  cash_in_hand: number;
  bank_balance: number;
  cash_bank_balance: number;
  total_receivables_gross: number;
  total_credit_notes: number;
  total_payables_gross: number;
  total_debit_notes: number;
  credit_notes_refund: number;
}

export interface Transaction {
  id?: string;
  route_path?: string;
  date: string | null;
  type: string;
  txn_no: string;
  party_name: string;
  amount: number;
  created_at: string | null;
}

export interface SalesDataPoint {
  label: string;
  date?: string;
  value: number;
  count: number;
}

export interface SalesReport {
  period: string;
  start_date: string;
  end_date: string;
  data_points: SalesDataPoint[];
  total_sales: number;
  invoices_made: number;
}

export interface OverdueSummary {
  total_count: number;
  total_amount: number;
  oldest_days: number;
}

export interface TopParty {
  name: string;
  amount: number;
  count: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── API calls ──────────────────────────────────────────────────────────────

const authHeaders = () => {
  const token = getAuthToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    withCredentials: false as const,
  };
};

export const getDashboardSummary = async (): Promise<ApiResponse<DashboardSummary>> => {
  try {
    const response = await axios.get(`${API_URL}/dashboard/summary`, authHeaders());
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error('Failed to fetch dashboard summary:', error);
    return { success: false, error: error.response?.data?.error || 'Failed to fetch summary' };
  }
};

export const getLatestTransactions = async (limit = 5): Promise<ApiResponse<Transaction[]>> => {
  try {
    const response = await axios.get(
      `${API_URL}/dashboard/latest-transactions?limit=${limit}`,
      authHeaders()
    );
    return { success: true, data: response.data.transactions };
  } catch (error: any) {
    console.error('Failed to fetch latest transactions:', error);
    return { success: false, error: error.response?.data?.error || 'Failed to fetch transactions' };
  }
};

export const getSalesReport = async (
  period: 'daily' | 'weekly' | 'monthly' = 'daily',
  days = 7
): Promise<ApiResponse<SalesReport>> => {
  try {
    const response = await axios.get(
      `${API_URL}/dashboard/sales-report?period=${period}&days=${days}`,
      authHeaders()
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error('Failed to fetch sales report:', error);
    return { success: false, error: error.response?.data?.error || 'Failed to fetch sales report' };
  }
};

export const getOverdueInvoices = async (): Promise<ApiResponse<OverdueSummary>> => {
  try {
    const response = await axios.get(
      `${API_URL}/dashboard/overdue-summary`,
      authHeaders()
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error('Failed to fetch overdue summary:', error);
    return { success: false, error: error.response?.data?.error || 'Failed to fetch overdue summary' };
  }
};

export const getTopParties = async (
  type: 'receivable' | 'payable' = 'receivable',
  limit = 5
): Promise<ApiResponse<TopParty[]>> => {
  try {
    const response = await axios.get(
      `${API_URL}/dashboard/top-parties?type=${type}&limit=${limit}`,
      authHeaders()
    );
    return { success: true, data: response.data.parties };
  } catch (error: any) {
    console.error('Failed to fetch top parties:', error);
    return { success: false, error: error.response?.data?.error || 'Failed to fetch top parties' };
  }
};
