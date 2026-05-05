import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_URL;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  message?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  item_code: string;
  mrp: number;
  selling_price: number;
  stock: number;
  category: string;
  description?: string;
  hsn_sac_code?: string;
  measuring_unit?: string;
  created_at?: string;
  updated_at?: string;
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

export const getInventoryItems = async (params?: {
  search?: string;
  category?: string;
  item_code?: string;
  page?: number;
  items_per_page?: number;
  sort?: string;
  order?: string;
}): Promise<ApiResponse<InventoryItem[]>> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  try {
    const queryParams = new URLSearchParams();

    // Add search parameters
    if (params?.search) queryParams.append("search", params.search);
    if (params?.category) queryParams.append("category", params.category);
    if (params?.item_code) queryParams.append("item_code", params.item_code);

    // Add pagination parameters - set high items_per_page to get all items without pagination
    queryParams.append("page", String(params?.page || 1));
    queryParams.append("items_per_page", String(params?.items_per_page || 1000));

    // Add sorting parameters
    if (params?.sort) queryParams.append("sort", params.sort);
    if (params?.order) queryParams.append("order", params.order || "asc");

    // Add business_id filter
    const businessId = getBusinessId();
    if (businessId) {
      queryParams.append("business_id", String(businessId));
    }

    const response = await axios.get(
      `${API_URL}/items?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    // Handle different response structures
    let inventoryItems: InventoryItem[] = [];
    
    if (response.data?.data?.items) {
      inventoryItems = response.data.data.items;
    } else if (response.data?.items) {
      inventoryItems = response.data.items;
    } else if (response.data?.data) {
      inventoryItems = response.data.data;
    } else if (Array.isArray(response.data)) {
      inventoryItems = response.data;
    }

    // Transform data to match frontend interface
    const transformedItems = inventoryItems.map((item: any) => {
      const transformed = {
        id: item.id || item.uuid,
        name: item.name || item.item_name,
        item_code: item.item_code || item.itemCode || item.code,
        mrp: item.mrp || item.mrp_price || item.purchase_price || 0,
        selling_price: item.sales_price || item.selling_price || item.price || 0,
        stock: item.stock || item.quantity || item.opening_stock || 0,
        category: item.category || item.category_name || "Uncategorized",
        description: item.description || null,
        hsn_sac_code: item.hsn_code || item.hsn_sac || null,
        measuring_unit: item.measuring_unit || item.unit || null,
        created_at: item.created_at || item.createdAt,
        updated_at: item.updated_at || item.updatedAt,
      };
      return transformed;
    });

    return {
      success: true,
      data: transformedItems,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = "Failed to fetch inventory items";
    if (error.code === "ERR_NETWORK") {
      errorMessage = "Unable to connect to server. Please check your internet connection.";
    } else if (error.response?.status === 401) {
      errorMessage = "Session expired. Please log in again.";
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
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

export const getInventoryCategories = async (): Promise<ApiResponse<string[]>> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  try {
    const response = await axios.get(
      `${API_URL}/items/categories`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    let categories: string[] = [];
    
    if (response.data?.data?.categories) {
      categories = response.data.data.categories;
    } else if (response.data?.categories) {
      categories = response.data.categories;
    } else if (Array.isArray(response.data)) {
      categories = response.data;
    }

    return {
      success: true,
      data: categories,
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch categories",
      status: error?.response?.status || 500,
    };
  }
};

export const exportInventoryToExcel = async (params?: {
  search?: string;
}): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  try {
    const queryParams = new URLSearchParams();
    
    if (params?.search) queryParams.append("search", params.search);

    // Add business_id filter - backend might still require it
    const businessId = getBusinessId();
    if (businessId) {
      queryParams.append("business_id", String(businessId));
    }

    // Use full API URL with authentication
    const url = `${API_URL}/items/export/excel?${queryParams.toString()}`;
    
    // Create authenticated download link
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    
    // Add authentication via fetch and blob
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .then(response => response.blob())
    .then(blob => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.URL.revokeObjectURL(downloadUrl);
    });

    return {
      success: true,
      data: "Export completed successfully",
      status: 200,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to export inventory",
      status: 500,
    };
  }
};

export const printInventoryPDF = async (params?: {
  search?: string;
  category?: string;
}): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  try {
    const businessId = getBusinessId();

    const payload = {
      search: params?.search,
      category: params?.category,
      business_id: businessId,
    };

    const response = await axios.post(
      `${API_URL}/items/export/pdf`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        responseType: 'blob',
      },
    );

    // Download PDF file
    const downloadUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.setAttribute('download', `inventory_report_${new Date().toISOString().split('T')[0]}.pdf`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.URL.revokeObjectURL(downloadUrl);

    return {
      success: true,
      data: "PDF downloaded successfully",
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || "Failed to generate PDF",
      status: error?.response?.status || 500,
    };
  }
};

export const printInventoryForPrint = async (params?: {
  search?: string;
  category?: string;
}): Promise<ApiResponse> => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params?.search) queryParams.append("search", params.search);
    if (params?.category) queryParams.append("category", params.category);

    // Add business_id filter
    const businessId = getBusinessId();
    if (businessId) {
      queryParams.append("business_id", String(businessId));
    }

    // Call the public print endpoint - no auth required
    const response = await axios.get(
      `${API_URL}/items/export/print-pdf?${queryParams.toString()}`,
      {
        responseType: 'blob',
      },
    );

    // Download PDF file
    const downloadUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.setAttribute('download', `inventory_print_version_${new Date().toISOString().split('T')[0]}.pdf`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.URL.revokeObjectURL(downloadUrl);

    return {
      success: true,
      data: "PDF downloaded successfully",
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || "Failed to generate print PDF",
      status: error?.response?.status || 500,
    };
  }
};

export const emailInventoryReport = async (params?: {
  search?: string;
  category?: string;
  email?: string;
}): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  try {
    const businessId = getBusinessId();
    
    const payload = {
      search: params?.search,
      category: params?.category,
      email: params?.email,
      business_id: businessId,
    };

    const response = await axios.post(
      `${API_URL}/items/email-report`,
      payload,
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
      error: error.response?.data?.message || "Failed to email report",
      status: error?.response?.status || 500,
    };
  }
};
