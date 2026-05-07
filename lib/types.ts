export type OrderStatus = 'Sourced' | 'Listed' | 'Sold' | 'Archived'
export type OrderPlatform = 'eBay' | 'Depop' | 'Facebook' | 'Other'

export interface OrderOwner {
  _id: string
  name: string
  email: string
}

export interface Order {
  _id: string
  orderId: string
  platform: OrderPlatform
  productName: string
  buyerUsername?: string
  purchaseCost: number
  sourceDate: string
  sourceLocation?: string
  listPrice?: number
  soldPrice?: number
  shippingCost: number
  platformFees?: number
  profit?: number
  projectedProfit?: number
  status: OrderStatus
  location?: string
  notes?: string
  trackingNumber?: string
  photos: string[]
  owner: OrderOwner
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface OrdersResponse {
  orders: Order[]
  total: number
  page: number
  pages: number
}
