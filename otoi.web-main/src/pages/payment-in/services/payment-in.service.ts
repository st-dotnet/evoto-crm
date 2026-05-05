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
  } catch (error) {
    return null;
  }
};

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  status?: number;
}

interface PaymentInData {
  payment_number: string;
  date: string;
  party_name: string;
  total_amount_settled: number;
  amount_received: number;
  payment_mode: string;
  invoice_id?: string;
  invoice_number?: string;
}

// Helper to extract data array and pagination from various API response formats
const extractData = (response: any) => {
  const data = response.data;
  if (!data) return { items: [], pagination: {} };

  if (Array.isArray(data)) {
    return { items: data, pagination: {} };
  }

  // Handle nested structures: { data: [...] }, { invoices: [...] }, { payments: [...] }
  const items = data.data || data.invoices || data.payments || [];
  const pagination = data.pagination || {};

  return {
    items: Array.isArray(items) ? items : [],
    pagination
  };
};

export const createPaymentIn = async (
  paymentData: PaymentInData,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    const response = await axios.post(`${API_URL}/payment-in`, paymentData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      withCredentials: false,
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = "Failed to create payment record";
    if (error.response?.status === 400) {
      errorMessage = error.response.data?.error || "Invalid payment data";
    } else if (error.response?.status === 401) {
      errorMessage = "Session expired. Please log in again.";
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

// Cache for endpoint availability to avoid repeated 404s in the console
let isPaymentInAvailable = true;

export const getPaymentInList = async (
  page = 1,
  per_page = 5,
  payment_status = "",
  party_name = "",
  payment_number = "",
  date_filter = "",
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    let response;
    let isPaymentInEndpoint = isPaymentInAvailable;

    // Try /payment-in endpoint if it's believed to be available
    if (isPaymentInAvailable) {
      try {
        let apiUrl = `${API_URL}/payment-in?page=${page}&per_page=${per_page}`;

        if (payment_status && payment_status !== 'all') {
          const backendStatus = payment_status === 'partially paid' ? 'partial' : payment_status;
          apiUrl += `&payment_status=${backendStatus}`;
        }

        if (party_name) {
          apiUrl += `&party_name=${encodeURIComponent(party_name)}`;
        }

        if (payment_number) {
          apiUrl += `&payment_number=${encodeURIComponent(payment_number)}`;
        }

        if (date_filter) {
          apiUrl += `&date_filter=${encodeURIComponent(date_filter)}`;
        }

        response = await axios.get(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          withCredentials: false,
        });
      } catch (paymentInError: any) {
        const errorStatus = paymentInError.response?.status;
        const isNetworkError = !errorStatus && paymentInError.code === 'ERR_NETWORK';

        if (errorStatus === 404 || isNetworkError) {
          isPaymentInAvailable = false;
          isPaymentInEndpoint = false;
        } else {
          throw paymentInError;
        }
      }
    }

    // Fallback to /invoices if needed
    if (!isPaymentInEndpoint) {
      let fallbackUrl = `${API_URL}/invoices?page=${page}&per_page=${per_page}`;

      if (payment_status && payment_status !== 'all') {
        const backendStatus = payment_status === 'partially paid' ? 'partial' : payment_status;
        fallbackUrl += `&payment_status=${backendStatus}`;
      }

      if (party_name) {
        fallbackUrl += `&party_name=${encodeURIComponent(party_name)}`;
      }

      if (date_filter) {
        fallbackUrl += `&date_filter=${encodeURIComponent(date_filter)}`;
      }

      response = await axios.get(fallbackUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        withCredentials: false,
      });
    }

    if (!response) {
      throw new Error("No response received from API");
    }

    const { items, pagination } = extractData(response);
    let invoicesData = items;

    let finalData;
    if (isPaymentInEndpoint) {
      finalData = {
        data: invoicesData,
        pagination: pagination,
      };
    } else {
      // Filter for paid/partial when using fallback invoices endpoint
      if (!payment_status || payment_status === 'all') {
        invoicesData = invoicesData.filter((invoice: any) => {
          const status = invoice.payment_status?.toLowerCase();
          return status === 'paid' || status === 'partial';
        });
      }

      const transformedData = invoicesData.map((invoice: any) => {
        const invoiceId = invoice.uuid || invoice.id;
        return {
          id: invoiceId,
          payment_number: `PAY-${invoice.invoice_number || invoice.invoiceNo || "INV"}`,
          date: invoice.updated_at || invoice.invoice_date || new Date().toISOString().split("T")[0],
          party_name: invoice.customer?.name || invoice.customer_name || "Unknown Customer",
          total_amount_settled: parseFloat(invoice.total_amount) || 0,
          amount_received: parseFloat(invoice.amount_paid) || 0,
          payment_discount: parseFloat(invoice.payment_discount || invoice.discount_total) || 0,
          payment_mode: "cash",
          invoice_id: invoiceId,
          invoice_number: invoice.invoice_number || invoice.invoiceNo,
          balance_due: parseFloat(invoice.balance_due) || 0,
          payment_status: (parseFloat(invoice.balance_due) || 0) === 0 ? "paid" : (parseFloat(invoice.amount_paid) || 0) > 0 ? "partially paid" : "unpaid",
          status: (parseFloat(invoice.balance_due) || 0) === 0 ? "paid" : (parseFloat(invoice.amount_paid) || 0) > 0 ? "partially paid" : "unpaid",
        };
      });

      finalData = {
        data: transformedData,
        pagination: {
          ...pagination,
          total: (!payment_status || payment_status === 'all') ? transformedData.length : (pagination.total || transformedData.length)
        },
      };
    }

    return {
      success: true,
      data: finalData,
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.status === 401 ? "Session expired. Please log in again." : "Failed to fetch payment records",
      status: error.response?.status || 500,
    };
  }
};

