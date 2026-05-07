import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IConfig extends Document {
  key: string
  value: boolean | string | number
}

const ConfigSchema = new Schema<IConfig>({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
})

export const Config: Model<IConfig> =
  mongoose.models.Config ?? mongoose.model<IConfig>('Config', ConfigSchema)

export async function getConfig(key: string, defaultValue: boolean | string | number) {
  const doc = await Config.findOne({ key }).lean()
  return doc ? doc.value : defaultValue
}

export async function setConfig(key: string, value: boolean | string | number) {
  await Config.findOneAndUpdate({ key }, { value }, { upsert: true })
}
