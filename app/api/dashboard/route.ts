import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { requireSession, recordScopeMatch, scopedFilter } from '@/lib/permissions'
import Sale from '@/models/Sale'
import Purchase from '@/models/Purchase'
import { PaymentSale, PaymentSaleReturn, PaymentPurchase, PaymentPurchaseReturn } from '@/models/Payments'
import { Expense } from '@/models/Expense'
import Product from '@/models/Product'
import ProductWarehouse from '@/models/ProductWarehouse'
import Client from '@/models/Client'
import '@/models/Provider'
import { subDays, startOfDay, format } from 'date-fns'
import { round2 } from '@/lib/calculations'

export async function GET() {
  try {
    const user = await requireSession()
    await dbConnect()
    const scope = recordScopeMatch(user)

    const now = new Date()
    const today = startOfDay(now)
    const sevenDaysAgo = subDays(today, 6)

    // 7-day sales/purchases and payment trends
    const [salesChart, purchasesChart, salePayChart, purRetPayChart, purPayChart, saleRetPayChart, expChart] = await Promise.all([
      Sale.aggregate([
        { $match: { deletedAt: null, date: { $gte: sevenDaysAgo }, ...scope } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$GrandTotal' } } },
        { $sort: { _id: 1 } },
      ]),
      Purchase.aggregate([
        { $match: { deletedAt: null, date: { $gte: sevenDaysAgo }, ...scope } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$GrandTotal' } } },
        { $sort: { _id: 1 } },
      ]),
      PaymentSale.aggregate([
        { $match: { deletedAt: null, date: { $gte: sevenDaysAgo }, ...scope } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$montant' } } },
      ]),
      PaymentPurchaseReturn.aggregate([
        { $match: { deletedAt: null, date: { $gte: sevenDaysAgo }, ...scope } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$montant' } } },
      ]),
      PaymentPurchase.aggregate([
        { $match: { deletedAt: null, date: { $gte: sevenDaysAgo }, ...scope } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$montant' } } },
      ]),
      PaymentSaleReturn.aggregate([
        { $match: { deletedAt: null, date: { $gte: sevenDaysAgo }, ...scope } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$montant' } } },
      ]),
      Expense.aggregate([
        { $match: { deletedAt: null, date: { $gte: sevenDaysAgo }, ...scope } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' } } },
      ]),
    ])

    // Fill all 7 days
    const days: string[] = []
    for (let i = 6; i >= 0; i--) {
      days.push(format(subDays(now, i), 'yyyy-MM-dd'))
    }
    const salesMap = Object.fromEntries(salesChart.map((r: any) => [r._id, r.total]))
    const purchasesMap = Object.fromEntries(purchasesChart.map((r: any) => [r._id, r.total]))
    const chartData = days.map(d => ({
      date: d,
      sales: salesMap[d] ?? 0,
      purchases: purchasesMap[d] ?? 0,
    }))

    const salePayMap = Object.fromEntries(salePayChart.map((r: any) => [r._id, r.total]))
    const purRetPayMap = Object.fromEntries(purRetPayChart.map((r: any) => [r._id, r.total]))
    const purPayMap = Object.fromEntries(purPayChart.map((r: any) => [r._id, r.total]))
    const saleRetPayMap = Object.fromEntries(saleRetPayChart.map((r: any) => [r._id, r.total]))
    const expMap = Object.fromEntries(expChart.map((r: any) => [r._id, r.total]))

    const paymentChartData = days.map(d => ({
      date: d,
      received: round2((salePayMap[d] ?? 0) + (purRetPayMap[d] ?? 0)),
      sent: round2((purPayMap[d] ?? 0) + (saleRetPayMap[d] ?? 0) + (expMap[d] ?? 0)),
    }))

    // Today's totals
    const [todaySales, todayPurchases, todayRevenue, todayExpenses] = await Promise.all([
      Sale.aggregate([
        { $match: { deletedAt: null, date: { $gte: today }, ...scope } },
        { $group: { _id: null, total: { $sum: '$GrandTotal' }, count: { $sum: 1 } } },
      ]),
      Purchase.aggregate([
        { $match: { deletedAt: null, date: { $gte: today }, ...scope } },
        { $group: { _id: null, total: { $sum: '$GrandTotal' }, count: { $sum: 1 } } },
      ]),
      PaymentSale.aggregate([
        { $match: { deletedAt: null, date: { $gte: today }, ...scope } },
        { $group: { _id: null, total: { $sum: '$montant' } } },
      ]),
      Expense.aggregate([
        { $match: { deletedAt: null, date: { $gte: today }, ...scope } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ])

    // Stock alerts
    const alerts = await ProductWarehouse.aggregate([
      { $match: { deletedAt: null } },
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      { $match: { 'product.deletedAt': null, 'product.has_alert': true } },
      {
        $addFields: {
          alertQuantity: '$product.alert_quantity',
          belowAlert: { $lte: ['$qte', '$product.alert_quantity'] },
        },
      },
      { $match: { belowAlert: true } },
      {
        $project: {
          productName: '$product.name',
          productCode: '$product.code',
          currentQty: '$qte',
          alertQty: '$alertQuantity',
          warehouse_id: 1,
        },
      },
      { $limit: 10 },
    ])

    // Latest sales
    const latestSales = await Sale.find(scopedFilter(user, { deletedAt: null }))
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('client_id', 'name')
      .populate('user_id', 'name')
      .select('Ref date GrandTotal payment_status status client_id')

    // Top customers this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const topCustomers = await Sale.aggregate([
      { $match: { deletedAt: null, date: { $gte: monthStart }, ...scope } },
      { $group: { _id: '$client_id', total: { $sum: '$GrandTotal' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'clients', localField: '_id', foreignField: '_id', as: 'client' } },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ['$client.name', 'Walk-in'] }, total: 1, count: 1 } },
    ])

    // Top products by quantity sold this year
    const yearStart = new Date(now.getFullYear(), 0, 1)
    const topProducts = await Sale.aggregate([
      { $match: { deletedAt: null, date: { $gte: yearStart }, ...scope } },
      { $unwind: '$details' },
      { $group: { _id: '$details.product_id', quantity: { $sum: '$details.quantity' }, revenue: { $sum: '$details.subtotal' } } },
      { $sort: { quantity: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ['$product.name', 'Unknown'] }, code: { $ifNull: ['$product.code', ''] }, quantity: 1, revenue: 1 } },
    ])

    // Total counts
    const [totalProducts, totalCustomers] = await Promise.all([
      Product.countDocuments({ deletedAt: null }),
      Client.countDocuments({ deletedAt: null }),
    ])

    return NextResponse.json({
      chartData,
      paymentChartData,
      today: {
        sales: { total: todaySales[0]?.total ?? 0, count: todaySales[0]?.count ?? 0 },
        purchases: { total: todayPurchases[0]?.total ?? 0, count: todayPurchases[0]?.count ?? 0 },
        revenue: todayRevenue[0]?.total ?? 0,
        expenses: todayExpenses[0]?.total ?? 0,
      },
      alerts,
      latestSales,
      topCustomers,
      topProducts,
      totals: { products: totalProducts, customers: totalCustomers },
    })
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: err.status ?? 500 })
  }
}
