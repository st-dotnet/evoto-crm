import axios from "axios";
import { toast } from "sonner";

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
    let isPaymentInEndpoint = true;
    
    // Try /payment-in endpoint first (staging), fallback to /invoices (local)
    try {
      // Build API URL with filters using the new payment-in endpoint
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
      // If /payment-in fails with 404 or network error, fall back to /invoices
      const errorStatus = paymentInError.response?.status;
      const isNetworkError = !errorStatus && paymentInError.code === 'ERR_NETWORK';
      // Fallback on 404 OR network error (backend not running)
      if (errorStatus === 404 || isNetworkError) {
        isPaymentInEndpoint = false;
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
      } else {
        throw paymentInError;
      }
    }

    // Check if response.data is an array, if not try to extract the array
    let invoicesData = response.data;
    let paginationData: any = {};
    
    if (!Array.isArray(response.data)) {
      // The actual array is nested under response.data.data
      if (response.data?.data && Array.isArray(response.data.data)) {
        invoicesData = response.data.data;
        paginationData = response.data.pagination || {};
      } else if (
        response.data?.invoices &&
        Array.isArray(response.data.invoices)
      ) {
        invoicesData = response.data.invoices;
        paginationData = response.data.pagination || {};
      } else if (response.data?.payments && Array.isArray(response.data.payments)) {
        // Handle /payment-in response format
        invoicesData = response.data.payments;
        paginationData = response.data.pagination || {};
      } else {
        return {
          success: false,
          error: "Invalid API response format",
          status: response.status,
        };
      }
    }

    let finalData;
    
    if (isPaymentInEndpoint) {
      // Using /payment-in endpoint - data is already in payment format
      finalData = {
        data: invoicesData,
        pagination: paginationData,
      };
    } else {
      // Using fallback /invoices endpoint - need to transform invoice data to payment format
      
      // For 'all' status, filter out unpaid invoices client-side
      if (!payment_status || payment_status === 'all') {
        invoicesData = invoicesData.filter((invoice: any) => {
          const paymentStatus = invoice.payment_status;
          return paymentStatus === 'paid' || paymentStatus === 'partial';
        });
      }

      // Transform invoice data to payment format
      const paymentData = invoicesData.map((invoice: any) => {
        // Use invoice UUID for payment deletion as backend expects invoice-based endpoint
        const invoiceId = invoice.uuid || invoice.id;
        
        return {
          id: invoiceId,
          payment_number: `PAY-${invoice.invoice_number || "INV"}`,
        date:
          invoice.updated_at ||
          invoice.invoice_date ||
          new Date().toISOString().split("T")[0],
        party_name:
          invoice.customer?.name || invoice.customer_name || "Unknown Customer",
        total_amount_settled: invoice.total_amount || 0,
        amount_received: invoice.amount_paid || 0,
        payment_discount: invoice.payment_discount || invoice.discount_total || 0,
        payment_mode: "cash",
        invoice_id: invoice.uuid || invoice.id,
        invoice_number: invoice.invoice_number || invoice.invoiceNo,
        balance_due: invoice.balance_due || 0,
        payment_status:
          ((invoice.balance_due || 0) === 0
            ? "paid"
            : (invoice.amount_paid || 0) > 0
              ? "partially paid"
              : "unpaid"),
        };
      });

      // Update pagination data for 'all' status to reflect filtered count
      if (!payment_status || payment_status === 'all') {
        if (paginationData.total) {
          paginationData.total = invoicesData.length;
          paginationData.last_page = Math.ceil(invoicesData.length / per_page);
        }
      }

      finalData = {
        data: paymentData,
        pagination: paginationData,
      };
    }

    return {
      success: true,
      data: finalData,
      status: response?.status || 200,
    };
  } catch (error: any) {
    let errorMessage = "Failed to fetch payment records";
    if (error.response?.status === 401) {
      errorMessage = "Session expired. Please log in again.";
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

export const getPaymentById = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    // Use payment-in/invoice endpoint to get payment details (matches delete endpoint pattern)
    const response = await axios.get(`${API_URL}/payment-in/invoice/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      withCredentials: false,
    });

    if (response.data) {
      return {
        success: true,
        data: response.data,
      };
    } else {
      return {
        success: false,
        error: "Payment not found",
        status: 404,
      };
    }
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
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    // Use invoice-based endpoint as specified by backend
    const response = await axios.delete(
      `${API_URL}/payment-in/invoice/${id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        withCredentials: false,
      }
    );

    if (response.data) {
      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } else {
      return {
        success: false,
        error: "Failed to delete payment",
        status: response.status,
      };
    }
  } catch (error: any) {
    let errorMessage = "Failed to delete payment";
    if (error.response?.status === 401) {
      errorMessage = "Session expired. Please log in again.";
    } else if (error.response?.status === 404) {
      errorMessage = "Payment not found";
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

export const generatePaymentNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `PAY-${year}${month}-${random}`;
};

// Function to get payment numbers for autocomplete
export const getPaymentNumbersDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    // Fetch all invoices with payments to get payment numbers
    const response = await axios.get(
      `${API_URL}/invoices?per_page=1000`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        withCredentials: false,
      },
    );

    let invoicesData = response.data;
    if (!Array.isArray(response.data)) {
      if (response.data?.data && Array.isArray(response.data.data)) {
        invoicesData = response.data.data;
      } else if (response.data?.invoices && Array.isArray(response.data.invoices)) {
        invoicesData = response.data.invoices;
      }
    }

    // Filter invoices that have payments and extract payment numbers
    const paymentNumbers = invoicesData
      .filter((invoice: any) =>
        (invoice.payment_status === 'paid' || invoice.payment_status === 'partial') &&
        invoice.invoice_number
      )
      .map((invoice: any) => `PAY-${invoice.invoice_number}`);

    return {
      success: true,
      data: paymentNumbers,
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: "Failed to fetch payment numbers",
      status: error?.response?.status || 500,
    };
  }
};

