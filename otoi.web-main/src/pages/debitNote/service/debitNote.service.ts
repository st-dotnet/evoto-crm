import axios from 'axios';

const API_URL = import.meta.env.VITE_APP_API_URL;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  message?: string;
}

export interface DebitNoteItem {
  id: string;
  item_id: string;
  item_name: string;
  hsn_sac?: string;
  quantity: number;
  price_per_item: number;
  discount: number;
  tax: number;
  amount: number;
  measuring_unit_id?: number;
  description?: string | null;
}

export interface DebitNoteData {
  debitNoteNo: string;
  debitNoteDate: string;
  linkToInvoice: string;
  linkToInvoiceId?: string;
  vendorId?: string; // Store vendor ID from invoice when creating debit note from invoice
  status: string;
  selectedCustomer: any;
  debitNoteItems: DebitNoteItem[];
  notes?: string;
  terms?: string;
  total_amount: number;
  subtotal: number;
  total_discount: number;
  total_tax: number;
  taxable_amount?: number;
  round_off_amount?: number;
  additional_charges?: number;
  round_off?: number;
}

const getAuthToken = (): string | null => {
  try {
    const authData = localStorage.getItem('OTOI-auth-v1.0.0.1');
    if (!authData) return null;

    const parsedAuth = JSON.parse(authData);
    return parsedAuth.token || parsedAuth.access_token || parsedAuth.accessToken || null;
  } catch (error) {
    return null;
  }
};

const getBusinessId = (): number | null => {
  try {
    const authData = localStorage.getItem('OTOI-auth-v1.0.0.1');
    if (!authData) return null;

    const parsedAuth = JSON.parse(authData);
    return parsedAuth.business_id || parsedAuth.businessId || 1;
  } catch (error) {
    return 1;
  }
};

export const getNextDebitNoteNumber = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: 'Authentication required',
      status: 401
    };
  }

  try {
    const response = await axios.get(`${API_URL}/debit-notes/next-number`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });

    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || 'Failed to fetch next debit note number',
      status: error?.response?.status || 500
    };
  }
};

export const createDebitNote = async (debitNoteData: DebitNoteData): Promise<ApiResponse> => {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: 'Authentication required. Please log in again.',
      status: 401
    };
  }

  // Transform frontend data to match backend model structure
  let vendorId = debitNoteData.selectedCustomer?.uuid || debitNoteData.vendorId || null;
  
  const payload = {
    // Core fields
    debit_note_number: debitNoteData.debitNoteNo,
    vendor_id: vendorId,
    business_id: getBusinessId(),
    invoice_id: debitNoteData.linkToInvoiceId || debitNoteData.linkToInvoice || null, // Use UUID if available, fallback to invoice number
    debit_note_date: debitNoteData.debitNoteDate,
    
    // Items - transform to match backend expectations
    items: debitNoteData.debitNoteItems.map(item => ({
      item_id: item.item_id,
      description: item.description || null,
      quantity: item.quantity,
      unit_price: item.price_per_item,
      discount: item.discount,
      tax: item.tax,
      total_price: item.amount,
      hsn_sac_code: item.hsn_sac || null
    })),
    
    // Charges JSON structure matching backend
    charges: {
      subtotal: debitNoteData.subtotal || 0,
      total_discount: debitNoteData.total_discount || 0,
      total_tax: debitNoteData.total_tax || 0,
      taxable_amount: debitNoteData.taxable_amount || 0,
      round_off_amount: debitNoteData.round_off_amount || 0
    },
    
    // Additional notes
    additional_notes: {
      notes: debitNoteData.notes || '',
      terms_and_conditions: debitNoteData.terms || ''
    },
    
    // Status - ensure correct status based on invoice linkage
    status: debitNoteData.linkToInvoice ? 'credited' : (debitNoteData.status || 'unpaid')
  };

  try {
    const response = await axios.post(`${API_URL}/debit-notes`, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      withCredentials: false
    });

    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error: any) {
    let errorMessage = 'Failed to create debit note';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.response?.status === 400) {
      errorMessage = error.response.data?.error || error.response.data?.message || 'Invalid debit note data provided';
    } else if (error.response?.status === 401) {
      errorMessage = 'Session expired. Please log in again.';
    } else if (error.response.data?.message) {
      errorMessage = error.response.data.message;
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500
    };
  }
};

