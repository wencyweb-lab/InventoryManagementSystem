import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ISetting extends Document {
  CompanyName: string
  CompanyPhone: string
  CompanyAdress: string
  email: string
  logo: string
  footer: string
  developed_by: string
  currency_id: Types.ObjectId | null
  client_id: Types.ObjectId | null
  warehouse_id: Types.ObjectId | null
  default_language: string
  createdAt: Date
  updatedAt: Date
}

const SettingSchema = new Schema<ISetting>(
  {
    CompanyName: { type: String, default: 'Stocky' },
    CompanyPhone: { type: String, default: '' },
    CompanyAdress: { type: String, default: '' },
    email: { type: String, default: '' },
    logo: { type: String, default: 'logo-default.png' },
    footer: { type: String, default: 'Stocky - Ultimate Inventory with POS' },
    developed_by: { type: String, default: 'Stocky' },
    currency_id: { type: Schema.Types.ObjectId, ref: 'Currency', default: null },
    client_id: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    default_language: { type: String, default: 'en' },
  },
  { timestamps: true }
)

export const Setting =
  mongoose.models.Setting || mongoose.model<ISetting>('Setting', SettingSchema)

// POS Settings
const PosSettingSchema = new Schema(
  {
    note_customer: { type: String, default: 'Thank You For Shopping With Us. Please Come Again.' },
    show_note: { type: Boolean, default: true },
    show_barcode: { type: Boolean, default: true },
    show_discount: { type: Boolean, default: true },
    show_customer: { type: Boolean, default: true },
    show_email: { type: Boolean, default: true },
    show_phone: { type: Boolean, default: true },
    show_address: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const PosSetting =
  mongoose.models.PosSetting || mongoose.model('PosSetting', PosSettingSchema)

// SMTP Server Settings
const ServerSchema = new Schema(
  {
    name: { type: String, default: 'default' },
    smtp_host: { type: String, default: '' },
    smtp_port: { type: Number, default: 587 },
    encryption: { type: String, default: 'tls' },
    smtp_username: { type: String, default: '' },
    smtp_password: { type: String, default: '', select: false },
    smtp_email: { type: String, default: '' },
  },
  { timestamps: true }
)

export const Server =
  mongoose.models.Server || mongoose.model('Server', ServerSchema)

const PaymentGatewaySettingSchema = new Schema(
  {
    provider: { type: String, default: 'stripe' },
    enabled: { type: Boolean, default: false },
    public_key: { type: String, default: '' },
    secret_key: { type: String, default: '', select: false },
    currency: { type: String, default: 'USD' },
  },
  { timestamps: true }
)

export const PaymentGatewaySetting =
  mongoose.models.PaymentGatewaySetting || mongoose.model('PaymentGatewaySetting', PaymentGatewaySettingSchema)

const SmsSettingSchema = new Schema(
  {
    provider: { type: String, default: 'twilio' },
    enabled: { type: Boolean, default: false },
    account_sid: { type: String, default: '' },
    auth_token: { type: String, default: '', select: false },
    from_number: { type: String, default: '' },
  },
  { timestamps: true }
)

export const SmsSetting =
  mongoose.models.SmsSetting || mongoose.model('SmsSetting', SmsSettingSchema)
