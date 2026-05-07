import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

// Load env manually for ts-node
const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('Set MONGODB_URI in .env.local')
  process.exit(1)
}

async function main() {
  await mongoose.connect(MONGODB_URI!)

  // Inline models to avoid Next.js module resolution issues in ts-node
  const UserSchema = new mongoose.Schema(
    {
      name: String,
      email: { type: String, unique: true, lowercase: true },
      passwordHash: String,
    },
    { timestamps: { createdAt: true, updatedAt: false } }
  )
  const User = mongoose.models.User ?? mongoose.model('User', UserSchema)

  const OrderSchema = new mongoose.Schema(
    {
      orderId: { type: String, unique: true },
      platform: String,
      productName: String,
      buyerUsername: String,
      purchaseCost: Number,
      sourceDate: Date,
      sourceLocation: String,
      listPrice: Number,
      soldPrice: Number,
      shippingCost: { type: Number, default: 0 },
      platformFees: Number,
      status: String,
      location: String,
      notes: String,
      trackingNumber: String,
      photos: [String],
      owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true }
  )
  const Order = mongoose.models.Order ?? mongoose.model('Order', OrderSchema)

  const hash = (pw: string) => bcrypt.hash(pw, 10)

  const [meUser, friendUser] = await Promise.all([
    User.findOneAndUpdate(
      { email: 'me@dashboard.local' },
      { $setOnInsert: { name: 'Me', email: 'me@dashboard.local', passwordHash: await hash('changeme123') } },
      { upsert: true, new: true }
    ),
    User.findOneAndUpdate(
      { email: 'friend@dashboard.local' },
      { $setOnInsert: { name: 'Friend', email: 'friend@dashboard.local', passwordHash: await hash('changeme123') } },
      { upsert: true, new: true }
    ),
  ])

  const now = new Date()
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000)

  const orders = [
    {
      orderId: 'ORD-0001',
      platform: 'eBay',
      productName: 'Nike Air Jordan 1 Retro High OG',
      purchaseCost: 85,
      sourceDate: daysAgo(30),
      sourceLocation: 'Goodwill',
      listPrice: 220,
      soldPrice: 210,
      shippingCost: 12,
      status: 'Sold',
      owner: meUser._id,
      buyerUsername: 'sneakerhead99',
      trackingNumber: '1Z999AA10123456784',
    },
    {
      orderId: 'ORD-0002',
      platform: 'eBay',
      productName: 'Vintage Levi\'s 501 Jeans W32',
      purchaseCost: 12,
      sourceDate: daysAgo(20),
      sourceLocation: 'Thrift World',
      listPrice: 65,
      soldPrice: 58,
      shippingCost: 8,
      status: 'Sold',
      owner: friendUser._id,
      buyerUsername: 'denimfan',
    },
    {
      orderId: 'ORD-0003',
      platform: 'Depop',
      productName: 'Y2K Butterfly Top Pink',
      purchaseCost: 5,
      sourceDate: daysAgo(15),
      sourceLocation: 'Savers',
      listPrice: 35,
      status: 'Listed',
      owner: meUser._id,
    },
    {
      orderId: 'ORD-0004',
      platform: 'eBay',
      productName: 'Ralph Lauren Polo Shirt XL Navy',
      purchaseCost: 8,
      sourceDate: daysAgo(14),
      sourceLocation: 'Goodwill',
      listPrice: 45,
      status: 'Listed',
      owner: friendUser._id,
    },
    {
      orderId: 'ORD-0005',
      platform: 'Facebook',
      productName: 'Pyrex Vision Windbreaker M',
      purchaseCost: 40,
      sourceDate: daysAgo(10),
      sourceLocation: 'Grailed',
      status: 'Sourced',
      owner: meUser._id,
      location: 'Shelf A3',
    },
    {
      orderId: 'ORD-0006',
      platform: 'eBay',
      productName: 'Supreme Box Logo Hoodie Black S',
      purchaseCost: 180,
      sourceDate: daysAgo(7),
      sourceLocation: 'StockX',
      listPrice: 420,
      soldPrice: 395,
      shippingCost: 15,
      status: 'Sold',
      owner: meUser._id,
      buyerUsername: 'hype_buyer',
    },
    {
      orderId: 'ORD-0007',
      platform: 'Depop',
      productName: 'Carhartt WIP Beanie Brown',
      purchaseCost: 6,
      sourceDate: daysAgo(5),
      sourceLocation: 'Savers',
      listPrice: 22,
      status: 'Listed',
      owner: friendUser._id,
    },
    {
      orderId: 'ORD-0008',
      platform: 'eBay',
      productName: 'Patagonia Fleece Pullover L',
      purchaseCost: 18,
      sourceDate: daysAgo(3),
      sourceLocation: 'Thrift World',
      status: 'Sourced',
      owner: friendUser._id,
      location: 'Bin 2',
    },
    {
      orderId: 'ORD-0009',
      platform: 'Other',
      productName: 'Vintage Band Tee Metallica XL',
      purchaseCost: 15,
      sourceDate: daysAgo(2),
      sourceLocation: 'Estate Sale',
      listPrice: 80,
      soldPrice: 75,
      shippingCost: 6,
      status: 'Archived',
      owner: meUser._id,
      buyerUsername: 'metalfan42',
    },
    {
      orderId: 'ORD-0010',
      platform: 'eBay',
      productName: 'New Balance 990v5 Grey 10.5',
      purchaseCost: 95,
      sourceDate: daysAgo(1),
      sourceLocation: 'GOAT',
      listPrice: 185,
      status: 'Sourced',
      owner: meUser._id,
      location: 'Shelf B1',
    },
  ]

  let created = 0
  let skipped = 0
  for (const o of orders) {
    const result = await Order.updateOne(
      { orderId: o.orderId },
      { $setOnInsert: o },
      { upsert: true }
    )
    if (result.upsertedCount) created++
    else skipped++
  }

  console.log(`✓ Users: me@dashboard.local + friend@dashboard.local (pw: changeme123)`)
  console.log(`✓ Orders: ${created} created, ${skipped} already existed`)
  await mongoose.disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