export const getDebitNoteById = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: 'Authentication required. Please log in again.',
      status: 401
    };
  }

  try {
    const response = await axios.get(`${API_URL}/debit-notes/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      withCredentials: false
    });

    // Transform backend response to frontend format
    const data = response.data;
    
    // Extract the actual debit note data from nested structure
    const debitNoteData = data.debit_note || data;
    
    const transformedData = {
      ...debitNoteData,
      subtotal: debitNoteData.charges?.subtotal || debitNoteData.subtotal || 0,
      tax_total: debitNoteData.charges?.tax_total || debitNoteData.total_tax || debitNoteData.tax_total || 0,
      discount_total: debitNoteData.charges?.discount_total || debitNoteData.total_discount || debitNoteData.discount_total || 0,
      additional_charges_total: debitNoteData.charges?.additional_charges_total || debitNoteData.additional_charges || 0,
      round_off: debitNoteData.charges?.round_off || debitNoteData.round_off_amount || debitNoteData.round_off || 0,
      total_amount: debitNoteData.total_amount || 0,
      balance_due: debitNoteData.balance_due || 0,
      amount_received: debitNoteData.amount_received || 0,
      status: debitNoteData.status || 'unpaid',
      notes: debitNoteData.additional_notes?.notes || debitNoteData.notes || "",
      terms_and_conditions: debitNoteData.additional_notes?.terms_and_conditions || debitNoteData.terms_and_conditions || debitNoteData.terms || "",
      items: data.items?.map((item: any) => {
        const resolveValue = (val: any, fieldKey: string) => {
          if (val === null || val === undefined) return 0;
          if (typeof val === "object") return Number(val[fieldKey]) || 0;
          return Number(val) || 0;
        };

        return {
          ...item,
          discount_percentage: resolveValue(
            item.discount?.discount_percentage ?? item.discount_percentage ?? item.discount,
            "discount_percentage"
          ),
          discount_amount: resolveValue(
            item.discount?.discount_amount ?? item.discount_amount,
            "discount_amount"
          ),
          tax_percentage: resolveValue(
            item.tax?.tax_percentage ?? item.tax_percentage ?? item.tax,
            "tax_percentage"
          ),
          tax_amount: resolveValue(
            item.tax?.tax_amount ?? item.tax_amount,
            "tax_amount"
          ),
        };
      }) || [],
    };
    

    return {
      success: true,
      data: transformedData,
      status: response.status
    };
  } catch (error: any) {
    let errorMessage = 'Failed to fetch debit note';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Debit note not found.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Session expired. Please log in again.';
    } else if (error.response?.status === 500) {
      errorMessage = 'Server error. The debit note may not exist or there might be a temporary issue.';
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500
    };
  }
};

export const updateDebitNote = async (id: string, debitNoteData: any): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: 'Authentication required. Please log in again.',
      status: 401
    };
  }

  try {
    const response = await axios.put(`${API_URL}/debit-notes/${id}`, debitNoteData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      withCredentials: false
    });

    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error: any) {
    let errorMessage = 'Failed to update debit note';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Debit note not found.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Session expired. Please log in again.';
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500
    };
  }
};

export const deleteDebitNote = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: 'Authentication required. Please log in again.',
      status: 401
    };
  }

  try {
    const response = await axios.delete(`${API_URL}/debit-notes/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      withCredentials: false
    });

    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error: any) {
    let errorMessage = 'Failed to delete debit note';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Debit note not found.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Session expired. Please log in again.';
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500
    };
  }
};