export const getPaymentById = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) return { success: false, error: "Authentication required.", status: 401 };

  try {
    let response;
    let isPaymentInEndpoint = isPaymentInAvailable;

    if (isPaymentInAvailable) {
      try {
        response = await axios.get(`${API_URL}/payment-in/invoice/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err: any) {
        if (err.response?.status === 404 || !err.response) {
          isPaymentInAvailable = false;
          isPaymentInEndpoint = false;
        } else throw err;
      }
    }

    if (!isPaymentInEndpoint) {
      response = await axios.get(`${API_URL}/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (response?.data) {
      const data = response.data.data || response.data;
      return { success: true, data };
    }
    return { success: false, error: "Payment not found", status: 404 };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch payment details",
      status: error.response?.status || 500,
    };
  }
};

export const deletePaymentIn = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) return { success: false, error: "Authentication required.", status: 401 };

  try {
    let response;
    let isPaymentInEndpoint = isPaymentInAvailable;

    if (isPaymentInAvailable) {
      try {
        response = await axios.delete(`${API_URL}/payment-in/invoice/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err: any) {
        if (err.response?.status === 404 || !err.response) {
          isPaymentInAvailable = false;
          isPaymentInEndpoint = false;
        } else throw err;
      }
    }

    if (!isPaymentInEndpoint) {
      response = await axios.delete(`${API_URL}/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    return { success: true, data: response?.data, status: response?.status };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || "Failed to delete payment",
      status: error.response?.status || 500,
    };
  }
};

export const generatePaymentNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `PAY-${year}${month}-${random}`;
};

