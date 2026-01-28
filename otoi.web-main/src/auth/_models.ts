import { type TLanguageCode } from '@/i18n';

export interface AuthModel {
  access_token: string;
  refreshToken?: string;
  api_token: string;
}

export interface UserModel {
  id: string | number;
  username: string;
  password?: string;
  email: string;
  first_name: string;
  last_name: string;
  fullname?: string;
  occupation?: string;
  companyName?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
  pic?: string;
  language?: TLanguageCode;
  auth?: AuthModel;
}
