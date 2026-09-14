import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IExpenseCategory extends Document {
  name: string
  description: string
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const ExpenseCategorySchema = new Schema<IExpenseCategory>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export const ExpenseCategory =
  mongoose.models.ExpenseCategory || mongoose.model<IExpenseCategory>('ExpenseCategory', ExpenseCategorySchema)

export interface IExpense extends Document {
  Ref: string
  date: Date
  warehouse_id: Types.ObjectId | null
  category_id: Types.ObjectId | null
  user_id: Types.ObjectId
  amount: number
  details: string
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const ExpenseSchema = new Schema<IExpense>(
  {
    Ref: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    warehouse_id: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    category_id: { type: Schema.Types.ObjectId, ref: 'ExpenseCategory', default: null },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    details: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export const Expense =
  mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema)
