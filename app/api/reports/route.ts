import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import {
  ApiError,
  recordScopeMatch,
  requireSession,
  requirePermission,
  scopedFilter,
  withErrorHandler,
} from '@/lib/permissions'
import Sale from '@/models/Sale'
import Purchase from '@/models/Purchase'
import { PaymentSale, PaymentPurchase, PaymentSaleReturn, PaymentPurchaseReturn } from '@/models/Payments'
import { Expense } from '@/models/Expense'
import ProductWarehouse from '@/models/ProductWarehouse'
import Quotation from '@/models/Quotation'
import { SaleReturn, PurchaseReturn } from '@/models/Returns'
import Client from '@/models/Client'
import Provider from '@/models/Provider'
import Warehouse from '@/models/Warehouse'
import '@/models/Unit'
import { round2 } from '@/lib/calculations'

function total(result: any[]) {
  return result[0]?.total ?? 0
}

export const dynamic = 'force-dynamic'

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession()
  await dbConnect()
  const url = new URL(req.url)
  const report = url.searchParams.get('type')
  const from = url.searchParams.get('from') ? new Date(url.searchParams.get('from')!) : new Date(new Date().getFullYear(), 0, 1)
  const to = url.searchParams.get('to') ? new Date(url.searchParams.get('to')!) : new Date()
  if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf()) || from > to) {
    throw new ApiError(422, 'Invalid report date range')
  }
  to.setHours(23, 59, 59, 999)
  const date = { $gte: from, $lte: to }
  const aggregateScope = recordScopeMatch(user)

  if (report === 'profit_loss') {
    await requirePermission(user, 'Reports_profit')
    const match = { deletedAt: null, date, ...aggregateScope }
    const [sales, purchases, salePayments, purchasePayments, saleReturnPayments, purchaseReturnPayments, expenses] = await Promise.all([
      Sale.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$GrandTotal' } } }]),
      Purchase.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$GrandTotal' } } }]),
      PaymentSale.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$montant' } } }]),
      PaymentPurchase.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$montant' } } }]),
      PaymentSaleReturn.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$montant' } } }]),
      PaymentPurchaseReturn.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$montant' } } }]),
      Expense.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ])
    const saleTotal = total(sales)
    const purchaseTotal = total(purchases)
    const received = total(salePayments) + total(purchaseReturnPayments)
    const sent = total(purchasePayments) + total(saleReturnPayments) + total(expenses)
    return NextResponse.json({
      profit: saleTotal - purchaseTotal,
      saleTotal,
      purchaseTotal,
      payment_received: received,
      payment_sent: sent,
      payment_net: received - sent,
    })
  }

  if (report === 'warehouse') {
    await requirePermission(user, 'Warehouse_report')
    const warehouseId = url.searchParams.get('warehouse_id')
    const match: Record<string, unknown> = { deletedAt: null }
    if (warehouseId) {
      const mongoose = await import('mongoose')
      if (!mongoose.Types.ObjectId.isValid(warehouseId)) throw new ApiError(422, 'Invalid warehouse')
      match.warehouse_id = new mongoose.Types.ObjectId(warehouseId)
    }
    const data = await ProductWarehouse.aggregate([
      { $match: match },
      { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $match: { 'product.deletedAt': null } },
      { $lookup: { from: 'warehouses', localField: 'warehouse_id', foreignField: '_id', as: 'warehouse' } },
      { $unwind: '$warehouse' },
      { $match: { 'warehouse.deletedAt': null } },
      { $group: {
        _id: '$warehouse_id',
        warehouseName: { $first: '$warehouse.name' },
        productCount: { $sum: 1 },
        totalStock: { $sum: '$qte' },
        costValue: { $sum: { $multiply: ['$qte', '$product.cost'] } },
        saleValue: { $sum: { $multiply: ['$qte', '$product.price'] } },
      } },
      { $sort: { warehouseName: 1 } },
    ])
    return NextResponse.json(data)
  }

  if (report === 'warehouse_detail') {
    await requirePermission(user, 'Warehouse_report')
    const id = url.searchParams.get('id')
    if (!id) throw new ApiError(422, 'Warehouse is required')
    const warehouse = await Warehouse.findOne({ _id: id, deletedAt: null }).lean()
    if (!warehouse) throw new ApiError(404, 'Warehouse not found')
    const filter = scopedFilter(user, { warehouse_id: id, deletedAt: null, date })
    const [sales, purchases, quotations, saleReturns, purchaseReturns, expenses, stock] = await Promise.all([
      Sale.find(filter).sort({ date: -1 }).lean(), Purchase.find(filter).sort({ date: -1 }).lean(),
      Quotation.find(filter).sort({ date: -1 }).lean(), SaleReturn.find(filter).sort({ date: -1 }).lean(),
      PurchaseReturn.find(filter).sort({ date: -1 }).lean(), Expense.find(filter).sort({ date: -1 }).lean(),
      ProductWarehouse.find({ warehouse_id: id, deletedAt: null }).populate({ path: 'product_id', match: { deletedAt: null }, populate: { path: 'unit_id', select: 'short_name' } }).lean(),
    ])
    return NextResponse.json({ warehouse, sales, purchases, quotations, saleReturns, purchaseReturns, expenses,
      stock: stock.filter((row: any) => row.product_id).map((row: any) => ({ ...row,
        variantName: row.product_id.variants?.find((variant: any) => variant._id.toString() === row.variant_id?.toString())?.name ?? '',
      })),
    })
  }

  if (report === 'stock_alerts') {
    await requirePermission(user, 'Reports_quantity_alerts')
    const data = await ProductWarehouse.aggregate([
      { $match: { deletedAt: null } },
      { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $match: { 'product.deletedAt': null, 'product.has_alert': true } },
      { $match: { $expr: { $lte: ['$qte', '$product.alert_quantity'] } } },
      { $lookup: { from: 'warehouses', localField: 'warehouse_id', foreignField: '_id', as: 'warehouse' } },
      { $unwind: { path: '$warehouse', preserveNullAndEmptyArrays: true } },
      { $project: {
        productName: '$product.name',
        productCode: '$product.code',
        warehouseName: { $ifNull: ['$warehouse.name', 'N/A'] },
        currentQty: '$qte',
        alertQty: '$product.alert_quantity',
      } },
    ])
    return NextResponse.json(data)
  }

  if (report === 'sales') {
    await requirePermission(user, 'Reports_sales')
    const data = await Sale.find(scopedFilter(user, { deletedAt: null, date }))
      .populate('client_id warehouse_id', 'name').sort({ date: -1 }).lean()
    return NextResponse.json(data)
  }

  if (report === 'purchases') {
    await requirePermission(user, 'Reports_purchase')
    const data = await Purchase.find(scopedFilter(user, { deletedAt: null, date }))
      .populate('provider_id warehouse_id', 'name').sort({ date: -1 }).lean()
    return NextResponse.json(data)
  }

  const paymentReports: Record<string, { model: any; permission: string; parentField: string; parentModel: any }> = {
    payments_sales: { model: PaymentSale, permission: 'Reports_payments_Sales', parentField: 'sale_id', parentModel: Sale },
    payments_purchases: { model: PaymentPurchase, permission: 'Reports_payments_Purchases', parentField: 'purchase_id', parentModel: Purchase },
    payments_sale_returns: { model: PaymentSaleReturn, permission: 'Reports_payments_Sale_Returns', parentField: 'sale_return_id', parentModel: SaleReturn },
    payments_purchase_returns: { model: PaymentPurchaseReturn, permission: 'Reports_payments_purchase_Return', parentField: 'purchase_return_id', parentModel: PurchaseReturn },
  }
  if (report && paymentReports[report]) {
    const config = paymentReports[report]
    await requirePermission(user, config.permission)
    const payments = await config.model.find(scopedFilter(user, { deletedAt: null, date })).populate('user_id', 'name').sort({ date: -1 }).lean()
    const parentIds = payments.map((payment: any) => payment[config.parentField])
    const parents = await config.parentModel.find(scopedFilter(user, { _id: { $in: parentIds }, deletedAt: null })).select('Ref').lean()
    const parentMap = new Map(parents.map((parent: any) => [parent._id.toString(), parent.Ref]))
    return NextResponse.json(payments.map((payment: any) => ({ ...payment, parentRef: parentMap.get(payment[config.parentField].toString()) ?? '—' })))
  }

  if (report === 'customers') {
    await requirePermission(user, 'Reports_customers')
    const rows = await Sale.aggregate([
      { $match: { deletedAt: null, date, ...aggregateScope } },
      { $group: { _id: '$client_id', sales: { $sum: 1 }, total: { $sum: '$GrandTotal' }, paid: { $sum: '$paid_amount' } } },
      { $lookup: { from: 'clients', localField: '_id', foreignField: '_id', as: 'client' } },
      { $unwind: '$client' },
      { $match: { 'client.deletedAt': null } },
      { $project: { name: '$client.name', phone: '$client.phone', email: '$client.email', sales: 1, total: 1, paid: 1, due: { $subtract: ['$total', '$paid'] } } },
      { $sort: { total: -1 } },
    ])
    const parties = await Client.find({ deletedAt: null }).select('name phone email').lean()
    const metrics = new Map(rows.map(row => [String(row._id), row]))
    return NextResponse.json(parties.map((party: any) => metrics.get(String(party._id)) ?? { ...party, sales: 0, total: 0, paid: 0, due: 0 }).sort((a: any, b: any) => b.total - a.total))
  }

  if (report === 'suppliers') {
    await requirePermission(user, 'Reports_suppliers')
    const rows = await Purchase.aggregate([
      { $match: { deletedAt: null, date, ...aggregateScope } },
      { $group: { _id: '$provider_id', purchases: { $sum: 1 }, total: { $sum: '$GrandTotal' }, paid: { $sum: '$paid_amount' } } },
      { $lookup: { from: 'providers', localField: '_id', foreignField: '_id', as: 'provider' } },
      { $unwind: '$provider' },
      { $match: { 'provider.deletedAt': null } },
      { $project: { name: '$provider.name', phone: '$provider.phone', email: '$provider.email', purchases: 1, total: 1, paid: 1, due: { $subtract: ['$total', '$paid'] } } },
      { $sort: { total: -1 } },
    ])
    const parties = await Provider.find({ deletedAt: null }).select('name phone email').lean()
    const metrics = new Map(rows.map(row => [String(row._id), row]))
    return NextResponse.json(parties.map((party: any) => metrics.get(String(party._id)) ?? { ...party, purchases: 0, total: 0, paid: 0, due: 0 }).sort((a: any, b: any) => b.total - a.total))
  }

  if (report === 'customer_detail') {
    await requirePermission(user, 'Reports_customers')
    const id = url.searchParams.get('id')
    if (!id) throw new ApiError(422, 'Customer is required')
    const customer = await Client.findOne({ _id: id, deletedAt: null }).lean()
    if (!customer) throw new ApiError(404, 'Customer not found')
    const [sales, quotations, returns] = await Promise.all([
      Sale.find(scopedFilter(user, { client_id: id, deletedAt: null, date })).sort({ date: -1 }).lean(),
      Quotation.find(scopedFilter(user, { client_id: id, deletedAt: null, date })).sort({ date: -1 }).lean(),
      SaleReturn.find(scopedFilter(user, { client_id: id, deletedAt: null, date })).sort({ date: -1 }).lean(),
    ])
    const parentIds = await Sale.find(scopedFilter(user, { client_id: id, deletedAt: null })).distinct('_id')
    const returnIds = await SaleReturn.find(scopedFilter(user, { client_id: id, deletedAt: null })).distinct('_id')
    const [payments, returnPayments] = await Promise.all([
      PaymentSale.find({ sale_id: { $in: parentIds }, deletedAt: null, date }).populate('sale_id', 'Ref').sort({ date: -1 }).lean(),
      PaymentSaleReturn.find({ sale_return_id: { $in: returnIds }, deletedAt: null, date }).populate('sale_return_id', 'Ref').sort({ date: -1 }).lean(),
    ])
    return NextResponse.json({ customer, sales, quotations, returns, payments, returnPayments })
  }

  if (report === 'supplier_detail') {
    await requirePermission(user, 'Reports_suppliers')
    const id = url.searchParams.get('id')
    if (!id) throw new ApiError(422, 'Supplier is required')
    const supplier = await Provider.findOne({ _id: id, deletedAt: null }).lean()
    if (!supplier) throw new ApiError(404, 'Supplier not found')
    const [purchases, returns] = await Promise.all([
      Purchase.find(scopedFilter(user, { provider_id: id, deletedAt: null, date })).sort({ date: -1 }).lean(),
      PurchaseReturn.find(scopedFilter(user, { provider_id: id, deletedAt: null, date })).sort({ date: -1 }).lean(),
    ])
    const parentIds = await Purchase.find(scopedFilter(user, { provider_id: id, deletedAt: null })).distinct('_id')
    const returnIds = await PurchaseReturn.find(scopedFilter(user, { provider_id: id, deletedAt: null })).distinct('_id')
    const [payments, returnPayments] = await Promise.all([
      PaymentPurchase.find({ purchase_id: { $in: parentIds }, deletedAt: null, date }).populate('purchase_id', 'Ref').sort({ date: -1 }).lean(),
      PaymentPurchaseReturn.find({ purchase_return_id: { $in: returnIds }, deletedAt: null, date }).populate('purchase_return_id', 'Ref').sort({ date: -1 }).lean(),
    ])
    return NextResponse.json({ supplier, purchases, returns, payments, returnPayments })
  }

  if (report === 'top_products_year') {
    await requirePermission(user, 'Reports_sales')
    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const yearEnd = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999)
    const topProducts = await Sale.aggregate([
      { $match: { deletedAt: null, date: { $gte: yearStart, $lte: yearEnd }, ...aggregateScope } },
      { $unwind: '$details' },
      {
        $group: {
          _id: '$details.product_id',
          quantity: { $sum: '$details.quantity' },
          total: { $sum: '$details.subtotal' },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          quantity: 1,
          total: 1,
          name: { $ifNull: ['$product.name', 'Unknown'] },
          code: { $ifNull: ['$product.code', '—'] },
        },
      },
    ])
    return NextResponse.json(topProducts)
  }

  if (report === 'today_summary') {
    await requirePermission(user, 'Reports_sales')
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    const todayMatch = { deletedAt: null, date: { $gte: todayStart, $lte: todayEnd }, ...aggregateScope }

    const [todaySales, todayPurchases, todaySaleReturns, todayPurchaseReturns, todayExpenses] = await Promise.all([
      Sale.aggregate([{ $match: todayMatch }, { $group: { _id: null, total: { $sum: '$GrandTotal' }, count: { $sum: 1 } } }]),
      Purchase.aggregate([{ $match: todayMatch }, { $group: { _id: null, total: { $sum: '$GrandTotal' }, count: { $sum: 1 } } }]),
      SaleReturn.aggregate([{ $match: todayMatch }, { $group: { _id: null, total: { $sum: '$GrandTotal' }, count: { $sum: 1 } } }]),
      PurchaseReturn.aggregate([{ $match: todayMatch }, { $group: { _id: null, total: { $sum: '$GrandTotal' }, count: { $sum: 1 } } }]),
      Expense.aggregate([{ $match: todayMatch }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    ])

    const salesTotal = todaySales[0]?.total ?? 0
    const salesCount = todaySales[0]?.count ?? 0
    const purchasesTotal = todayPurchases[0]?.total ?? 0
    const purchasesCount = todayPurchases[0]?.count ?? 0
    const saleReturnsTotal = todaySaleReturns[0]?.total ?? 0
    const purchaseReturnsTotal = todayPurchaseReturns[0]?.total ?? 0
    const expensesTotal = todayExpenses[0]?.total ?? 0

    return NextResponse.json({
      today_sales: salesTotal,
      sales_count: salesCount,
      today_purchases: purchasesTotal,
      purchases_count: purchasesCount,
      return_sales: saleReturnsTotal,
      return_purchases: purchaseReturnsTotal,
      expenses: expensesTotal,
      revenue: salesTotal - saleReturnsTotal,
    })
  }

  if (report === 'top_products_month') {
    await requirePermission(user, 'Reports_sales')
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const topProducts = await Sale.aggregate([
      { $match: { deletedAt: null, date: { $gte: monthStart, $lte: monthEnd }, ...aggregateScope } },
      { $unwind: '$details' },
      {
        $group: {
          _id: '$details.product_id',
          quantity: { $sum: '$details.quantity' },
          total: { $sum: '$details.subtotal' },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          quantity: 1,
          total: 1,
          name: { $ifNull: ['$product.name', 'Unknown'] },
          code: { $ifNull: ['$product.code', '—'] },
        },
      },
    ])
    return NextResponse.json(topProducts)
  }

  if (report === 'payment_chart') {
    await requirePermission(user, 'Reports_sales')
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)

    const dateFilter = { deletedAt: null, date: { $gte: sevenDaysAgo }, ...aggregateScope }

    const [salesPayments, purchaseReturnPayments, purchasePayments, saleReturnPayments, expenses] = await Promise.all([
      PaymentSale.aggregate([
        { $match: dateFilter },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$montant' } } },
      ]),
      PaymentPurchaseReturn.aggregate([
        { $match: dateFilter },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$montant' } } },
      ]),
      PaymentPurchase.aggregate([
        { $match: dateFilter },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$montant' } } },
      ]),
      PaymentSaleReturn.aggregate([
        { $match: dateFilter },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$montant' } } },
      ]),
      Expense.aggregate([
        { $match: dateFilter },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' } } },
      ]),
    ])

    const days: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      days.push(d.toISOString().slice(0, 10))
    }

    const salesPayMap = Object.fromEntries(salesPayments.map((r: any) => [r._id, r.total]))
    const purRetPayMap = Object.fromEntries(purchaseReturnPayments.map((r: any) => [r._id, r.total]))
    const purPayMap = Object.fromEntries(purchasePayments.map((r: any) => [r._id, r.total]))
    const saleRetPayMap = Object.fromEntries(saleReturnPayments.map((r: any) => [r._id, r.total]))
    const expMap = Object.fromEntries(expenses.map((r: any) => [r._id, r.total]))

    const paymentReceived = days.map(d => round2((salesPayMap[d] ?? 0) + (purRetPayMap[d] ?? 0)))
    const paymentSent = days.map(d => round2((purPayMap[d] ?? 0) + (saleRetPayMap[d] ?? 0) + (expMap[d] ?? 0)))

    return NextResponse.json({
      days,
      payment_received: paymentReceived,
      payment_sent: paymentSent,
    })
  }

  if (report === 'count_quantity_alert') {
    const alerts = await ProductWarehouse.aggregate([
      { $match: { deletedAt: null } },
      { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $match: { 'product.deletedAt': null, 'product.has_alert': true } },
      { $match: { $expr: { $lte: ['$qte', '$product.alert_quantity'] } } },
      { $count: 'count' },
    ])
    return NextResponse.json({ count: alerts[0]?.count ?? 0 })
  }

  if (report === 'warehouse_count_stock') {
    await requirePermission(user, 'Warehouse_report')
    const data = await ProductWarehouse.aggregate([
      { $match: { deletedAt: null, qte: { $gt: 0 } } },
      { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $match: { 'product.deletedAt': null } },
      { $lookup: { from: 'warehouses', localField: 'warehouse_id', foreignField: '_id', as: 'warehouse' } },
      { $unwind: '$warehouse' },
      { $match: { 'warehouse.deletedAt': null } },
      {
        $group: {
          _id: '$warehouse_id',
          name: { $first: '$warehouse.name' },
          product_count: { $sum: 1 },
          total_quantity: { $sum: '$qte' },
          total_cost: { $sum: { $multiply: ['$qte', '$product.cost'] } },
          total_price: { $sum: { $multiply: ['$qte', '$product.price'] } },
        },
      },
      { $sort: { name: 1 } },
    ])
    return NextResponse.json(data)
  }

  throw new ApiError(400, 'Unknown report type')
})
