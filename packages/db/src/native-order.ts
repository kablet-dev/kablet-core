import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { nativeOrderCommitResultSchema, nativeVerifiedOrderSchema, type NativeOrderCommitResult, type NativeVerifiedOrder } from '@kablet/domain';
import type { Database } from './index.js';

const keyPattern = /^[A-Za-z0-9_-]{32,512}$/;

function hashCommitmentKey(value: string): Buffer {
  if (!keyPattern.test(value)) throw new Error('commitment key is invalid');
  return createHash('sha256').update(value, 'utf8').digest();
}
function date(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function mapOrder(order: Record<string, unknown>, lines: Array<Record<string, unknown>>): NativeVerifiedOrder {
  return nativeVerifiedOrderSchema.parse({
    contractVersion: 'native-order.v1',
    orderId: order.id,
    publicReference: order.public_reference,
    organizationId: order.organization_id,
    businessId: order.business_id,
    storeId: order.store_id,
    checkoutId: order.checkout_id,
    cartId: order.cart_id,
    paymentId: order.payment_id,
    merchantPaymentAccountId: order.merchant_payment_account_id,
    evidenceId: order.evidence_id,
    fulfillmentType: order.fulfillment_type,
    currency: order.currency,
    subtotalAmountMinor: String(order.subtotal_amount_minor),
    shippingAmountMinor: String(order.shipping_amount_minor),
    taxAmountMinor: String(order.tax_amount_minor),
    totalAmountMinor: String(order.total_amount_minor),
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    verifiedAt: date(order.verified_at),
    createdAt: date(order.created_at),
    updatedAt: date(order.updated_at),
    lines: lines.map(line => ({
      contractVersion: 'native-order-line.v1', lineId: line.id, orderId: line.order_id,
      productId: line.product_id, fulfillmentType: line.fulfillment_type, sku: line.sku_snapshot,
      quantity: Number(line.quantity), unitAmountMinor: String(line.unit_amount_minor), lineAmountMinor: String(line.line_amount_minor),
      currency: line.currency, priceRevision: Number(line.price_revision), productTitleSnapshot: line.product_title_snapshot,
      shippingAmountMinor: String(line.shipping_amount_minor), taxAmountMinor: String(line.tax_amount_minor),
    })),
  });
}

export type NativeVerifiedOrderCommitInput = {
  organizationId: string;
  businessId: string;
  storeId: string;
  paymentId: string;
  evidenceId: string;
  commitmentKey: string;
};

export function createNativeVerifiedOrderService(db: Database['db']) {
  return {
    async commitCapturedPayment(input: NativeVerifiedOrderCommitInput): Promise<NativeOrderCommitResult> {
      const commitmentKeyHash = hashCommitmentKey(input.commitmentKey);
      return db.transaction(async tx => {
        const result = await tx.execute(sql`
          select * from kablet_commit_verified_native_order(
            ${input.organizationId}::uuid, ${input.businessId}::uuid, ${input.storeId}::uuid,
            ${input.paymentId}::uuid, ${input.evidenceId}::uuid, ${commitmentKeyHash}
          )
        `);
        const outcome = result.rows[0] as Record<string, unknown> | undefined;
        if (!outcome) throw new Error('verified order commitment returned no result');
        const recoveryRequired = outcome.recovery_required === true;
        if (recoveryRequired) {
          return nativeOrderCommitResultSchema.parse({
            contractVersion: 'native-order-commit-result.v1', order: null, idempotent: false, recoveryRequired: true,
            recoveryId: outcome.recovery_id, recoveryReason: outcome.recovery_reason,
          });
        }
        const orderId = String(outcome.order_id);
        const orderResult = await tx.execute(sql`
          select id, organization_id, business_id, store_id, public_reference, checkout_id, cart_id, payment_id,
            merchant_payment_account_id, evidence_id, fulfillment_type, currency, subtotal_amount_minor,
            shipping_amount_minor, tax_amount_minor, total_amount_minor, payment_status, fulfillment_status,
            verified_at, created_at, updated_at
          from kablet_native_orders
          where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid
            and store_id=${input.storeId}::uuid and id=${orderId}::uuid
        `);
        const order = orderResult.rows[0] as Record<string, unknown> | undefined;
        if (!order) throw new Error('verified order was not readable after commitment');
        const lineResult = await tx.execute(sql`
          select id, order_id, product_id, fulfillment_type, sku_snapshot, quantity, unit_amount_minor,
            line_amount_minor, currency, price_revision, product_title_snapshot, shipping_amount_minor,
            tax_amount_minor
          from kablet_native_order_lines
          where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid
            and store_id=${input.storeId}::uuid and order_id=${orderId}::uuid order by id
        `);
        const mapped = mapOrder(order, lineResult.rows as Array<Record<string, unknown>>);
        return nativeOrderCommitResultSchema.parse({
          contractVersion: 'native-order-commit-result.v1', order: mapped,
          idempotent: outcome.idempotent === true, recoveryRequired: false, recoveryId: null, recoveryReason: null,
        });
      });
    },
  };
}
