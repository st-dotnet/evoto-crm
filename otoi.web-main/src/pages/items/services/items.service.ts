import axios, { AxiosError } from 'axios';
import { ItemsApiResponse } from '../types/items';

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
    const authData = localStorage.getItem('OTOI-auth-v1.0.0.1');
    if (!authData) return null;
    
    const parsedAuth = JSON.parse(authData);
    return parsedAuth.token || parsedAuth.access_token || parsedAuth.accessToken || null;
  } catch (error) {
    return null;
  }
};

export const getItemById = async (id: string) => {
  const response = await axios.get(`${API_URL}/items/${id}`);
  return response.data;
};

export const getItems = async (
  search = '',
  page = 1,
  limit = 10
): Promise<ItemsApiResponse> => {
  const params = new URLSearchParams({
    search,
    page: String(page),
    limit: String(limit),
  });

  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await axios.get<ItemsApiResponse>(
    `${API_URL}/items/?${params.toString()}`,
    { headers }
  );
  return response.data;
};

export const createItem = async (payload: any): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: 'Authentication required. Please log in again.',
      status: 401
    };
  }

  try {
    const response = await axios.post(`${API_URL}/items/`, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });

    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error: any) {
    // Let axios throw automatically on 400/500 - just extract error details
    const errorMessage = error?.response?.data?.message || error.message || 'Failed to create item';
    
    return {
      success: false,
      error: errorMessage,
      status: error?.response?.status || 500
    };
  }
};

export const updateItem = async (id: string, payload: any): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return {
      success: false,
      error: 'Authentication required. Please log in again.',
      status: 401
    };
  }

  // Clean up the payload by removing undefined or empty strings
  const cleanPayload = Object.entries(payload).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== '') {
      acc[key] = value;
    } else {
      acc[key] = null;
    }
    return acc;
  }, {} as Record<string, any>);

  try {
    const response = await axios.put(`${API_URL}/items/${id}`, cleanPayload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      withCredentials: true,
      timeout: 10000
    });

    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error: any) {
    let errorMessage = 'Failed to update item';
    
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Unable to connect to the server. Please check your internet connection.';
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
        errorMessage = 'Session expired. Please log in again.';
      } else if (error.response.status === 404) {
        errorMessage = 'Item not found.';
      } else if (error.response.data?.message) {
        errorMessage = error.response.data.message;
      }
    }

    
    return {
      success: false,
      error: errorMessage,
      status: error.response?.status || 500
    };
  }
};


export const deleteItem = async (id: string) => {
  const token = getAuthToken();
  const response = await axios.delete(`${API_URL}/items/${id}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
  return response.data;
}

export const getItemCategories = async () => {
  const response  = await axios.get(`${import.meta.env.VITE_APP_API_URL}/item-categories/`);
  return response .data
}


export const createItemCategory = async (name: string) => {
  const response = await axios.post(
    `${import.meta.env.VITE_APP_API_URL}/item-categories/`,
    { name }, 
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}
