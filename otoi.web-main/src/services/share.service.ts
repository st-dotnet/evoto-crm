import axios from 'axios';

const API_URL = import.meta.env.VITE_APP_API_URL;

export interface ShareData {
    invoiceNumber: string;
    totalAmount: number;
    pdfUrl: string;
    message?: string;
    contact?: {
        name: string;
        email: string;
        mobile: string;
    } | null;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
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

export const getShareData = async (uuid: string, type: 'invoice' | 'quotation' | 'purchase_order' | 'purchase_invoice'): Promise<ApiResponse<ShareData>> => {
    const token = getAuthToken();
    try {
        const response = await axios.get(`${API_URL}/share-data/${uuid}?type=${type}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error: any) {
        return {
            success: false,
            error: error.response?.data?.error || "Failed to fetch share data"
        };
    }
};

export const sendShareEmail = async (uuid: string, type: string, email?: string): Promise<ApiResponse<any>> => {
    const token = getAuthToken();
    try {
        const response = await axios.post(`${API_URL}/share-data/send-email`, {
            uuid,
            type,
            email
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error: any) {
        return {
            success: false,
            error: error.response?.data?.error || "Failed to send email"
        };
    }
};

export const logShareActivity = async (payload: { uuid: string; type: string; channel: 'whatsapp' | 'email' }) => {
    const token = getAuthToken();
    try {
        await axios.post(`${API_URL}/share-data/log`, payload, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    } catch (error) {
        console.error("Failed to log share activity:", error);
    }
};
