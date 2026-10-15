import { z } from 'zod';

export const nativeStoreCurrencySchema = z.string().regex(/^[A-Z]{3}$/, 'currency must be an uppercase ISO 4217 code');
export const nativeStoreSlugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'store slug must contain only lowercase letters, numbers, and hyphens').max(100);
export const nativeStoreStatusSchema = z.enum(['draft', 'published', 'unavailable']);
export const nativeProductStatusSchema = z.enum(['draft', 'published', 'archived']);
export const nativeProductAvailabilitySchema = z.enum(['unknown', 'available', 'unavailable', 'stale']);
export const nativeProductSkuSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/, 'sku must be a stable product identifier');
export const nativeInventoryQuantitySchema = z.number().int().nonnegative().nullable();
export const nativePriceRevisionSchema = z.number().int().positive();

export const nativeProductSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  slug: nativeStoreSlugSchema,
  sku: nativeProductSkuSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  imageUrl: z.string().url().nullable(),
  amountMinor: z.string().regex(/^\d+$/, 'amountMinor must be a non-negative integer string'),
  currency: nativeStoreCurrencySchema,
  inventoryQuantity: nativeInventoryQuantitySchema,
  priceRevision: nativePriceRevisionSchema,
  status: nativeProductStatusSchema,
  availability: nativeProductAvailabilitySchema,
});

export const nativeStoreSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  businessId: z.string().uuid(),
  publicSlug: nativeStoreSlugSchema,
  name: z.string().trim().min(1).max(200),
  brandMark: z.string().max(120).nullable(),
  primaryCurrency: nativeStoreCurrencySchema,
  status: nativeStoreStatusSchema,
});

export const nativeStorefrontSchema = nativeStoreSchema.extend({ products: z.array(nativeProductSchema) }).superRefine((storefront, context) => {
  storefront.products.forEach((product, index) => {
    if (product.currency !== storefront.primaryCurrency) context.addIssue({ code: z.ZodIssueCode.custom, path: ['products', index, 'currency'], message: 'product currency must match the store primary currency' });
  });
});
export type NativeStore = z.infer<typeof nativeStoreSchema>;
export type NativeProduct = z.infer<typeof nativeProductSchema>;
export type NativeStorefront = z.infer<typeof nativeStorefrontSchema>;
export type NativeInventoryAvailability = z.infer<typeof nativeProductAvailabilitySchema>;

// A null quantity preserves legacy catalog records that have not yet been
// operationally configured for sale. A non-null quantity is authoritative
// for future cart validation and is always paired with a price revision.
export const nativeInventoryStateSchema = z.object({
  productId: z.string().uuid(),
  sku: nativeProductSkuSchema,
  inventoryQuantity: z.number().int().nonnegative(),
  availability: nativeProductAvailabilitySchema,
}).strict();
export type NativeInventoryState = z.infer<typeof nativeInventoryStateSchema>;

const zeroDecimalCurrencies = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
const threeDecimalCurrencies = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

export function currencyMinorUnitDigits(currency: string): number {
  const code = nativeStoreCurrencySchema.parse(currency);
  if (zeroDecimalCurrencies.has(code)) return 0;
  if (threeDecimalCurrencies.has(code)) return 3;
  return 2;
}

export function formatNativeMoney(amountMinor: string, currency: string): string {
  if (!/^\d+$/.test(amountMinor)) throw new Error('amountMinor must be a non-negative integer string');
  const digits = currencyMinorUnitDigits(currency);
  const padded = digits === 0 ? amountMinor : amountMinor.padStart(digits + 1, '0');
  const major = digits === 0 ? padded : padded.slice(0, -digits);
  const minor = digits === 0 ? '' : `.${padded.slice(-digits)}`;
  return `${currency} ${major}${minor}`;
}
