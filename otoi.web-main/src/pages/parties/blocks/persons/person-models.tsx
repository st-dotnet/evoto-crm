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

export type PersonType = {
  id: number;
  name: string;
};

export type Person = {
  id: number;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  gst: string;
  person_type: string;
  personType: PersonType;
};
