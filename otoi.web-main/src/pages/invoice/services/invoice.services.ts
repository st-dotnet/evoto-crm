import axios from 'axios';

const API_URL = import.meta.env.VITE_APP_API_URL;

interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    status?: number;
    message?: string;
}

// Frontend InvoiceItem structure
interface InvoiceItem {
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

// Frontend InvoiceData structure
interface InvoiceData {
    invoiceNo?: string;
    invoiceDate: string;
    dueDate: string;
    status: string;
    selectedCustomer: any;
    invoiceItems: InvoiceItem[];
    notes?: string;
    terms?: string;
    payment_terms?: string;
    total_amount: number;
    subtotal: number;
    total_discount: number;
    total_tax: number;
    additional_charges?: number;
    round_off?: number;
    amount_paid?: number;
    quotation_id?: string;
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

export const createInvoice = async (invoiceData: InvoiceData): Promise<ApiResponse> => {
    const token = getAuthToken();

    if (!token) {
        return {
            success: false,
            error: 'Authentication required. Please log in again.',
            status: 401
        };
    }

    // Transform frontend data to match backend model structure
    const payload = {
        // Core fields
        invoice_number: invoiceData.invoiceNo || undefined,
        business_id: getBusinessId(),
        customer_id: invoiceData.selectedCustomer.uuid,
        quotation_id: invoiceData.quotation_id || null,
        invoice_date: invoiceData.invoiceDate,
        due_date: invoiceData.dueDate,

        // Financial totals
        total_amount: invoiceData.total_amount,
        subtotal: invoiceData.subtotal,
        total_tax: invoiceData.total_tax,
        total_discount: invoiceData.total_discount,
        additional_charges_total: invoiceData.additional_charges || 0,
        round_off: invoiceData.round_off || 0,
        amount_paid: invoiceData.amount_paid || 0,

        // Status
        status: invoiceData.status || 'draft',

        // Notes
        notes: invoiceData.notes || '',
        terms_and_conditions: invoiceData.terms || '',
        payment_terms: invoiceData.payment_terms || '',

        // Items
        items: invoiceData.invoiceItems.map(item => ({
            item_id: item.item_id,
            description: item.description || null,
            quantity: item.quantity,
            unit_price: item.price_per_item,
            discount_percentage: item.discount,
            discount_amount: (item.quantity * item.price_per_item * item.discount) / 100,
            tax_percentage: item.tax,
            tax_amount: (item.quantity * item.price_per_item * (1 - item.discount / 100) * item.tax) / 100,
            total_price: item.amount,
        })),
    };

    try {
        const response = await axios.post(`${API_URL}/invoices`, payload, {
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
        console.error('Error creating invoice:', error);

        let errorMessage = 'Failed to create invoice';
        if (error.code === 'ERR_NETWORK') {
            errorMessage = 'Unable to connect to the server. Please check your internet connection.';
        } else if (error.response) {
            if (error.response.status === 400) {
                errorMessage = error.response.data?.error || error.response.data?.message || 'Invalid invoice data provided';
            } else if (error.response.status === 401) {
                errorMessage = 'Session expired. Please log in again.';
            } else if (error.response.status === 403) {
                errorMessage = 'You do not have permission to create invoices.';
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

export const getInvoices = async (
    search = '',
    page = 1,
    limit = 10
): Promise<ApiResponse> => {
    const token = getAuthToken();
    if (!token) {
        return { success: false, error: 'Authentication required', status: 401 };
    }

    try {
        const params = new URLSearchParams({
            search,
            page: String(page),
            limit: String(limit),
        });

        const response = await axios.get(
            `${API_URL}/invoices?${params.toString()}`,
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
        console.error('Error fetching invoices:', error);
        return {
            success: false,
            error: error.response?.data?.message || 'Failed to fetch invoices',
            status: error.response?.status || 500,
        };
    }
};

export const getInvoiceById = async (id: string): Promise<ApiResponse> => {
    const token = getAuthToken();
    if (!token) {
        return {
            success: false,
            error: 'Authentication required. Please log in again.',
            status: 401
        };
    }

    try {
        const response = await axios.get(`${API_URL}/invoices/${id}`, {
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
            subtotal: data.charges?.subtotal || 0,
            tax_total: data.charges?.tax_total || 0,
            discount_total: data.charges?.discount_total || 0,
            additional_charges_total: data.charges?.additional_charges_total || 0,
            round_off: data.charges?.round_off || 0,
            notes: data.additional_notes?.notes || '',
            terms_and_conditions: data.additional_notes?.terms_and_conditions || '',
            payment_terms: data.additional_notes?.payment_terms || '',
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
        console.error('Error fetching invoice:', error);

        let errorMessage = 'Failed to fetch invoice';
        if (error.code === 'ERR_NETWORK') {
            errorMessage = 'Unable to connect to the server. Please check your internet connection.';
        } else if (error.response?.status === 404) {
            errorMessage = 'Invoice not found.';
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

export const updateInvoice = async (id: string, invoiceData: Partial<InvoiceData>): Promise<ApiResponse> => {
    const token = getAuthToken();
    if (!token) {
        return {
            success: false,
            error: 'Authentication required. Please log in again.',
            status: 401
        };
    }

    const payload: any = {
        business_id: getBusinessId(),
    };

    if (invoiceData.invoiceDate) payload.invoice_date = invoiceData.invoiceDate;
    if (invoiceData.dueDate) payload.due_date = invoiceData.dueDate;
    if (invoiceData.total_amount !== undefined) payload.total_amount = invoiceData.total_amount;
    if (invoiceData.status) payload.status = invoiceData.status;

    if (
        invoiceData.subtotal !== undefined ||
        invoiceData.total_tax !== undefined ||
        invoiceData.total_discount !== undefined ||
        invoiceData.additional_charges !== undefined ||
        invoiceData.round_off !== undefined
    ) {
        payload.charges = {
            subtotal: invoiceData.subtotal ?? 0,
            tax_total: invoiceData.total_tax ?? 0,
            discount_total: invoiceData.total_discount ?? 0,
            additional_charges_total: invoiceData.additional_charges ?? 0,
            round_off: invoiceData.round_off ?? 0,
        };
    }

    if (invoiceData.notes !== undefined || invoiceData.terms !== undefined || invoiceData.payment_terms !== undefined) {
        payload.additional_notes = {
            notes: invoiceData.notes ?? "",
            terms_and_conditions: invoiceData.terms ?? "",
            payment_terms: invoiceData.payment_terms ?? "",
            version: 1,
        };
    }

    if (invoiceData.amount_paid !== undefined) payload.amount_paid = invoiceData.amount_paid;

    if (invoiceData.invoiceItems) {
        payload.items = invoiceData.invoiceItems.map(item => ({
            uuid: item.id,
            item_id: item.item_id,
            product_name: item.item_name,
            description: item.description || null,
            quantity: item.quantity,
            unit_price: item.price_per_item,
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
        const response = await axios.put(`${API_URL}/invoices/${id}`, payload, {
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
        console.error('Error updating invoice:', error);

        let errorMessage = 'Failed to update invoice';
        if (error.code === 'ERR_NETWORK') {
            errorMessage = 'Unable to connect to the server. Please check your internet connection.';
        } else if (error.response?.status === 404) {
            errorMessage = 'Invoice not found.';
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

export const getInvoiceByQuotationId = async (quotationId: string): Promise<ApiResponse> => {
    const token = getAuthToken();
    if (!token) {
        return {
            success: false,
            error: 'Authentication required. Please log in again.',
            status: 401
        };
    }

    try {
        const params = new URLSearchParams({
            quotation_id: quotationId,
            page: "1",
            limit: "1",
        });
        const response = await axios.get(`${API_URL}/invoices?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            withCredentials: false
        });

        const invoices = response.data?.data || response.data || [];
        const invoice = Array.isArray(invoices) ? invoices[0] : invoices;

        return {
            success: true,
            data: invoice || null,
            status: response.status
        };
    } catch (error: any) {
        console.error('Error fetching invoice by quotation:', error);
        return {
            success: false,
            error: error.response?.data?.message || 'Failed to fetch linked invoice',
            status: error.response?.status || 500
        };
    }
};

export const updateInvoiceFromQuotation = async (quotationId: string, quotationData: any): Promise<ApiResponse> => {
    const linkedInvoice = await getInvoiceByQuotationId(quotationId);
    if (!linkedInvoice.success) {
        return linkedInvoice;
    }
    if (!linkedInvoice.data) {
        return { success: true, data: null, status: 200, message: 'No linked invoice found' };
    }

    const invoiceId = linkedInvoice.data.uuid || linkedInvoice.data.id;
    const payload: any = {
        business_id: getBusinessId(),
        quotation_id: quotationId,
        customer_id: quotationData.selectedCustomer?.uuid || linkedInvoice.data.customer_id,
        invoice_date: linkedInvoice.data.invoice_date || linkedInvoice.data.invoiceDate,
        due_date: linkedInvoice.data.due_date || linkedInvoice.data.dueDate,
        status: linkedInvoice.data.status || quotationData.status || 'draft',
        total_amount: quotationData.total_amount,
        charges: {
            subtotal: quotationData.subtotal ?? 0,
            discount_total: quotationData.total_discount ?? 0,
            tax_total: quotationData.total_tax ?? 0,
            additional_charges_total: quotationData.additional_charges ?? 0,
            round_off: quotationData.round_off ?? 0,
        },
        additional_notes: {
            notes: quotationData.notes ?? "",
            terms_and_conditions: quotationData.terms ?? "",
            payment_terms: linkedInvoice.data.payment_terms || linkedInvoice.data.additional_notes?.payment_terms || "",
            version: 1,
        },
        items: (quotationData.quotationItems || []).map((item: any) => ({
            uuid: item.id,
            item_id: item.item_id,
            product_name: item.item_name,
            description: item.description || null,
            quantity: item.quantity,
            unit_price: item.price_per_item,
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
        })),
    };

    try {
        const response = await axios.put(`${API_URL}/invoices/${invoiceId}`, payload, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
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
        console.error('Error updating linked invoice:', error);
        return {
            success: false,
            error: error.response?.data?.message || 'Failed to update linked invoice',
            status: error.response?.status || 500
        };
    }
};

export const deleteInvoice = async (id: string): Promise<ApiResponse> => {
    const token = getAuthToken();
    if (!token) {
        return {
            success: false,
            error: 'Authentication required. Please log in again.',
            status: 401
        };
    }

    try {
        const response = await axios.delete(`${API_URL}/invoices/${id}`, {
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
        console.error('Error deleting invoice:', error);

        let errorMessage = 'Failed to delete invoice';
        if (error.code === 'ERR_NETWORK') {
            errorMessage = 'Unable to connect to the server. Please check your internet connection.';
        } else if (error.response?.status === 404) {
            errorMessage = 'Invoice not found.';
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

export const createInvoiceFromQuotation = async (quotationId: string): Promise<ApiResponse> => {
    const token = getAuthToken();
    if (!token) {
        return {
            success: false,
            error: 'Authentication required. Please log in again.',
            status: 401
        };
    }

    try {
        const response = await axios.post(`${API_URL}/invoices/from-quotation/${quotationId}`, {}, {
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
        console.error('Error creating invoice from quotation:', error);

        let errorMessage = 'Failed to create invoice from quotation';
        if (error.response?.status === 404) {
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

export const recordPayment = async (invoiceId: string, amount: number, paymentMethod?: string, reference?: string): Promise<ApiResponse> => {
    const token = getAuthToken();
    if (!token) {
        return {
            success: false,
            error: 'Authentication required. Please log in again.',
            status: 401
        };
    }

    try {
        const response = await axios.post(`${API_URL}/invoices/${invoiceId}/record-payment`, {
            amount,
            payment_method: paymentMethod,
            reference,
        }, {
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
        console.error('Error recording payment:', error);

        let errorMessage = 'Failed to record payment';
        if (error.response?.status === 400) {
            errorMessage = error.response.data?.error || 'Invalid payment amount';
        } else if (error.response?.status === 404) {
            errorMessage = 'Invoice not found.';
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
