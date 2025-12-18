// export interface Item {
//   id: number
//   name: string
//   type: string
//   category: string
//   sales_price: number
//   business_id: number
//   stock: number
// }

// export interface ItemsApiResponse {
//   items: Item[]
//   total: number
// }

// 18-12-2025
export interface Item {
  id: number;
  item_name: string;
  opening_stock: number;
  sales_price: number;
}
export interface ItemsApiResponse {
  items: Item[];
  total: number;
}
