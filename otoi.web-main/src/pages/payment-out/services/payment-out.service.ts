import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_URL;

const getAuthToken = (): string | null => {
  try {
    const authData = localStorage.getItem("OTOI-auth-v1.0.0.1");
    if (!authData) return null;
    const parsedAuth = JSON.parse(authData);
    return (
      parsedAuth.token ||
      parsedAuth.access_token ||
      parsedAuth.accessToken ||
      null
    );
  } catch {
    return null;
  }
};

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  status?: number;
}

// ── List ──────────────────────────────────────────────────────────────────────

export const getPaymentOutList = async (
  page = 1,
  per_page = 10,
  payment_status = "",
  party_name = "",
  payment_number = "",
  date_filter = "",
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return { success: false, error: "Authentication required.", status: 401 };

  try {
    let url = `${API_URL}/payment-out?page=${page}&per_page=${per_page}`;
    if (payment_status && payment_status !== "all")
      url += `&payment_status=${payment_status}`;
    if (party_name) url += `&party_name=${encodeURIComponent(party_name)}`;
    if (payment_number)
      url += `&payment_number=${encodeURIComponent(payment_number)}`;
    if (date_filter && date_filter !== "all")
      url += `&date_filter=${encodeURIComponent(date_filter)}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      withCredentials: false,
    });

    const raw = response.data;
    const items = raw.data ?? (Array.isArray(raw) ? raw : []);
    const pagination = raw.pagination ?? {
      total: items.length,
      current_page: page,
      last_page: 1,
      per_page,
    };

    return {
      success: true,
      data: { data: items, pagination },
      status: response.status,
    };
  } catch (err: any) {
    const status = err.response?.status ?? 500;
    return {
      success: false,
      error:
        status === 401
          ? "Session expired. Please log in again."
          : "Failed to fetch payment-out records",
      status,
    };
  }
};

// ── Record Payment ────────────────────────────────────────────────────────────

export const recordPaymentOut = async (
  invoiceId: string,
  amountPaid: number,
  paymentMode: string,
  notes = "",
  discount = 0,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return { success: false, error: "Authentication required.", status: 401 };

  try {
    const response = await axios.post(
      `${API_URL}/payment-out/record-payment/${invoiceId}`,
      { amount_paid: amountPaid, payment_mode: paymentMode, notes, discount },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        withCredentials: false,
      },
    );
    return { success: true, data: response.data, status: response.status };
  } catch (err: any) {
    const msg = err.response?.data?.error ?? "Failed to record payment";
    return {
      success: false,
      error: msg,
      data: err.response?.data,
      status: err.response?.status ?? 500,
    };
  }
};

// ── Vendor Invoices ───────────────────────────────────────────────────────────

export const getVendorInvoices = async (
  vendorName: string,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return { success: false, error: "Authentication required.", status: 401 };

  try {
    const url = vendorName
      ? `${API_URL}/payment-out/vendor-invoices?vendor_name=${encodeURIComponent(vendorName)}&per_page=1000`
      : `${API_URL}/payment-out/vendor-invoices?per_page=1000`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      withCredentials: false,
    });

    // Filter to only invoices that have pending balance
    const invoices = (Array.isArray(response.data) ? response.data : []).filter(
      (inv: any) =>
        inv.status === "partial" ||
        (inv.balance_amount > 0 && inv.amount_paid >= 0),
    );

    return { success: true, data: invoices, status: response.status };
  } catch (err: any) {
    return {
      success: false,
      error: "Failed to fetch vendor invoices",
      status: err.response?.status ?? 500,
    };
  }
};

// ── Party/Vendor Names Dropdown ───────────────────────────────────────────────

export const getVendorNamesDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return { success: false, error: "Authentication required.", status: 401 };

  try {
    const url = `${API_URL}/payment-out?party_names_dropdown=true`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    // Return the data directly without additional processing
    return { success: true, data: response.data, status: response.status };
  } catch (err: any) {
    return {
      success: false,
      error: err.response?.data?.error || "Failed to fetch vendor names",
      status: err.response?.status ?? 500,
    };
  }
};

// ── Payment Numbers Dropdown ──────────────────────────────────────────────────

export const getPaymentOutNumbersDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return { success: false, error: "Authentication required.", status: 401 };

  try {
    const response = await axios.get(
      `${API_URL}/payment-out?payment_numbers_dropdown=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = Array.isArray(response.data) ? response.data : [];
    return { success: true, data, status: response.status };
  } catch (err: any) {
    return {
      success: false,
      error: "Failed to fetch payment numbers",
      status: err.response?.status ?? 500,
    };
  }
};

// ── Delete ────────────────────────────────────────────────────────────────────

export const deletePaymentOut = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return { success: false, error: "Authentication required.", status: 401 };

  try {
    const response = await axios.delete(`${API_URL}/payment-out/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { success: true, data: response.data, status: response.status };
  } catch (err: any) {
    return {
      success: false,
      error: err.response?.data?.error ?? "Failed to delete payment",
      status: err.response?.status ?? 500,
    };
  }
};

export const updatePaymentOut = async (
  id: string,
  data: any,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return { success: false, error: "Authentication required.", status: 401 };

  try {
    const response = await axios.put(`${API_URL}/payment-out/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    return { success: true, data: response.data, status: response.status };
  } catch (err: any) {
    return {
      success: false,
      error: err.response?.data?.error ?? "Failed to update payment",
      status: err.response?.status ?? 500,
    };
  }
};

// ── Get by ID ─────────────────────────────────────────────────────────────────

export const getPaymentOutById = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return { success: false, error: "Authentication required.", status: 401 };

  try {
    const response = await axios.get(`${API_URL}/payment-out/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { success: true, data: response.data, status: response.status };
  } catch (err: any) {
    return {
      success: false,
      error: "Failed to fetch payment details",
      status: err.response?.status ?? 500,
    };
  }
};
