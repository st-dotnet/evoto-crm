export type Pad2 = number | `0${number}`;
export type IsoDate = `${number}-${Pad2}-${Pad2}`;
export type URL = null | `${"http://" | "https://"}${string}`;

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

export type QueryApiResponse<T> = {
  data: T[];
  pagination: Pagination;
};

// 🔹 Customer type instead of Person
export type CustomerType = {
  id: number;
  name: string;
};

export type Customer = {
  id: number;
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  gst: string;

  // Optional fields
  address?: string;
  activity_type?: string;
  created_at?: string;
  status?: string;

  // Relations
  customer_type?: CustomerType;

  // UI-specific
  edit?: string;
};
