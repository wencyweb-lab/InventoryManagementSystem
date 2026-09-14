import test from "node:test";
import assert from "node:assert/strict";
import {
  calcGrandTotal,
  calcLine,
  calcPaymentStatus,
  fromBaseQty,
  purchaseAddsStock,
  purchaseReturnSubtractsStock,
  saleReturnAddsStock,
  saleSubtractsStock,
  toBaseQty,
  transferEffect,
} from "../lib/calculations";

test("unit conversion preserves the base-unit invariant for multiply units", () => {
  const unit = { operator: "*" as const, operator_value: 12 };
  assert.equal(toBaseQty(3, unit), 36);
  assert.equal(fromBaseQty(36, unit), 3);
});

test("unit conversion preserves the legacy divide convention", () => {
  const unit = { operator: "/" as const, operator_value: 0.25 };
  assert.equal(toBaseQty(2, unit), 8);
  assert.equal(fromBaseQty(8, unit), 2);
});

test("invalid unit conversion cannot create infinity", () => {
  assert.throws(
    () => toBaseQty(1, { operator: "/", operator_value: 0 }),
    /greater than zero/,
  );
});

test("exclusive tax line matches Stocky arithmetic", () => {
  assert.deepEqual(
    calcLine({
      unitPrice: 100,
      quantity: 2,
      discount: 10,
      discountMethod: "1",
      taxRate: 20,
      taxMethod: "1",
    }),
    {
      discountNet: 10,
      net: 90,
      taxAmount: 18,
      subtotal: 216,
    },
  );
});

test("inclusive tax line removes discount before extracting tax", () => {
  assert.deepEqual(
    calcLine({
      unitPrice: 120,
      quantity: 2,
      discount: 20,
      discountMethod: "2",
      taxRate: 20,
      taxMethod: "2",
    }),
    {
      discountNet: 20,
      net: 83.3333,
      taxAmount: 16.6667,
      subtotal: 200,
    },
  );
});

test("header total applies order discount, tax, and shipping in order", () => {
  assert.deepEqual(
    calcGrandTotal({
      lineSubtotals: [100, 50],
      orderDiscount: 10,
      orderTaxRate: 10,
      shipping: 5,
    }),
    {
      detailTotal: 150,
      taxableBase: 140,
      taxNet: 14,
      grandTotal: 159,
    },
  );
});

test("payment status is derived and tolerant of cent rounding", () => {
  assert.equal(calcPaymentStatus(0, 100), "unpaid");
  assert.equal(calcPaymentStatus(25, 100), "partial");
  assert.equal(calcPaymentStatus(99.999, 100), "paid");
});

test("all legacy stock trigger statuses are explicit", () => {
  assert.equal(purchaseAddsStock("received"), true);
  assert.equal(purchaseAddsStock("pending"), false);
  assert.equal(saleSubtractsStock("completed"), true);
  assert.equal(saleReturnAddsStock("received"), true);
  assert.equal(purchaseReturnSubtractsStock("completed"), true);
  assert.deepEqual(transferEffect("sent"), {
    removeSource: true,
    addDest: false,
  });
  assert.deepEqual(transferEffect("completed"), {
    removeSource: true,
    addDest: true,
  });
  assert.deepEqual(transferEffect("pending"), {
    removeSource: false,
    addDest: false,
  });
});

test("initial payment derivations correctly calculate paid amount, status, and change", () => {
  const grandTotal = 150;
  assert.equal(calcPaymentStatus(150, grandTotal), "paid");
  assert.equal(calcPaymentStatus(50, grandTotal), "partial");
  assert.equal(calcPaymentStatus(0, grandTotal), "unpaid");
  const paying = 150;
  const received = 200;
  const change = Math.max(0, received - paying);
  assert.equal(change, 50);
});
