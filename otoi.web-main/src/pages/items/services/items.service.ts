import axios from 'axios'
import {ItemsApiResponse} from '../types/items'

const API_URL = import.meta.env.VITE_APP_API_URL

export const getItems = async (
  search = '',
  page = 1,
  limit = 10
): Promise<ItemsApiResponse> => {
  const params = new URLSearchParams({
    search,
    page: String(page),
    limit: String(limit),
  })

  const response = await axios.get<ItemsApiResponse>(
    `${API_URL}/items/?${params.toString()}`
  )

  return {
    items: response.data.items ?? [],
    total: response.data.total ?? 0,
  }
}

export const createItem = async (payload: any) => {
  const response = await axios.post(`${API_URL}/items/`, payload)
  return response.data
}

export const deleteItem = async (id: number) => {
  const response = await axios.delete(`${API_URL}/items/${id}`)
  return response.data
}
