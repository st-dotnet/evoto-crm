import axios from 'axios';

const API_URL = import.meta.env.VITE_APP_API_URL;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  message?: string;
}

interface QuotationItemsResponse {
  data: any[];
  pagination: {
    total: number;
    items_per_page: number;
    current_page: number;
    last_page: number;
    from: number;
    to: number;
  };
}

// Frontend QuotationItem structure (from CreateQuotationPage)
interface QuotationItem {
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

// Frontend QuotationData structure
interface QuotationData {
  quotationNo: string;
  quotationDate: string;
  validFor: number;
  validityDate: string;
  status: string;
  selectedCustomer: any;
  quotationItems: QuotationItem[];
  notes?: string;
  terms?: string;
  total_amount: number;
  subtotal: number;
  total_discount: number;
  total_tax: number;
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
    console.error('Error parsing auth data:', error);
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

export const getNextQuotationNumber = async (): Promise<ApiResponse> => {
  // This function was causing 404 errors - removing it
  // The next quotation number should be handled by the backend pagination
  return { success: true, data: null };
};

export const createQuotation = async (quotationData: QuotationData): Promise<ApiResponse> => {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: 'Authentication required. Please log in again.',
      status: 401
    };
  }

  // Transform frontend data to match new backend model structure
  const payload = {
    // Core fields
    quotation_number: quotationData.quotationNo || undefined, // Let backend generate if empty
    business_id: getBusinessId(),
    customer_id: quotationData.selectedCustomer.uuid,
    quotation_date: quotationData.quotationDate,
    valid_till: quotationData.validityDate,

    // Financial totals
    total_amount: quotationData.total_amount,
    subtotal: quotationData.subtotal,
    total_tax: quotationData.total_tax,
    total_discount: quotationData.total_discount,
    additional_charges_total: quotationData.additional_charges || 0,
    round_off: quotationData.round_off || 0,

    // Status
    status: quotationData.status || 'open',

    // Notes
    notes: quotationData.notes || '',
    terms_and_conditions: quotationData.terms || '',

    // Items - transform to match backend expectations
    items: quotationData.quotationItems.map(item => ({
      item_id: item.item_id,
      description: item.description || null,
      quantity: item.quantity,
      unit_price: item.price_per_item,

      // Discount as percentage (backend will store in JSON)
      discount: item.discount,
      discount_amount: (item.quantity * item.price_per_item * item.discount) / 100,

      // Tax as percentage (backend will store in JSON)
      tax: item.tax,
      tax_amount: (item.quantity * item.price_per_item * (1 - item.discount / 100) * item.tax) / 100,

      // Final amount
      total_price: item.amount,
    })),
  };

  try {
    const response = await axios.post(`${API_URL}/quotations`, payload, {
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
    // console.error('Error creating quotation:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status
    });

    let errorMessage = 'Failed to create quotation';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to the server. Please check your internet connection.';
    } else if (error.response) {
      if (error.response.status === 400) {
        errorMessage = error.response.data?.error || error.response.data?.message || 'Invalid quotation data provided';
      } else if (error.response.status === 401) {
        errorMessage = 'Session expired. Please log in again.';
      } else if (error.response.status === 403) {
        errorMessage = 'You do not have permission to create quotations.';
      } else if (error.response.data?.message) {
        errorMessage = error.response.data.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500
    };
  }
};

export const getQuotations = async (params?: {
  search?: string;
  party_name?: string;
  quotation_number?: string;
  status?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  order?: string;
}): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const queryParams = new URLSearchParams();
    
    // Add search parameters
    if (params?.search) queryParams.append('search', params.search);
    if (params?.party_name) queryParams.append('party_name', params.party_name);
    if (params?.quotation_number) queryParams.append('quotation_number', params.quotation_number);
    // Always include status parameter, even if empty
    queryParams.append('status', params?.status || '');
    
    // Add pagination parameters
    queryParams.append('page', String(params?.page || 1));
    queryParams.append('per_page', String(params?.per_page || 5));
    
    // Add sorting parameters
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.order) queryParams.append('order', params.order || 'desc');

    const response = await axios.get(
      `${API_URL}/quotations?${queryParams.toString()}`,
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
    // console.error('Error fetching quotations:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || 'Failed to fetch quotations',
      status: error.response?.status || 500,
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
      `${API_URL}/quotations?customer_dropdown=true`,
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
    // console.error('Error fetching customer names dropdown:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || 'Failed to fetch customer names',
      status: error.response?.status || 500,
    };
  }
};