export const getDebitNotes = async (params?: {
  search?: string;
  customer_id?: string;
  vendor_id?: string;
  debit_note_number?: string;
  invoice_id?: string;
  status?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  order?: string;
  date_from?: string;
  date_to?: string;
  date_filter?: string;
  vendor_dropdown_all?: boolean;
  vendor_names_dropdown?: boolean;
  party_names_dropdown?: boolean;
  debit_note_numbers_dropdown?: boolean;
  statuses_dropdown?: boolean;
  invoice_numbers_dropdown?: boolean;
}): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const queryParams = new URLSearchParams();
        
    // Add search parameters
    if (params?.search) queryParams.append('search', params.search);
    if (params?.customer_id) queryParams.append('customer_id', params.customer_id);
    if (params?.vendor_id) queryParams.append('vendor_id', params.vendor_id);
    if (params?.debit_note_number) queryParams.append('debit_note_number', params.debit_note_number);
    if (params?.invoice_id) queryParams.append('invoice_id', params.invoice_id);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    if (params?.date_filter) queryParams.append('date_filter', params.date_filter);
    
    // Add dropdown parameters
    if (params?.vendor_dropdown_all) queryParams.append('vendor_dropdown_all', 'true');
    if (params?.vendor_names_dropdown) queryParams.append('vendor_names_dropdown', 'true');
    if (params?.party_names_dropdown) queryParams.append('party_names_dropdown', 'true');
    if (params?.debit_note_numbers_dropdown) queryParams.append('debit_note_numbers_dropdown', 'true');
    if (params?.statuses_dropdown) queryParams.append('statuses_dropdown', 'true');
    if (params?.invoice_numbers_dropdown) queryParams.append('invoice_numbers_dropdown', 'true');
    
    // Add pagination parameters
    queryParams.append('page', String(params?.page || 1));
    queryParams.append('per_page', String(params?.per_page || 20));
    
    // Add sorting parameters
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.order) queryParams.append('order', params.order || 'desc');

    const finalUrl = `${API_URL}/debit-notes?${queryParams.toString()}`;

    const response = await axios.get(
      `${API_URL}/debit-notes?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || 'Failed to fetch debit notes',
      status: error?.response?.status || 500,
    };
  }
};

// Dedicated dropdown functions that return simple arrays
export const getPartyNamesDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/debit-notes/dropdown?type=party_names`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data, // This should be: [{"uuid": "...", "name": "CP Plus"}]
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch party names',
      status: error?.response?.status || 500,
    };
  }
};

export const getInvoiceNumbersDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/debit-notes/dropdown?type=invoice_numbers`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data, // This should be: ["PINV-9016", "PINV-9015"]
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch invoice numbers',
      status: error?.response?.status || 500,
    };
  }
};

export const getDebitNoteNumbersDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/debit-notes/dropdown?type=debit_note_numbers`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data, // This should be: ["DN-9969", "DN-9968"]
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch debit note numbers',
      status: error?.response?.status || 500,
    };
  }
};

export const getStatusesDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/debit-notes/dropdown?type=statuses`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data, // This should be: ["unpaid", "partial", "paid", "credited", "cancelled"]
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch statuses',
      status: error?.response?.status || 500,
    };
  }
};

export const getCustomerNamesDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/debit-notes?customer_dropdown=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    try {
      const fallbackResponse = await axios.get(
        `${API_URL}/debit-notes?per_page=1000`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      // Extract only the minimal data needed for dropdown from actual debit notes
      if (fallbackResponse.data && fallbackResponse.data.data) {
        const uniqueCustomers = new Map();
        
        fallbackResponse.data.data.forEach((item: any) => {
          if (item.party_name && item.party_name.trim()) {
            const customerName = item.party_name.trim();
            if (!uniqueCustomers.has(customerName)) {
              uniqueCustomers.set(customerName, {
                uuid: item.customer_id,
                name: customerName
              });
            }
          }
        });
        
        const result = Array.from(uniqueCustomers.values());
        
        return {
          success: true,
          data: result,
          status: fallbackResponse.status,
        };
      }
      
      return {
        success: false,
        error: 'No debit notes found',
        status: fallbackResponse.status || 404,
      };
    } catch (fallbackError: any) {
      return {
        success: false,
        error: fallbackError.response?.data?.error || fallbackError.response?.data?.message || 'Failed to fetch customer names',
        status: fallbackError?.response?.status || 500,
      };
    }
  }
};

export const getAllCustomersDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/quotations?customer_dropdown_all=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch customers',
    };
  }
};

// Get vendors directly from vendors API
export const getVendorsDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/vendors/?items_per_page=1000`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    return { success: true, data: response.data, status: response.status };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || "Failed to fetch vendors",
      status: error.response?.status || 500,
    };
  }
};

