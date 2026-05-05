import axios, { AxiosError } from "axios";
import { ItemsApiResponse } from "../types/items";

const API_URL = import.meta.env.VITE_APP_API_URL;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  message?: string; // Backend returns message in data object
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

export const getItemById = async (id: string): Promise<ApiResponse> => {
  try {
    const response = await axios.get(`${API_URL}/items/${id}`, {
      withCredentials: true,
    });
    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to fetch item",
      status: error.response?.status || 500,
    };
  }
};

export const getItems = async (
  search = "",
  page = 1,
  limit = 10,
): Promise<ItemsApiResponse> => {
  const params = new URLSearchParams({
    search,
    page: String(page),
    limit: String(limit),
  });

  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const response = await axios.get<ItemsApiResponse>(
      `${API_URL}/items/?${params.toString()}`,
      { headers },
    );
    return response.data;
  } catch (error: any) {
    throw error;
  }
};

export const createItem = async (payload: any): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    const isFormData = payload instanceof FormData;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    const response = await axios.post(`${API_URL}/items/`, payload, {
      headers,
      withCredentials: true,
      timeout: 30000,
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.message ||
      error.message ||
      "Failed to create item";

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

export const updateItem = async (
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

  try {
    const isFormData = payload instanceof FormData;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    const response = await axios.patch(`${API_URL}/items/${id}`, payload, {
      headers,
      withCredentials: true,
      timeout: 30000, // Increase timeout for image uploads
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = "Failed to update item";

    if (error.code === "ERR_NETWORK") {
      errorMessage =
        "Unable to connect to the server. Please check your internet connection.";
    }
    // Handle 400 Bad Request
    else if (error.response?.status === 400) {
      const responseData = error.response.data;

      // Handle the error response format from the backend
      if (responseData.details?.item_code?.[0]) {
        errorMessage = responseData.details.item_code[0];
      }
      // Handle other validation errors
      else if (responseData.message) {
        errorMessage = responseData.message;
      }
      // Handle case where error is directly in the response
      else if (responseData.error) {
        errorMessage = responseData.error;
      }
    } else if (error.response) {
      if (error.response.status === 401) {
        errorMessage = "Session expired. Please log in again.";
      } else if (error.response.status === 404) {
        errorMessage = "Item not found.";
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

export const deleteItem = async (id: string) => {
  const token = getAuthToken();
  const response = await axios.delete(`${API_URL}/items/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getItemCategories = async () => {
  const response = await axios.get(
    `${import.meta.env.VITE_APP_API_URL}/item-categories/`,
  );
  return response.data;
};

export const createItemCategory = async (name: string) => {
  const response = await axios.post(
    `${import.meta.env.VITE_APP_API_URL}/item-categories/`,
    { name },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
};

// Barcode service functions
export const getBarcodePreview = async (
  itemCode: string,
  itemName?: string,
) => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    const params = new URLSearchParams({
      item_code: itemCode,
    });

    if (itemName) {
      params.append("item_name", itemName);
    }

    const response = await axios.get(
      `${API_URL}/barcode/preview?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "blob",
      },
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = "Failed to generate barcode preview";

    if (error.response?.data instanceof Blob && error.response.data.type === "application/json") {
      const reader = new FileReader();
      const errorText = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(error.response.data);
      });
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorData.details || errorMessage;
      } catch (e) {
        errorMessage = error.message || errorMessage;
      }
    } else {
      errorMessage = error?.response?.data?.message || error?.response?.data?.error || error.message || errorMessage;
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

export const getItemBarcode = async (itemId: string) => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    const response = await axios.get(`${API_URL}/barcode/${itemId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: "blob",
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = "Failed to get item barcode";

    if (error.response?.data instanceof Blob && error.response.data.type === "application/json") {
      // If we got a JSON error instead of a blob, we need to read it
      const reader = new FileReader();
      const errorText = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(error.response.data);
      });
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorData.details || errorMessage;
      } catch (e) {
        errorMessage = error.message || errorMessage;
      }
    } else {
      errorMessage = error?.response?.data?.message || error?.response?.data?.error || error.message || errorMessage;
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

export const downloadBarcode = async (
  itemId: string,
) => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  if (!itemId) {
    return {
      success: false,
      error: "Item ID is required to download barcode. Please save the item first.",
      status: 400,
    };
  }

  try {
    const url = `${API_URL}/barcode/${itemId}?download=true`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: "blob",
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    let errorMessage = "Failed to download barcode";

    if (error.response?.data instanceof Blob && error.response.data.type === "application/json") {
      const reader = new FileReader();
      const errorText = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(error.response.data);
      });
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorData.details || errorMessage;
      } catch (e) {
        errorMessage = error.message || errorMessage;
      }
    } else {
      errorMessage = error?.response?.data?.message || error?.response?.data?.error || error.message || errorMessage;
    }

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

export const uploadItemImage = async (itemId: string, imageFile: File, isMain: boolean = false): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required. Please log in again.",
      status: 401,
    };
  }

  try {
    const formData = new FormData();
    formData.append("item_id", itemId);
    formData.append("image", imageFile);
    formData.append("is_main", String(isMain));

    const response = await axios.post(`${API_URL}/item-images/`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
      withCredentials: true,
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.message ||
      error.message ||
      "Failed to upload image";

    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500,
    };
  }
};

export const deleteItemImage = async (id: number): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) return { success: false, error: "Authentication required.", status: 401 };

  try {
    const response = await axios.delete(`${API_URL}/item-images/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true,
    });
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete image" };
  }
};

export const updateItemImageMetadata = async (id: number, data: { is_main?: boolean }): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) return { success: false, error: "Authentication required.", status: 401 };

  try {
    const response = await axios.patch(`${API_URL}/item-images/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      withCredentials: true,
    });
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update image" };
  }
};

export const deleteAllItemImages = async (itemId: string): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication required.",
      status: 401,
    };
  }

  try {
    const response = await axios.delete(`${API_URL}/item-images/item/${itemId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      withCredentials: true,
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to delete images",
      status: error.response?.status || 500,
    };
  }
};

