import axios, { AxiosError } from "axios";

const API_URL = import.meta.env.VITE_APP_API_URL;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
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
    console.error("Error parsing auth data:", error);
    return null;
  }
};

export const getCustomerById = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    const response = await axios.get(`${API_URL}/customers/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      withCredentials: true,
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    console.error("Error fetching customer:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      responseData: error.response?.data,
    });

    let errorMessage = "Failed to fetch customer";
    if (error.code === "ERR_NETWORK") {
      errorMessage =
        "Unable to connect to the server. Please check your internet connection.";
    } else if (error.response) {
      if (error.response.status === 401) {
        errorMessage = "Session expired. Please log in again.";
      } else if (error.response.status === 404) {
        errorMessage = "Customer not found.";
      } else if (error.response.data?.message) {
        errorMessage = error.response.data.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
      status: error.response?.status || 500,
    };
  }
};

export const getCustomers = async (
  search = "",
  page = 1,
  limit = 5,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  if (search) params.set("search", search);

  try {
    const response = await axios.get(
      `${API_URL}/customers/?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      },
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    console.error("Error fetching customers:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      responseData: error.response?.data,
    });

    let errorMessage = "Failed to fetch customers";
    if (error.code === "ERR_NETWORK") {
      errorMessage =
        "Unable to connect to the server. Please check your internet connection.";
    } else if (error.response?.status === 401) {
      errorMessage = "Session expired. Please log in again.";
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }

    return {
      success: false,
      error: errorMessage,
      status: error.response?.status || 500,
    };
  }
};

export const createCustomer = async (payload: any): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    const response = await axios.post(`${API_URL}/customers/`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      withCredentials: true,
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    console.error("Error creating customer:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      responseData: error.response?.data,
    });

    let errorMessage = "Failed to create customer";
    if (error.code === "ERR_NETWORK") {
      errorMessage =
        "Unable to connect to the server. Please check your internet connection.";
    } else if (error.response) {
      if (
        error.response.status === 400 &&
        error.response.data?.message?.includes("already exists")
      ) {
        errorMessage = "A customer with these details already exists.";
      } else if (error.response.status === 401) {
        errorMessage = "Session expired. Please log in again.";
      } else if (error.response.data?.message) {
        errorMessage = error.response.data.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
      status: error.response?.status || 500,
    };
  }
};

export const updateCustomer = async (
  id: string,
  payload: any,
): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  // Clean up the payload by removing undefined or empty strings
  const cleanPayload = Object.entries(payload).reduce(
    (acc, [key, value]) => {
      if (value !== undefined && value !== "") {
        acc[key] = value;
      } else {
        acc[key] = null;
      }
      return acc;
    },
    {} as Record<string, any>,
  );

  try {
    const response = await axios.put(
      `${API_URL}/customers/${id}`,
      cleanPayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        withCredentials: true,
        timeout: 10000,
      },
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    console.error("Error updating customer:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      responseData: error.response?.data,
    });

    let errorMessage = "Failed to update customer";
    if (error.code === "ERR_NETWORK") {
      errorMessage =
        "Unable to connect to the server. Please check your internet connection.";
    } else if (error.response) {
      if (
        error.response.status === 400 &&
        error.response.data?.message?.includes("already exists")
      ) {
        errorMessage = "A customer with these details already exists.";
      } else if (error.response.status === 401) {
        errorMessage = "Session expired. Please log in again.";
      } else if (error.response.status === 404) {
        errorMessage = "Customer not found.";
      } else if (error.response.data?.message) {
        errorMessage = error.response.data.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
      status: error.response?.status || 500,
    };
  }
};

export const deleteCustomer = async (id: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    const response = await axios.delete(`${API_URL}/customers/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      withCredentials: true,
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    console.error("Error deleting customer:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      responseData: error.response?.data,
    });

    let errorMessage = "Failed to delete customer";
    if (error.code === "ERR_NETWORK") {
      errorMessage =
        "Unable to connect to the server. Please check your internet connection.";
    } else if (error.response?.status === 401) {
      errorMessage = "Session expired. Please log in again.";
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }

    return {
      success: false,
      error: errorMessage,
      status: error.response?.status || 500,
    };
  }
};

// Export all functions as default for easier imports
// Shipping Address Functions
export const updateCustomerShippingAddresses = async (
  customerId: string,
  addresses: any[],
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
      `${API_URL}/customers/${customerId}/shipping-addresses`,
      { addresses },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      },
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    console.error("Error updating shipping addresses:", error);
    return {
      success: false,
      error:
        error.response?.data?.message || "Failed to update shipping addresses",
      status: error.response?.status,
    };
  }
};

export default {
  getCustomerById,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  updateCustomerShippingAddresses,
};