export const getInvoicesForParty = async (partyId: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const params = new URLSearchParams();
    
    // Add vendor_id parameter for proper server-side filtering (purchase invoices use vendor_id, not customer_id)
    params.append('vendor_id', partyId);
    
    // Add pagination parameters to get all invoices for this vendor
    params.append('per_page', '5'); // Get all invoices for this vendor

    const response = await axios.get(
      `${API_URL}/purchase-invoices/?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || 'Failed to fetch invoices',
      status: error?.response?.status || 500,
    };
  }
};

export const getVendorById = async (vendorId: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/vendors/${vendorId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = 'Failed to fetch vendor';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Vendor not found.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Session expired. Please log in again.';
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500
    };
  }
};

export const getCustomerById = async (customerId: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/customers/${customerId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = 'Failed to fetch customer';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Customer not found.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Session expired. Please log in again.';
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500
    };
  }
};

export const checkDebitNoteExistsForInvoice = async (invoiceId: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    // First, get the invoice details to get the invoice number
    let invoiceNumber = invoiceId; // Default to using the ID directly
    
    // Try to get invoice number from invoice data if available
    try {
      const { getPurchaseInvoiceById } = await import("../../purchases/services/purchaseInvoice.services");
      const invoiceResponse = await getPurchaseInvoiceById(invoiceId);
      if (invoiceResponse.success && invoiceResponse.data?.invoice_number) {
        invoiceNumber = invoiceResponse.data.invoice_number;
      }
    } catch (error) {
    }
    
    // Use the existing getDebitNotes function to search
    const params = {
      search: invoiceNumber, // Enable search by invoice number
      invoice_id: invoiceId, // Enable filter by invoice UUID
      per_page: 100, // Get more results to be thorough
    };
    
    
    const response = await getDebitNotes(params);

    let debitNotes = [];
    if (response.success && response.data) {
      debitNotes = response.data.data?.debit_notes || [];
    } else {
    }
    
    
    // Since we're now filtering by invoice_id and search, all returned debit notes should be linked
    const hasDebitNote = debitNotes.length > 0;
    
    return {
      success: true,
      data: { 
        hasDebitNote: hasDebitNote, 
        debitNotes: debitNotes, // Return the actual debit notes from API
        allDebitNotes: debitNotes
      },
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || 'Failed to check debit note status',
      status: error?.response?.status || 500,
    };
  }
};

// Payment and Statistics Functions
export const getDebitNoteStatistics = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.get(`${API_URL}/debit-notes/statistics`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || 'Failed to fetch debit note statistics',
      status: error?.response?.status || 500,
    };
  }
};

export const createDebitNotePayment = async (debitNoteId: string, paymentData: {
  payment_amount: number;
  payment_date: string;
  payment_method?: string;
  payment_reference?: string;
  payment_notes?: string;
}): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.post(`${API_URL}/debit-notes/${debitNoteId}/payments`, paymentData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = 'Failed to record payment';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Debit note not found.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Session expired. Please log in again.';
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

export const getDebitNotePayments = async (debitNoteId: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.get(`${API_URL}/debit-notes/${debitNoteId}/payments`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = 'Failed to fetch payments';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Debit note not found.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Session expired. Please log in again.';
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

export const updatePurchaseInvoiceStatus = async (invoiceId: string, status: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.patch(
      `${API_URL}/purchase-invoices/${invoiceId}/status`,
      { payment_status: status },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = 'Failed to update purchase invoice status';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Purchase invoice not found.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Session expired. Please log in again.';
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

export const checkInvoiceDebitNotes = async (invoiceId: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.get(`${API_URL}/debit-notes/check-invoice/${invoiceId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = 'Failed to check invoice debit notes';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Invoice not found.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Session expired. Please log in again.';
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};
