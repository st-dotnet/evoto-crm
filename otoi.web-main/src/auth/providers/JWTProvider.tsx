/* eslint-disable no-unused-vars */
import axios, { AxiosResponse } from "axios";
import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  useEffect,
  useState
} from "react";

import * as authHelper from "../_helpers";
import { type AuthModel, type UserModel } from "@/auth";

const API_URL = import.meta.env.VITE_APP_API_URL;
export const LOGIN_URL = `${API_URL}/auth/login`;
export const REGISTER_URL = `${API_URL}/auth/signup`;
export const FORGOT_PASSWORD_URL = `${API_URL}/auth/forgot-password`;
export const VALIDATE_RESET_TOKEN_URL = `${API_URL}/auth/validate-reset-token`;
export const RESET_PASSWORD_URL = `${API_URL}/auth/reset-password`;
export const GET_USER_URL = `${API_URL}/user/profile`;

interface AuthContextProps {
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  auth: AuthModel | undefined;
  saveAuth: (auth: AuthModel | undefined) => void;
  currentUser: UserModel | undefined;
  setCurrentUser: Dispatch<SetStateAction<UserModel | undefined>>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle?: () => Promise<void>;
  loginWithFacebook?: () => Promise<void>;
  loginWithGithub?: () => Promise<void>;
  register: (
    firstName: string,
    lastName: string,
    email: string,
    mobileNo: string,
    password: string,
    password_confirmation: string,
  ) => Promise<void>;
  requestPasswordResetLink: (email: string, origin?: string) => Promise<any>;
  validateResetToken: (token: string) => Promise<any>;
  changePassword: (
    token: string,
    newPassword: string,
    confirmPassword: string,
  ) => Promise<any>;
  getUser: () => Promise<AxiosResponse<any>>;
  logout: () => void;
  verify: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | null>(null);

const AuthProvider = ({ children }: PropsWithChildren) => {
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState<AuthModel | undefined>(authHelper.getAuth());
  const [currentUser, setCurrentUser] = useState<UserModel | undefined>();

  const verify = async () => {
    if (auth) {
      try {
        const { data: user } = await getUser();
        setCurrentUser(user);
      } catch {
        saveAuth(undefined);
        setCurrentUser(undefined);
      }
    }
  };

  const saveAuth = (auth: AuthModel | undefined) => {
    setAuth(auth);
    if (auth) {
      authHelper.setAuth(auth);
    } else {
      authHelper.removeAuth();
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { data: responseData } = await axios.post(LOGIN_URL, {
        email,
        password,
      });
      saveAuth(responseData);
      const { data: user } = await getUser();
      setCurrentUser(user);
      return responseData;
    } catch (error) {
      saveAuth(undefined);
      throw error;
    }
  };

  const register = async (
    firstName: string,
    lastName: string,
    email: string,
    mobileNo: string,
    password: string,
    password_confirmation: string,
  ) => {
    try {
      const { data: auth } = await axios.post(REGISTER_URL, {
        firstName,
        lastName,
        email,
        mobileNo,
        password,
        password_confirmation
      });
      saveAuth(auth);
      const { data: user } = await getUser();
      setCurrentUser(user);
    } catch (error) {
      saveAuth(undefined);
      throw new Error(`Error ${error}`);
    }
  };

  const requestPasswordResetLink = async (email: string, origin?: string) => {
    const response = await axios.post(FORGOT_PASSWORD_URL, { email, origin });
    return response.data;
  };

  const validateResetToken = async (token: string) => {
    const response = await axios.get(`${VALIDATE_RESET_TOKEN_URL}/${token}`);
    return response.data;
  };

  const changePassword = async (token: string, newPassword: string, confirmPassword: string) => {
    const response = await axios.post(RESET_PASSWORD_URL, {
      token,
      newPassword,
      confirmPassword
    });
    return response.data;
  };

  const getUser = async () => {
    return await axios.get<UserModel>(GET_USER_URL);
  };

  const logout = () => {
    saveAuth(undefined);
    setCurrentUser(undefined);
  };

  return (
    <AuthContext.Provider
      value={{
        loading,
        setLoading,
        auth,
        saveAuth,
        currentUser,
        setCurrentUser,
        login,
        register,
        requestPasswordResetLink,
        validateResetToken,
        changePassword,
        getUser,
        logout,
        verify
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };
