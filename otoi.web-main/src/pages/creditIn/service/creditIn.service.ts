import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_URL;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  message?: string;
}

interface CreditNoteItem {
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

interface CreditNoteData {
  creditNoteNo: string;
  creditNoteDate: string;
  linkToInvoice: string;
  linkToInvoiceId?: string;
  status: string;
  selectedCustomer: any;
  creditNoteItems: CreditNoteItem[];
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

const getBusinessId = (): number | null => {
  try {
    const authData = localStorage.getItem("OTOI-auth-v1.0.0.1");
    if (!authData) return null;

    const parsedAuth = JSON.parse(authData);
    return parsedAuth.business_id || parsedAuth.businessId || 1;
  } catch (error) {
    return 1;
  }
};

export const getNextCreditNoteNumber = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required",
      status: 401,
    };
  }

  try {
    const response = await axios.get(`${API_URL}/credit-notes/next-number`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
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
      error:
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to fetch next credit note number",
      status: error?.response?.status || 500,
    };
  }
};

export const createCreditNote = async (
  creditNoteData: CreditNoteData,
): Promise<ApiResponse> => {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  // Transform frontend data to match backend model structure
  const payload = {
    // Core fields
    credit_note_number: creditNoteData.creditNoteNo,
    customer_id: creditNoteData.selectedCustomer.uuid,
    business_id: getBusinessId(),
    invoice_id: creditNoteData.linkToInvoice || null,
    credit_note_date: creditNoteData.creditNoteDate,

    // Items - transform to match backend expectations
    items: creditNoteData.creditNoteItems.map((item) => ({
      item_id: item.item_id,
      description: item.description || null,
      quantity: item.quantity,
      unit_price: item.price_per_item,
      discount: item.discount,
      tax: item.tax,
      total_price: item.amount,
      hsn_sac_code: item.hsn_sac || null,
    })),

    // Charges JSON structure matching backend
    charges: {
      subtotal: creditNoteData.subtotal || 0,
      total_discount: creditNoteData.total_discount || 0,
      total_tax: creditNoteData.total_tax || 0,
      taxable_amount: creditNoteData.taxable_amount || 0,
      round_off_amount: creditNoteData.round_off_amount || 0,
    },

    // Additional notes
    additional_notes: {
      notes: creditNoteData.notes || "",
      terms_and_conditions: creditNoteData.terms || "",
    },

    // Status
    status: creditNoteData.status || "draft",
  };

  try {
    const response = await axios.post(`${API_URL}/credit-notes`, payload, {
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
    let errorMessage = "Failed to create credit note";
    if (error.code === "ERR_NETWORK") {
      errorMessage =
        "Unable to connect to server. Please check your internet connection.";
    } else if (error.response?.status === 400) {
      errorMessage =
        error.response.data?.error ||
        error.response.data?.message ||
        "Invalid credit note data provided";
    } else if (error.response?.status === 401) {
      errorMessage = "Session expired. Please log in again.";
    } else if (error.response.data?.message) {
      errorMessage = error.response.data.message;
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

export const getCreditNoteById = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    const response = await axios.get(`${API_URL}/credit-notes/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      withCredentials: false,
    });

    // Transform backend response to frontend format
    const data = response.data;
    const transformedData = {
      ...data,
      subtotal: data.charges?.subtotal || data.subtotal || 0,
      tax_total:
        data.charges?.tax_total || data.total_tax || data.tax_total || 0,
      discount_total:
        data.charges?.discount_total ||
        data.total_discount ||
        data.discount_total ||
        0,
      additional_charges_total:
        data.charges?.additional_charges_total || data.additional_charges || 0,
      round_off:
        data.charges?.round_off || data.round_off_amount || data.round_off || 0,
      total_amount: data.total_amount || 0,
      notes: data.additional_notes?.notes || data.notes || "",
      terms_and_conditions:
        data.additional_notes?.terms_and_conditions ||
        data.terms_and_conditions ||
        data.terms ||
        "",
      items:
        data.items?.map((item: any) => ({
          ...item,
          discount_percentage: item.discount?.discount_percentage || 0,
          discount_amount: item.discount?.discount_amount || 0,
          tax_percentage: item.tax?.tax_percentage || 0,
          tax_amount: item.tax?.tax_amount || 0,
        })) || [],
    };

    return {
      success: true,
      data: transformedData,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = "Failed to fetch credit note";
    if (error.code === "ERR_NETWORK") {
      errorMessage =
        "Unable to connect to server. Please check your internet connection.";
    } else if (error.response?.status === 404) {
      errorMessage = "Credit note not found.";
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

export const updateInvoiceStatus = async (
  invoiceId: string,
  status: string,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required",
      status: 401,
    };
  }

  try {
    const response = await axios.put(
      `${API_URL}/invoices/${invoiceId}/status`,
      { status },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = "Failed to update invoice status";
    if (error.response?.status === 401) {
      errorMessage = "Session expired. Please log in again.";
    } else if (error.response?.status === 403) {
      errorMessage = "You do not have permission to update invoices.";
    } else if (error.response?.status === 404) {
      errorMessage = "Invoice status endpoint not found.";
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

export const updateCreditNote = async (
  id: string,
  creditNoteData: any,
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
    const response = await axios.put(
      `${API_URL}/credit-notes/${id}`,
      creditNoteData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        withCredentials: false,
      },
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = "Failed to update credit note";
    if (error.code === "ERR_NETWORK") {
      errorMessage =
        "Unable to connect to server. Please check your internet connection.";
    } else if (error.response?.status === 404) {
      errorMessage = "Credit note not found.";
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

export const deleteCreditNote = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    const response = await axios.delete(`${API_URL}/credit-notes/${id}`, {
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
    let errorMessage = "Failed to delete credit note";
    if (error.code === "ERR_NETWORK") {
      errorMessage =
        "Unable to connect to server. Please check your internet connection.";
    } else if (error.response?.status === 404) {
      errorMessage = "Credit note not found.";
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

export const getCreditNotes = async (params?: {
  search?: string;
  party_name?: string;
  credit_note_number?: string;
  status?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  order?: string;
  invoice_id?: string;
}): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  try {
    const queryParams = new URLSearchParams();

    // Add search parameters
    if (params?.search) queryParams.append("search", params.search);
    if (params?.party_name) queryParams.append("party_name", params.party_name);
    if (params?.credit_note_number)
      queryParams.append("credit_note_number", params.credit_note_number);
    if (params?.invoice_id) queryParams.append("invoice_id", params.invoice_id);
    // Always include status parameter, even if empty
    queryParams.append("status", params?.status || "");

    // Add pagination parameters
    queryParams.append("page", String(params?.page || 1));
    queryParams.append("per_page", String(params?.per_page || 5));

    // Add sorting parameters
    if (params?.sort) queryParams.append("sort", params.sort);
    if (params?.order) queryParams.append("order", params.order || "desc");

    const response = await axios.get(
      `${API_URL}/credit-notes?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    // Transform backend response to frontend format - same as getCreditNoteById
    const data = response.data;
    
    // Handle the nested structure for credit notes array
    let creditNotesArray = data.data?.credit_notes || data.credit_notes || data.data || [];
    
    // Transform each credit note to match frontend field names
    const transformedCreditNotes = creditNotesArray.map((note: any) => {
      
      // Check if this credit note has items
      const hasItems = note.items && Array.isArray(note.items) && note.items.length > 0;
      const hasCharges = note.charges || note.data?.charges || note.additional_charges;
      
      // Calculate total_amount from items if backend returns 0
      let calculatedTotal = 0;
      if (hasItems) {
        calculatedTotal = note.items.reduce((sum: number, item: any) => {
          const itemTotal = item.quantity * item.unit_price * 
            (1 - (item.discount?.discount_percentage || 0) / 100) * 
            (1 + (item.tax?.tax_percentage || 0) / 100);
          return sum + itemTotal;
        }, 0);
      }
      
      // Also calculate from charges as backup - check multiple possible field locations
      const chargesTotal = (note.charges?.taxable_amount || 
                       note.data?.charges?.taxable_amount || 
                       note.additional_charges?.taxable_amount || 0) + 
                       (note.charges?.total_tax || 
                       note.data?.charges?.total_tax || 
                       note.additional_charges?.total_tax || 0) - 
                       (note.charges?.total_discount || 
                       note.data?.charges?.total_discount || 
                       note.additional_charges?.total_discount || 0);
      
      // Use backend total_amount directly - no more fallback logic needed
      const finalTotal = note.total_amount || 0;
      
      const transformed = {
        ...note,
        total_amount: finalTotal,
        subtotal: note.charges?.subtotal || 
                  note.data?.charges?.subtotal || 
                  note.subtotal || 
                  chargesTotal, // Use chargesTotal as subtotal fallback
        tax_total: note.charges?.total_tax || 
                   note.data?.charges?.total_tax || 
                   note.additional_charges?.total_tax || 
                   note.total_tax || 0,
        discount_total: note.charges?.discount_total || 
                       note.data?.charges?.discount_total || 
                       note.additional_charges?.discount_total || 
                       note.total_discount || 0,
        round_off: note.charges?.round_off || 
                   note.data?.charges?.round_off || 
                   note.additional_charges?.round_off || 
                   note.round_off_amount || note.round_off || 0,
      };
      return transformed;
    });

    // Return the transformed data in the same structure
    const transformedData = {
      ...data,
      data: {
        ...data.data,
        credit_notes: transformedCreditNotes,
      },
    };

    return {
      success: true,
      data: transformedData,
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error:
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to fetch credit notes",
      status: error?.response?.status || 500,
    };
  }
};

export const getCustomerNamesDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/credit-notes?customer_dropdown=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    try {
      const fallbackResponse = await axios.get(
        `${API_URL}/credit-notes?per_page=1000`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      // Extract only the minimal data needed for dropdown from actual credit notes
      if (fallbackResponse.data && fallbackResponse.data.data) {
        const uniqueCustomers = new Map();

        fallbackResponse.data.data.forEach((item: any) => {
          if (item.party_name && item.party_name.trim()) {
            const customerName = item.party_name.trim();
            if (!uniqueCustomers.has(customerName)) {
              uniqueCustomers.set(customerName, {
                uuid: item.customer_id,
                name: customerName,
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
        error: "No credit notes found",
        status: 404,
      };
    } catch (fallbackError: any) {
      return {
        success: false,
        error:
          fallbackError.response?.data?.error ||
          fallbackError.response?.data?.message ||
          "Failed to fetch customer names",
        status: fallbackError?.response?.status || 500,
      };
    }
  }
};

export const getCreditNoteNumbersDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/credit-notes?credit_note_numbers_dropdown=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    try {
      const fallbackResponse = await axios.get(
        `${API_URL}/credit-notes?per_page=1000`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      // Extract only the minimal data needed for dropdown from actual credit notes
      if (fallbackResponse.data && fallbackResponse.data.data) {
        const minimalData = fallbackResponse.data.data.map((item: any) => ({
          uuid: item.uuid,
          credit_note_number: item.credit_note_number,
          customer_id: item.customer_id,
        }));

        return {
          success: true,
          data: minimalData,
          status: fallbackResponse.status,
        };
      }

      return {
        success: false,
        error: "No credit notes found",
        status: 404,
      };
    } catch (fallbackError: any) {
      return {
        success: false,
        error:
          fallbackError.response?.data?.error ||
          fallbackError.message ||
          "Failed to fetch credit notes with fallback approach",
        status: 404,
      };
    }
  }
};

export const getAllCustomersDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/quotations?customer_dropdown_all=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch customers",
    };
  }
};

export const getInvoicesForParty = async (
  partyId: string,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  try {
    const params = new URLSearchParams();

    // Add customer_id parameter for proper server-side filtering
    params.append("customer_id", partyId);

    // Add parameter to exclude invoices already linked to credit notes
    params.append("exclude_linked_to_credit_notes", "true");

    // Add pagination parameters to get all invoices for this customer
    params.append("per_page", "1000"); // Get all invoices for this customer

    const response = await axios.get(
      `${API_URL}/invoices?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error:
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to fetch invoices",
      status: error?.response?.status || 500,
    };
  }
};

export const getCustomerById = async (
  customerId: string,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  try {
    const response = await axios.get(`${API_URL}/customers/${customerId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = "Failed to fetch customer";
    if (error.code === "ERR_NETWORK") {
      errorMessage =
        "Unable to connect to server. Please check your internet connection.";
    } else if (error.response?.status === 404) {
      errorMessage = "Customer not found.";
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

export const checkCreditNoteExistsForInvoice = async (
  invoiceId: string,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  try {
    // Use the existing getCreditNotes function to search
    const response = await axios.get(`${API_URL}/credit-notes`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      params: {
        search: invoiceId,
        per_page: 100, // Get more results to be thorough
      },
    });

    const creditNotes = response.data?.data?.credit_notes || [];
    const hasCreditNote = creditNotes.length > 0;

    // Check if any of the found credit notes are linked to this invoice
    const linkedCreditNotes = creditNotes.filter((cn: any) => {
      // Check multiple possible fields where invoice info might be stored
      return (
        cn.linked_invoice_id === invoiceId ||
        cn.invoice_number === invoiceId ||
        cn.linkToInvoice === invoiceId ||
        cn.invoice_id === invoiceId ||
        (cn.linked_invoice && cn.linked_invoice.invoice_number === invoiceId)
      );
    });
    return {
      success: true,
      data: {
        hasCreditNote: linkedCreditNotes.length > 0,
        creditNotes: linkedCreditNotes,
        allCreditNotes: creditNotes,
      },
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error:
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to check credit note status",
      status: error?.response?.status || 500,
    };
  }
};
