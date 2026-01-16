// Utility Types
export type Pad2 = number | `0${number}`;
export type IsoDate = `${number}-${Pad2}-${Pad2}`;
export type URL = null | `${"http://" | "https://"}${string}`;

// Pagination Types
export type Link = {
  url: URL;
  label: "&laquo; Previous" | `${number}` | `Next &raquo;`;
  active: boolean;
};

export type Pagination = {
  links: Link[];
  current_page: number;
  first_page_url: URL;
  from: null | number;
  last_page: number;
  next_page_url: null | URL;
  items_per_page: number;
  prev_page_url: null | number;
  to: number;
  total: number;
};

// Generic API Response
export type QueryApiResponse<T> = {
  data: T[];
  pagination: Pagination;
};

// User Model (final)
export type User = {
  id: number;
  username: string;
  email: string;
  mobile: string;
  first_name?: string;
  last_name?: string;
  role: string;
  isActive: boolean;
  created_at?: string;
  created_by?: number;
  updated_at?: string;
  businesses: Array<{ id: number; name: string }>;
};

// API Response for Users
export type QueryUserApiResponse = QueryApiResponse<User>;

// Role Model (for dropdowns)
export type Role = {
  id: number;
  name: string;
};

// API Response for Roles
export type QueryRoleApiResponse = QueryApiResponse<Role>;
