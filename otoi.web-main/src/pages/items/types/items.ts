export interface Item {
  id: number
  name: string
  type: string
  category: string
  sales_price: number
  business_id: number
  stock: number
}

export interface ItemsApiResponse {
  items: Item[]
  total: number
}
