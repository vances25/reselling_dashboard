import mongoose, { Schema, Document, Model, Types } from 'mongoose'

export type OrderStatus = 'Sourced' | 'Listed' | 'Sold' | 'Archived'
export type OrderPlatform = 'eBay' | 'Depop' | 'Facebook' | 'Other'

export interface IOrder extends Document {
  orderId: string
  platform: OrderPlatform
  productName: string
  buyerUsername?: string
  purchaseCost: number
  sourceDate: Date
  sourceLocation?: string
  listPrice?: number
  soldPrice?: number
  shippingCost: number
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
    buyerUsername: { type: String },
    purchaseCost: { type: Number, required: true, default: 0 },
    sourceDate: { type: Date, required: true, default: Date.now },
    sourceLocation: { type: String },
    listPrice: { type: Number },
    soldPrice: { type: Number },
    shippingCost: { type: Number, default: 0 },
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

// Virtual: actual profit for sold items
OrderSchema.virtual('profit').get(function () {
  if (this.soldPrice == null) return undefined
  const fees = this.platformFees ?? this.soldPrice * 0.13
  return this.soldPrice - this.purchaseCost - this.shippingCost - fees
})

// Virtual: projected profit for listed items
OrderSchema.virtual('projectedProfit').get(function () {
  if (this.listPrice == null) return undefined
  return this.listPrice - this.purchaseCost - this.listPrice * 0.13
})

OrderSchema.set('toJSON', { virtuals: true })
OrderSchema.set('toObject', { virtuals: true })

export const Order: Model<IOrder> =
  mongoose.models.Order ?? mongoose.model<IOrder>('Order', OrderSchema)
