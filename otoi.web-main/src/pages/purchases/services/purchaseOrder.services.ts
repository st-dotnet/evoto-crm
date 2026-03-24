import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_URL;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  message?: string;
}

// Frontend PurchaseOrderItem structure
export interface PurchaseOrderItem {
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
  product_image?: string | null;
}

// Frontend PurchaseOrderData structure
export interface PurchaseOrderData {
  poNo: string;
  poDate: string;
  deliveryDate: string;
  status: string;
  selectedVendor: any;
  poItems: PurchaseOrderItem[];
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

const getBusinessId = (): number => {
  try {
    const authData = localStorage.getItem("OTOI-auth-v1.0.0.1");
    if (!authData) return 1;
    const parsedAuth = JSON.parse(authData);
    return parsedAuth.business_id || parsedAuth.businessId || 1;
  } catch {
    return 1;
  }
};

// ─── CREATE ─────────────────────────────────────────────────────────────────

export const createPurchaseOrder = async (
  data: PurchaseOrderData,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };

  const payload = {
    po_number: data.poNo || undefined,
    business_id: getBusinessId(),
    vendor_id: data.selectedVendor?.uuid,
    po_date: data.poDate,
    delivery_date: data.deliveryDate,
    total_amount: data.total_amount,
    subtotal: data.subtotal,
    total_tax: data.total_tax,
    total_discount: data.total_discount,
    additional_charges_total: data.additional_charges || 0,
    round_off: data.round_off || 0,
    status: data.status || "open",
    notes: data.notes || "",
    terms_and_conditions: data.terms || "",
    items: data.poItems.map((item) => ({
      item_id: item.item_id,
      description: item.description || null,
      quantity: item.quantity,
      unit_price: item.price_per_item,
      discount: item.discount,
      discount_amount:
        (item.quantity * item.price_per_item * item.discount) / 100,
      tax: item.tax,
      tax_amount:
        (item.quantity *
          item.price_per_item *
          (1 - item.discount / 100) *
          item.tax) /
        100,
      total_price: item.amount,
    })),
  };

