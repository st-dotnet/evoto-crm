import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_URL;

export interface PurchaseInvoiceSummary {
  uuid: string;
  invoice_number: string;
  purchase_order_id: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  payment_status: "unpaid" | "partial" | "paid";
  inventory_updated: boolean;
  created_at: string | null;
}

export interface PurchaseInvoiceDetail extends PurchaseInvoiceSummary {
  charges: Record<string, number>;
  payment_mode: string | null;
  additional_notes: { notes?: string; terms_and_conditions?: string };
  vendor: {
    uuid: string;
    vendor_name: string;
    company_name?: string;
    mobile: string;
    email?: string;
    gst?: string;
    address1?: string;
    city?: string;
    state?: string;
    country?: string;
    pin?: string;
  } | null;
  items: {
    uuid: string;
    item_id: string | null;
    product_name?: string;
    description: string | null;
    quantity: number;
    unit_price: number;
    discount: { discount_percentage?: number; discount_amount?: number };
    tax: { tax_percentage?: number; tax_amount?: number };
    total_price: number;
    hsn_sac_code?: string;
    measuring_unit_id?: number;
  }[];
  updated_at: string | null;
}

/** Convert a PO to a Purchase Invoice (payment_status = "unpaid"). */
export const createPurchaseInvoiceFromPO = async (
  poId: string,
  payload?: { invoice_date?: string; due_date?: string; notes?: string }
) => {
  try {
    const res = await axios.post(
      `${API_URL}/purchase-invoices/from-po/${poId}`,
      payload || {}
    );
    return { success: true, data: res.data };
  } catch (err: any) {
    const errData = err?.response?.data;
    return { success: false, error: errData?.error || "Failed to create purchase invoice", data: errData };
  }
};

/** Create a standalone purchase invoice. */
export const createPurchaseInvoice = async (payload: any) => {
  try {
    const res = await axios.post(`${API_URL}/purchase-invoices/`, payload);
    return { success: true, data: res.data };
  } catch (err: any) {
    const errData = err?.response?.data;
    return { success: false, error: errData?.error || "Failed to create purchase invoice", data: errData };
  }
};

/** List purchase invoices (paginated). */
export const listPurchaseInvoices = async (params: {
  page?: number;
  per_page?: number;
  search?: string;
  vendor_name?: string;
  invoice_number?: string;
  payment_status?: string;
}) => {
  try {
    const res = await axios.get(`${API_URL}/purchase-invoices/`, { params });
    return { success: true, data: res.data };
  } catch (err: any) {
    return { success: false, error: err?.response?.data?.error || "Failed to fetch purchase invoices" };
  }
};

/** Get a single purchase invoice by UUID. */
export const getPurchaseInvoiceById = async (invoiceId: string) => {
  try {
    const res = await axios.get(`${API_URL}/purchase-invoices/${invoiceId}`);
    return { success: true, data: res.data as PurchaseInvoiceDetail };
  } catch (err: any) {
    return { success: false, error: err?.response?.data?.error || "Failed to fetch purchase invoice" };
  }
};

/**
 * Record a payment for a purchase invoice.
 * When fully paid, the backend automatically increments inventory stock.
 */
export const recordPurchaseInvoicePayment = async (
  invoiceId: string,
  payload: { amount: number; payment_mode?: string; notes?: string }
) => {
  try {
    const res = await axios.post(
      `${API_URL}/purchase-invoices/${invoiceId}/record-payment`,
      payload
    );
    return { success: true, data: res.data };
  } catch (err: any) {
    const errData = err?.response?.data;
    return { success: false, error: errData?.error || "Failed to record payment", details: errData?.details };
  }
};

/** Soft-delete a purchase invoice. */
export const deletePurchaseInvoice = async (invoiceId: string) => {
  try {
    const res = await axios.put(`${API_URL}/purchase-invoices/${invoiceId}/delete`);
    return { success: true, data: res.data };
  } catch (err: any) {
    return { success: false, error: err?.response?.data?.error || "Failed to delete purchase invoice" };
  }
};
