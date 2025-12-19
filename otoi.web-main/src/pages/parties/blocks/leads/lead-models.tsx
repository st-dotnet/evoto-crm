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

// Lead Model (final)
export type Lead = {
  id: number;
  uuid: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  gst: string;
  address: string | undefined;
  activity_type: string | undefined;
  status: string; // only status kept
  city: string;
  created_at: string | undefined;
  edit: string;
};

// API Response for Leads
export type QueryLeadApiResponse = QueryApiResponse<Lead>;

