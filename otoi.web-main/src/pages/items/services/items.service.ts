import axios from 'axios'
import {ItemsApiResponse} from '../types/items'

const API_URL = import.meta.env.VITE_APP_API_URL

export const getItemById = async (id: number) => {
  try {
    const token = localStorage.getItem('token');
    const headers = {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    console.log('Attempting to fetch item with ID:', id);
    const fullUrl = `${API_URL}/items/${id}`;
    console.log('Full URL:', fullUrl);
    
    // Test if the URL is reachable first
    try {
      const testResponse = await fetch(fullUrl, { 
        method: 'OPTIONS',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      console.log('CORS Preflight Response:', {
        status: testResponse.status,
        statusText: testResponse.statusText,
        headers: Object.fromEntries(testResponse.headers.entries())
      });
    } catch (testError) {
      console.error('CORS Preflight Error:', testError);
    }

    const response = await axios({
      method: 'get',
      url: fullUrl,
      headers,
      withCredentials: true,
      timeout: 10000,
      validateStatus: (status) => status < 500 // Don't throw for 4xx errors
    });

    console.log('Item fetch successful:', response.data);
    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    console.error('Detailed error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseHeaders: error.response?.headers,
      request: error.request,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
      }
    });

    let errorMessage = 'Failed to fetch item details';
    if (error.code === 'ERR_NETWORK') {
      errorMessage = `Unable to connect to the server at ${error.config?.url}. Please check if the server is running and accessible.`;
      
      // Additional diagnostics
      try {
        const testResponse = await fetch(error.config?.url, { method: 'HEAD' });
        console.log('Direct fetch test:', {
          status: testResponse.status,
          statusText: testResponse.statusText,
          headers: Object.fromEntries(testResponse.headers.entries())
        });
      } catch (testError) {
        console.error('Direct fetch test failed:', testError);
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
    };
  }
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

export const createItem = async (payload: any) => {
  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  const response = await axios.post(`${API_URL}/items/`, payload, { headers });
  return response.data;
}

export const updateItem = async (id: number, payload: any) => {
  const authData = localStorage.getItem('OTOI-auth-v1.0.0.1');
  if (!authData) {
    console.error('No authentication data found in localStorage');
    return {
      success: false,
      error: 'Authentication required. Please log in again.',
      status: 401
    };
  }

  let token;
  try {
    const parsedAuth = JSON.parse(authData);
    token = parsedAuth.token || parsedAuth.access_token || parsedAuth.accessToken;
  } catch (e) {
    console.error('Error parsing auth data:', e);
    return {
      success: false,
      error: 'Invalid authentication data. Please log in again.',
      status: 401
    };
  }

  if (!token) {
    console.error('No token found in auth data');
    return {
      success: false,
      error: 'Authentication token not found',
      status: 401
    };
  }

  const endpoint = `${API_URL}/items/${id}`;
  console.log('Update endpoint:', endpoint);

  try {
    const response = await axios.put(endpoint, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('Update successful:', response.data);
    return {
      success: true, 
      data: response.data,
      status: response.status
    };
  } catch (error: any) {
    console.error('Error updating item:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status || 0
    };
  }
};


export const deleteItem = async (id: number) => {
  const response = await axios.delete(`${API_URL}/items/${id}`)
  return response.data
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
