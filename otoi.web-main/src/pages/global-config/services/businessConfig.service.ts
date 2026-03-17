import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_URL;

const getAuthToken = (): string | null => {
  try {
    const authData = localStorage.getItem("OTOI-auth-v1.0.0.1");
    if (!authData) return null;
    const parsedAuth = JSON.parse(authData);
    return parsedAuth.token || parsedAuth.access_token || parsedAuth.accessToken || null;
  } catch (error) {
    return null;
  }
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  message?: string;
}

export const updateGlobalAssets = async (payload: FormData): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required.", status: 401 };
  }

  try {
    const response = await axios.post(`${API_URL}/business-config/global-assets`, payload, {
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
    return {
      success: false,
      error: error?.response?.data?.message || error.message || "Failed to update assets",
      status: error?.response?.status || 500,
    };
  }
};

export const getGlobalAssets = async (): Promise<ApiResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Authentication required.", status: 401 };
  }

  try {
    const response = await axios.get(`${API_URL}/business-config/global-assets`, {
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
      error: error?.response?.data?.message || "Failed to fetch assets",
      status: error?.response?.status || 500,
    };
  }
};