export const getQuotationNumbersDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Authentication required', status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/quotations/quotation-dropdown`,
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
    // console.error('Error fetching quotation numbers dropdown:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || 'Failed to fetch quotation numbers',
      status: error.response?.status || 500,
    };
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
    // console.error('Error fetching all customers dropdown:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || 'Failed to fetch customers',
      status: error.response?.status || 500,
    };
  }
};

export const getQuotationById = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: 'Authentication required. Please log in again.',
      status: 401
    };
  }

  try {
    const response = await axios.get(`${API_URL}/quotations/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      withCredentials: false
    });

    // Transform backend response to frontend format
    const data = response.data;
    const transformedData = {
      ...data,
      // Include customer information
      customer: data.customer,
      // Extract charges from JSON
      subtotal: data.charges?.subtotal || 0,
      tax_total: data.charges?.tax_total || 0,
      discount_total: data.charges?.discount_total || 0,
      additional_charges_total: data.charges?.additional_charges_total || 0,
      round_off: data.charges?.round_off || 0,
      // Extract notes from JSON
      notes: data.additional_notes?.notes || '',
      terms_and_conditions: data.additional_notes?.terms_and_conditions || '',
      // Transform items
      items: data.items?.map((item: any) => ({
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
      status: response.status
    };
  } catch (error: any) {
    // console.error('Error fetching quotation:', error);

    let errorMessage = 'Failed to fetch quotation';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to the server. Please check your internet connection.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Quotation not found.';
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

export const updateQuotation = async (id: string, quotationData: Partial<QuotationData>): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: 'Authentication required. Please log in again.',
      status: 401
    };
  }

  // Transform to backend format (match current API shape)
  const payload: any = {
    business_id: getBusinessId(),
  };

  if (quotationData.quotationNo) payload.quotation_number = quotationData.quotationNo;
  if (quotationData.selectedCustomer?.uuid) payload.customer_id = quotationData.selectedCustomer.uuid;

  if (quotationData.quotationDate) payload.quotation_date = quotationData.quotationDate;
  if (quotationData.validityDate) payload.valid_till = quotationData.validityDate;

  if (quotationData.status) payload.status = quotationData.status;

  if (quotationData.total_amount !== undefined) payload.total_amount = quotationData.total_amount;

  if (quotationData.subtotal !== undefined) payload.subtotal = quotationData.subtotal;
  if (quotationData.total_tax !== undefined) payload.total_tax = quotationData.total_tax;
  if (quotationData.total_discount !== undefined) payload.total_discount = quotationData.total_discount;
  if (quotationData.additional_charges !== undefined) payload.additional_charges_total = quotationData.additional_charges;
  if (quotationData.round_off !== undefined) payload.round_off = quotationData.round_off;

  if (
    quotationData.subtotal !== undefined ||
    quotationData.total_discount !== undefined ||
    quotationData.total_tax !== undefined ||
    quotationData.additional_charges !== undefined ||
    quotationData.round_off !== undefined
  ) {
    payload.charges = {
      subtotal: quotationData.subtotal ?? 0,
      discount_total: quotationData.total_discount ?? 0,
      tax_total: quotationData.total_tax ?? 0,
      additional_charges_total: quotationData.additional_charges ?? 0,
      round_off: quotationData.round_off ?? 0,
    };
  }

  if (quotationData.notes !== undefined) payload.notes = quotationData.notes;
  if (quotationData.terms !== undefined) payload.terms_and_conditions = quotationData.terms;

  if (quotationData.notes !== undefined || quotationData.terms !== undefined) {
    payload.additional_notes = {
      notes: quotationData.notes ?? "",
      terms_and_conditions: quotationData.terms ?? "",
      version: 1,
    };
  }

  // Items
  if (quotationData.quotationItems) {
    payload.items = quotationData.quotationItems.map(item => ({
      uuid: item.id,
      item_id: item.item_id,
      product_name: item.item_name,
      hsn_sac_code: item.hsn_sac,
      description: item.description || null,
      quantity: item.quantity,
      unit_price: item.price_per_item,
      discount_percentage: item.discount,
      discount_amount: (item.quantity * item.price_per_item * item.discount) / 100,
      tax_percentage: item.tax,
      tax_amount: (item.quantity * item.price_per_item * (1 - item.discount / 100) * item.tax) / 100,
      discount: {
        discount_percentage: item.discount,
        discount_amount: (item.quantity * item.price_per_item * item.discount) / 100,
      },
      tax: {
        tax_percentage: item.tax,
        tax_amount: (item.quantity * item.price_per_item * (1 - item.discount / 100) * item.tax) / 100,
      },
      total_price: item.amount,
      measuring_unit_id: item.measuring_unit_id,
    }));
  }

  try {
    const response = await axios.put(`${API_URL}/quotations/${id}`, payload, {
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
    // console.error('Error updating quotation:', error);

    let errorMessage = 'Failed to update quotation';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to the server. Please check your internet connection.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Quotation not found.';
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

export const deleteQuotation = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: 'Authentication required. Please log in again.',
      status: 401
    };
  }

  try {
    const response = await axios.delete(`${API_URL}/quotations/${id}`, {
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
    // console.error('Error deleting quotation:', error);

    let errorMessage = 'Failed to delete quotation';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.response?.status === 404) {
      errorMessage = 'Quotation not found.';
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

// Quotation Items API functions matching backend implementation
export const fetchQuotationItems = async (params: {
  page?: number;
  items_per_page?: number;
  query?: string;
  quotation_id?: string;
  item_id?: string;
  sort?: string;
  order?: string;
  dropdown?: boolean;
} = {}): Promise<QuotationItemsResponse> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const queryParams = new URLSearchParams();
    
    // Add pagination
    if (params.page) queryParams.append('page', String(params.page));
    if (params.items_per_page) queryParams.append('items_per_page', String(params.items_per_page));
    
    // Add filters
    if (params.query) queryParams.append('query', params.query);
    if (params.quotation_id) queryParams.append('quotation_id', params.quotation_id);
    if (params.item_id) queryParams.append('item_id', params.item_id);
    
    // Add sorting
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.order) queryParams.append('order', params.order);
    
    // For dropdowns
    if (params.dropdown) queryParams.append('dropdown', 'true');
    
    const response = await fetch(`${API_URL}/quotation-items?${queryParams}`, {
      headers
    });
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    // console.error('Error fetching quotation items:', error);
    throw error;
  }
};

// For dropdowns (like in forms)
export const fetchQuotationItemsDropdown = async () => {
  try {
    const items = await fetchQuotationItems({ dropdown: true });
    return items; // Returns simplified array: [{ uuid, item_name, quantity, unit_price }]
  } catch (error) {
    // console.error('Error fetching quotation items dropdown:', error);
    return [];
  }
};

export const getSuggestions = async (
  type: 'party_name' | 'quotation_number',
  query: string
): Promise<{ success: boolean; data: string[] }> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, data: [] };
  }

  try {
    const response = await axios.get(`${API_URL}/quotations/suggestions`, {
      params: { type, q: query },
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      data: response.data.data || []
    };
  } catch (error: any) {
    console.error('Error fetching suggestions:', error);
    return { success: false, data: [] };
  }
};
