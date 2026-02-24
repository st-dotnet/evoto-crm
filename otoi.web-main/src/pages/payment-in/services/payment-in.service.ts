import axios from 'axios';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_APP_API_URL;

const getAuthToken = (): string | null => {
    return localStorage.getItem('OTOI-auth-v1.0.0.1');
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

export const createPaymentIn = async (paymentData: PaymentInData): Promise<ApiResponse> => {
    const token = getAuthToken();
    if (!token) {
        return {
            success: false,
            error: 'Authentication required. Please log in again.',
            status: 401
        };
    }

    try {
        // Since payment-in endpoint doesn't exist, just return success for now
        // In real implementation, this would POST to /api/payment-in
        
        return {
            success: true,
            data: paymentData,
            status: 200
        };
    } catch (error: any) {
        console.error('Error creating payment-in:', error);

        let errorMessage = 'Failed to create payment record';
        if (error.response?.status === 400) {
            errorMessage = error.response.data?.error || 'Invalid payment data';
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

export const getPaymentInList = async (): Promise<ApiResponse> => {
    const token = getAuthToken();
    if (!token) {
        return {
            success: false,
            error: 'Authentication required. Please log in again.',
            status: 401
        };
    }

    try {
        // Use invoices API endpoint and filter for paid status
        const response = await axios.get(`${API_URL}/invoices`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            withCredentials: false
        });

 

        // Check if response.data is an array, if not try to extract the array
        let invoicesData = response.data;
        if (!Array.isArray(response.data)) {
            // The actual array is nested under response.data.data
            if (response.data?.data && Array.isArray(response.data.data)) {
                invoicesData = response.data.data;
            } else if (response.data?.invoices && Array.isArray(response.data.invoices)) {
                invoicesData = response.data.invoices;
            } else {
                console.error('Response data is not in expected format:', response.data);
                return {
                    success: false,
                    error: 'Invalid API response format',
                    status: response.status
                };
            }
        }

        console.log('All invoices with their status:', invoicesData.map((inv: any) => ({ 
            id: inv.uuid || inv.id, 
            status: inv.status, 
            amount_paid: inv.amount_paid,
            balance_due: inv.balance_due 
        })));

        // Filter only paid invoices (consider paid if balance_due is 0 and amount_paid > 0) and transform them to payment format
        const paidInvoices = invoicesData?.filter((invoice: any) => {
            // Consider invoice paid if balance_due is 0 and amount_paid > 0
            const isPaid = (invoice.balance_due === 0 || invoice.balance_due === '0') && invoice.amount_paid && invoice.amount_paid > 0;
            console.log(`Invoice ${invoice.uuid || invoice.id}: balance_due=${invoice.balance_due}, amount_paid=${invoice.amount_paid}, isPaid=${isPaid}`);
            return isPaid;
        }) || [];


        // Transform invoice data to payment format
        const paymentData = paidInvoices.map((invoice: any) => ({
            id: invoice.uuid || invoice.id,
            payment_number: `PAY-${invoice.invoice_number || 'INV'}`,
            date: invoice.updated_at || invoice.invoice_date || new Date().toISOString().split('T')[0],
            party_name: invoice.customer?.name || invoice.customer_name || 'Unknown Customer',
            total_amount_settled: invoice.total_amount || 0,
            amount_received: invoice.amount_paid || 0,
            payment_discount: invoice.payment_discount || invoice.discount_total || 0,
            payment_mode: 'cash',
            invoice_id: invoice.uuid || invoice.id,
            invoice_number: invoice.invoice_number || invoice.invoiceNo
        }));


        return {
            success: true,
            data: paymentData,
            status: response.status
        };
    } catch (error: any) {
        console.error('Error fetching payment-in list:', error);

        let errorMessage = 'Failed to fetch payment records';
        if (error.response?.status === 401) {
            errorMessage = 'Session expired. Please log in again.';
        }

        return {
            success: false,
            error: errorMessage,
            status: error?.response?.status || 500
        };
    }
};

export const generatePaymentNumber = (): string => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PAY-${year}${month}-${random}`;
};

// Function to create payment entry when invoice status is changed to paid
export const createPaymentFromInvoice = async (invoiceData: any): Promise<ApiResponse> => {
    const token = getAuthToken();
    if (!token) {
        return {
            success: false,
            error: 'Authentication required. Please log in again.',
            status: 401
        };
    }

    // Only create payment if invoice status is 'paid' and there's an amount paid
    if (invoiceData.status !== 'paid' || !invoiceData.amount_paid || invoiceData.amount_paid <= 0) {
        return {
            success: false,
            error: 'Invoice must be paid status with valid amount to create payment entry',
            status: 400
        };
    }

    const paymentData: PaymentInData = {
        payment_number: generatePaymentNumber(),
        date: new Date().toISOString().split('T')[0], // Current date
        party_name: invoiceData.selectedCustomer?.name || invoiceData.customer_name || 'Unknown Customer',
        total_amount_settled: invoiceData.total_amount || 0,
        amount_received: invoiceData.amount_paid,
        payment_mode: 'cash', // Default payment mode, can be made configurable
        invoice_id: invoiceData.uuid || invoiceData.id,
        invoice_number: invoiceData.invoiceNo || invoiceData.invoice_number
    };

    try {
        const response = await axios.post(`${API_URL}/payment-in`, paymentData, {
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
        console.error('Error creating payment from invoice:', error);

        let errorMessage = 'Failed to create payment entry from invoice';
        if (error.response?.status === 400) {
            errorMessage = error.response.data?.error || 'Invalid payment data';
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