import mongoose, { Schema, Document, Model, Types } from 'mongoose'

export type OrderStatus = 'Sourced' | 'Listed' | 'Sold' | 'Archived'
export type OrderPlatform = 'eBay' | 'Depop' | 'Facebook' | 'Other'
export type ItemCondition = 'New' | 'Like New' | 'Very Good' | 'Good' | 'Fair' | 'Poor'

// eBay's actual final value fee rate for most categories
import { EBAY_FEE_RATE } from '@/lib/utils'
export { EBAY_FEE_RATE }

export interface IOrder extends Document {
  orderId: string
  platform: OrderPlatform
  productName: string
  condition?: ItemCondition
  buyerUsername?: string
  purchaseCost: number
  sourceDate: Date
  sourceLocation?: string
  listPrice?: number
  soldPrice?: number
  shippingCost: number
  buyerPaysShipping: boolean
  platformFees?: number
  status: OrderStatus
  location?: string
  notes?: string
  trackingNumber?: string
  photos: string[]
  owner: Types.ObjectId
  deletedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  profit?: number
  projectedProfit?: number
}

const OrderSchema = new Schema<IOrder>(
  {
    orderId: { type: String, required: true, unique: true },
    platform: {
      type: String,
      enum: ['eBay', 'Depop', 'Facebook', 'Other'],
      required: true,
    },
    productName: { type: String, required: true },
    condition: {
      type: String,
      enum: ['New', 'Like New', 'Very Good', 'Good', 'Fair', 'Poor'],
    },
    buyerUsername: { type: String },
    purchaseCost: { type: Number, required: true, default: 0 },
    sourceDate: { type: Date, required: true, default: Date.now },
    sourceLocation: { type: String },
    listPrice: { type: Number },
    soldPrice: { type: Number },
    shippingCost: { type: Number, default: 0 },
    // When true: buyer covered shipping, your label cost = $0 for profit
    buyerPaysShipping: { type: Boolean, default: false },
    platformFees: { type: Number },
    status: {
      type: String,
      enum: ['Sourced', 'Listed', 'Sold', 'Archived'],
      required: true,
      default: 'Sourced',
    },
    location: { type: String },
    notes: { type: String },
    trackingNumber: { type: String },
    photos: [{ type: String }],
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

// Profit = soldPrice - purchaseCost - shippingCost (if seller paid) - platformFees
// eBay fees apply to soldPrice regardless of who pays shipping
OrderSchema.virtual('profit').get(function () {
  if (this.soldPrice == null) return undefined
  const fees = this.platformFees ?? this.soldPrice * EBAY_FEE_RATE
  const shipping = this.buyerPaysShipping ? 0 : (this.shippingCost ?? 0)
  return this.soldPrice - this.purchaseCost - shipping - fees
})

// Projected profit for listed items
OrderSchema.virtual('projectedProfit').get(function () {
  if (this.listPrice == null) return undefined
  const shipping = this.buyerPaysShipping ? 0 : (this.shippingCost ?? 0)
  return this.listPrice - this.purchaseCost - shipping - this.listPrice * EBAY_FEE_RATE
})

OrderSchema.set('toJSON', { virtuals: true })
OrderSchema.set('toObject', { virtuals: true })

export const Order: Model<IOrder> =
  mongoose.models.Order ?? mongoose.model<IOrder>('Order', OrderSchema)