  try {
    const response = await axios.post(`${API_URL}/purchase-orders`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    return { success: true, data: response.data, status: response.status };
  } catch (error: any) {
    let errorMessage = "Failed to create purchase order";
    if (error.code === "ERR_NETWORK")
      errorMessage = "Unable to connect to the server.";
    else if (error.response?.data?.message)
      errorMessage = error.response.data.message;
    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

// ─── READ LIST ───────────────────────────────────────────────────────────────

export const getPurchaseOrders = async (params?: {
  search?: string;
  vendor_name?: string;
  po_number?: string;
  status?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  order?: string;
}): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return { success: false, error: "Authentication required", status: 401 };

  try {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.vendor_name) query.append("vendor_name", params.vendor_name);
    if (params?.po_number) query.append("po_number", params.po_number);
    query.append("status", params?.status || "");
    query.append("page", String(params?.page || 1));
    query.append("per_page", String(params?.per_page || 5));
    if (params?.sort) query.append("sort", params.sort);
    if (params?.order) query.append("order", params.order);

    const response = await axios.get(
      `${API_URL}/purchase-orders?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    return { success: true, data: response.data, status: response.status };
  } catch (error: any) {
    return {
      success: false,
      error:
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to fetch purchase orders",
      status: error.response?.status || 500,
    };
  }
};

// ─── READ ONE ────────────────────────────────────────────────────────────────

export const getPurchaseOrderById = async (
  id: string,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };

  try {
    const response = await axios.get(`${API_URL}/purchase-orders/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = response.data;
    const transformedData = {
      ...data,
      vendor: data.vendor,
      subtotal: data.charges?.subtotal || 0,
      tax_total: data.charges?.tax_total || 0,
      discount_total: data.charges?.discount_total || 0,
      additional_charges_total: data.charges?.additional_charges_total || 0,
      round_off: data.charges?.round_off || 0,
      notes: data.additional_notes?.notes || "",
      terms_and_conditions: data.additional_notes?.terms_and_conditions || "",
      items:
        data.items?.map((item: any) => ({
          ...item,
          discount_percentage: item.discount?.discount_percentage || 0,
          discount_amount: item.discount?.discount_amount || 0,
          tax_percentage: item.tax?.tax_percentage || 0,
          tax_amount: item.tax?.tax_amount || 0,
        })) || [],
    };

    return { success: true, data: transformedData, status: response.status };
  } catch (error: any) {
    let errorMessage = "Failed to fetch purchase order";
    if (error.code === "ERR_NETWORK")
      errorMessage = "Unable to connect to the server.";
    else if (error.response?.status === 404)
      errorMessage = "Purchase order not found.";
    else if (error.response?.status === 401)
      errorMessage = "Session expired. Please log in again.";
    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export const updatePurchaseOrder = async (
  id: string,
  data: Partial<PurchaseOrderData>,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };

  const payload: any = { business_id: getBusinessId() };

  if (data.poNo) payload.po_number = data.poNo;
  if (data.selectedVendor?.uuid) payload.vendor_id = data.selectedVendor.uuid;
  if (data.poDate) payload.po_date = data.poDate;
  if (data.deliveryDate) payload.delivery_date = data.deliveryDate;
  if (data.status) payload.status = data.status;
  if (data.total_amount !== undefined) payload.total_amount = data.total_amount;
  if (data.subtotal !== undefined) payload.subtotal = data.subtotal;
  if (data.total_tax !== undefined) payload.total_tax = data.total_tax;
  if (data.total_discount !== undefined)
    payload.total_discount = data.total_discount;
  if (data.additional_charges !== undefined)
    payload.additional_charges_total = data.additional_charges;
  if (data.round_off !== undefined) payload.round_off = data.round_off;

  if (data.notes !== undefined || data.terms !== undefined) {
    payload.additional_notes = {
      notes: data.notes ?? "",
      terms_and_conditions: data.terms ?? "",
      version: 1,
    };
  }

  if (data.poItems) {
    payload.items = data.poItems.map((item) => ({
      uuid: item.id,
      item_id: item.item_id,
      description: item.description || null,
      quantity: item.quantity,
      unit_price: item.price_per_item,
      discount: item.discount,
      discount_amount:
        (item.quantity * item.price_per_item * item.discount) / 100,
      tax: item.tax,
      tax_amount:
        (item.quantity *
          item.price_per_item *
          (1 - item.discount / 100) *
          item.tax) /
        100,
      total_price: item.amount,
      measuring_unit_id: item.measuring_unit_id,
    }));
  }

  try {
    const response = await axios.put(
      `${API_URL}/purchase-orders/${id}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    return { success: true, data: response.data, status: response.status };
  } catch (error: any) {
    let errorMessage = "Failed to update purchase order";
    if (error.code === "ERR_NETWORK")
      errorMessage = "Unable to connect to the server.";
    else if (error.response?.status === 404)
      errorMessage = "Purchase order not found.";
    else if (error.response?.status === 401)
      errorMessage = "Session expired. Please log in again.";
    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

// ─── DELETE ──────────────────────────────────────────────────────────────────

export const deletePurchaseOrder = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };

  try {
    const response = await axios.delete(`${API_URL}/purchase-orders/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    return { success: true, data: response.data, status: response.status };
  } catch (error: any) {
    let errorMessage = "Failed to delete purchase order";
    if (error.code === "ERR_NETWORK")
      errorMessage = "Unable to connect to server.";
    else if (error.response?.status === 404)
      errorMessage = "Purchase order not found.";
    else if (error.response?.status === 401)
      errorMessage = "Session expired. Please log in again.";
    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

// ─── DROPDOWNS ───────────────────────────────────────────────────────────────

export const getAllVendorsDropdown = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return { success: false, error: "Authentication required", status: 401 };

  try {
    const response = await axios.get(
      `${API_URL}/purchase-orders?vendor_dropdown_all=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
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

export const getPurchaseOrderNumbersDropdown =
  async (): Promise<ApiResponse> => {
    const token = getAuthToken();
    if (!token)
      return { success: false, error: "Authentication required", status: 401 };

    try {
      const response = await axios.get(
        `${API_URL}/purchase-orders/po-dropdown`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      return { success: true, data: response.data, status: response.status };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to fetch PO numbers",
        status: error.response?.status || 500,
      };
    }
  };

// ─── RECENT PRICES ───────────────────────────────────────────────────────────

export const getRecentPurchasePrices = async (
  itemId: string,
  vendorId: string,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token)
    return { success: false, error: "Authentication required", status: 401 };

  try {
    const response = await axios.get(
      `${API_URL}/purchase-orders/recent-prices?item_id=${itemId}&vendor_id=${vendorId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    return { success: true, data: response.data?.data || [], status: response.status };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || "Failed to fetch recent purchase prices",
      status: error.response?.status || 500,
    };
  }
};