// Function to get party names for autocomplete
export const getPartyNamesDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    // Fetch all invoices with payments to get party names
    const response = await axios.get(
      `${API_URL}/invoices?per_page=1000`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        withCredentials: false,
      },
    );

    let invoicesData = response.data;
    if (!Array.isArray(response.data)) {
      if (response.data?.data && Array.isArray(response.data.data)) {
        invoicesData = response.data.data;
      } else if (response.data?.invoices && Array.isArray(response.data.invoices)) {
        invoicesData = response.data.invoices;
      }
    }

    // Filter invoices that have payments and extract unique party names
    const partyNames = [...new Set(
      invoicesData
        .filter((invoice: any) =>
          (invoice.payment_status === 'paid' || invoice.payment_status === 'partial') &&
          invoice.customer_name
        )
        .map((invoice: any) => invoice.customer_name)
    )];

    return {
      success: true,
      data: partyNames,
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: "Failed to fetch party names",
      status: error?.response?.status || 500,
    };
  }
};

// Function to create payment entry when invoice status is changed to paid
export const getPartyInvoices = async (
  partyName: string,
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
    // Fetch invoices for the specific party using server-side filtering
    const response = await axios.get(
      `${API_URL}/invoices?party_name=${encodeURIComponent(partyName)}&per_page=1000`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        withCredentials: false,
      },
    );

    // Check if response.data is an array, if not try to extract the array
    let invoicesData = response.data;
    if (!Array.isArray(response.data)) {
      if (response.data?.data && Array.isArray(response.data.data)) {
        invoicesData = response.data.data;
      } else if (
        response.data?.invoices &&
        Array.isArray(response.data.invoices)
      ) {
        invoicesData = response.data.invoices;
      } else {
        return {
          success: false,
          error: "Invalid API response format",
          status: response.status,
        };
      }
    }

    // The server already filtered by party name, now filter by payment status (paid/partially paid)
    const partyInvoices =
      invoicesData?.filter((invoice: any) => {
        // Consider invoice paid if balance_due is 0 and amount_paid > 0
        const isPaid =
          (invoice.balance_due === 0 || invoice.balance_due === "0") &&
          invoice.amount_paid &&
          invoice.amount_paid > 0;

        // Invoice which are partially paid if balance_due > 0 and amount_paid > 0
        const isPartiallyPaid =
          (invoice.balance_due > 0 && invoice.balance_due !== "0") &&
          invoice.amount_paid &&
          invoice.amount_paid > 0;

        // Include both paid and partially paid invoices, exclude unpaid
        return isPaid || isPartiallyPaid;
      }) || [];

    // Transform invoice data to table format
    const invoiceTableData = partyInvoices.map((invoice: any) => ({
      id: invoice.uuid || invoice.id,
      date:
        invoice.invoice_date ||
        invoice.created_at ||
        new Date().toISOString().split("T")[0],
      invoice_number: invoice.invoice_number || invoice.invoiceNo || "N/A",
      invoice_amount: invoice.total_amount || 0,
      tds: invoice.tds || 0,
      discount:
        invoice.payment_discount ||
        invoice.discount_total ||
        invoice.discount ||
        0,
      amount_received: invoice.amount_paid || 0,
      balance_amount: invoice.balance_due || 0,
      balance_due: invoice.balance_due || 0,
      payment_status:
        ((invoice.balance_due || 0) === 0
          ? "paid"
          : (invoice.amount_paid || 0) > 0
            ? "partially paid"
            : "unpaid"),
      status:
        (invoice.balance_due || 0) === 0
          ? "paid"
          : (invoice.amount_paid || 0) > 0
            ? "partially paid"
            : "unpaid",
    }));

    return {
      success: true,
      data: invoiceTableData,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = "Failed to fetch party invoices";
    if (error.response?.status === 401) {
      errorMessage = "Session expired. Please log in again.";
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

export const createPaymentFromInvoice = async (
  invoiceData: any,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  // Only create payment if invoice status is 'paid' and there's an amount paid
  if (
    invoiceData.status !== "paid" ||
    !invoiceData.amount_paid ||
    invoiceData.amount_paid <= 0
  ) {
    return {
      success: false,
      error:
        "Invoice must be paid status with valid amount to create payment entry",
      status: 400,
    };
  }

  const paymentData: PaymentInData = {
    payment_number: generatePaymentNumber(),
    date: new Date().toISOString().split("T")[0], // Current date
    party_name:
      invoiceData.selectedCustomer?.name ||
      invoiceData.customer_name ||
      "Unknown Customer",
    total_amount_settled: invoiceData.total_amount || 0,
    amount_received: invoiceData.amount_paid,
    payment_mode: "cash", // Default payment mode, can be made configurable
    invoice_id: invoiceData.uuid || invoiceData.id,
    invoice_number: invoiceData.invoiceNo || invoiceData.invoice_number,
  };

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
    let errorMessage = "Failed to create payment entry from invoice";
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