export const getPaymentNumbersDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) return { success: false, error: "Authentication required.", status: 401 };

  try {
    const response = await axios.get(`${API_URL}/invoices?per_page=1000`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const { items } = extractData(response);
    const paymentNumbers = items
      .filter((inv: any) => (inv.payment_status === 'paid' || inv.payment_status === 'partial') && (inv.invoice_number || inv.invoiceNo))
      .map((inv: any) => `PAY-${inv.invoice_number || inv.invoiceNo}`);

    return { success: true, data: paymentNumbers, status: response.status };
  } catch (error: any) {
    return { success: false, error: "Failed to fetch payment numbers", status: error.response?.status || 500 };
  }
};

export const getPartyNamesDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) return { success: false, error: "Authentication required.", status: 401 };

  try {
    const response = await axios.get(`${API_URL}/invoices?per_page=1000`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const { items } = extractData(response);
    const partyNames = [...new Set(
      items
        .filter((inv: any) => (inv.payment_status === 'paid' || inv.payment_status === 'partial') && (inv.customer_name || inv.customer?.name))
        .map((inv: any) => inv.customer_name || inv.customer?.name)
    )];

    return { success: true, data: partyNames, status: response.status };
  } catch (error: any) {
    return { success: false, error: "Failed to fetch party names", status: error.response?.status || 500 };
  }
};

export const getPartyInvoices = async (partyName: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) return { success: false, error: "Authentication required.", status: 401 };

  try {
    const response = await axios.get(`${API_URL}/invoices?party_name=${encodeURIComponent(partyName)}&per_page=1000`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const { items } = extractData(response);
    const transformed = items
      .filter((inv: any) => {
        const bal = parseFloat(inv.balance_due) || 0;
        const paid = parseFloat(inv.amount_paid) || 0;
        return (bal === 0 && paid > 0) || (bal > 0 && paid > 0);
      })
      .map((inv: any) => ({
        id: inv.uuid || inv.id,
        date: inv.invoice_date || inv.created_at || new Date().toISOString().split("T")[0],
        invoice_number: inv.invoice_number || inv.invoiceNo || "N/A",
        invoice_amount: parseFloat(inv.total_amount) || 0,
        tds: parseFloat(inv.tds) || 0,
        discount: parseFloat(inv.payment_discount || inv.discount_total || inv.discount) || 0,
        amount_received: parseFloat(inv.amount_paid) || 0,
        balance_amount: parseFloat(inv.balance_due) || 0,
        balance_due: parseFloat(inv.balance_due) || 0,
        payment_status: (parseFloat(inv.balance_due) || 0) === 0 ? "paid" : (parseFloat(inv.amount_paid) || 0) > 0 ? "partially paid" : "unpaid",
        status: (parseFloat(inv.balance_due) || 0) === 0 ? "paid" : (parseFloat(inv.amount_paid) || 0) > 0 ? "partially paid" : "unpaid",
      }));

    return { success: true, data: transformed, status: response.status };
  } catch (error: any) {
    return { success: false, error: "Failed to fetch party invoices", status: error.response?.status || 500 };
  }
};

export const createPaymentFromInvoice = async (invoiceData: any): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) return { success: false, error: "Authentication required.", status: 401 };

  if (invoiceData.status !== "paid" || !invoiceData.amount_paid || invoiceData.amount_paid <= 0) {
    return { success: false, error: "Invalid invoice status for payment", status: 400 };
  }

  const payload: PaymentInData = {
    payment_number: generatePaymentNumber(),
    date: new Date().toISOString().split("T")[0],
    party_name: invoiceData.selectedCustomer?.name || invoiceData.customer_name || invoiceData.customer?.name || "Unknown Customer",
    total_amount_settled: parseFloat(invoiceData.total_amount) || 0,
    amount_received: parseFloat(invoiceData.amount_paid),
    payment_mode: "cash",
    invoice_id: invoiceData.uuid || invoiceData.id,
    invoice_number: invoiceData.invoiceNo || invoiceData.invoice_number,
  };

  try {
    const response = await axios.post(`${API_URL}/payment-in`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { success: true, data: response.data, status: response.status };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || "Failed to create payment entry", status: error.response?.status || 500 };
  }
};
