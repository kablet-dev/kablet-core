import { NativeCheckoutServiceError } from '@kablet/db';
import { checkoutErrorResponse, checkoutJson, nativeCheckoutRequestSchema, openNativeCheckoutStore, requireCheckoutMutation } from '../../../../../lib/native-checkout-api';
import { clearNativeCartCookie, readNativeCartJson, readNativeCartToken, setNativeCartCookie } from '../../../../../lib/native-cart-api';

type Params = { params: Promise<{ storeSlug: string }> };

export async function POST(request: Request, { params }: Params) {
  const { storeSlug } = await params;
  let opened: Awaited<ReturnType<typeof openNativeCheckoutStore>> = null;
  try {
    requireCheckoutMutation(request);
    const body = nativeCheckoutRequestSchema.parse(await readNativeCartJson(request));
    opened = await openNativeCheckoutStore(storeSlug);
    if (!opened) return checkoutJson({ code: 'store_not_found' }, 404);
    const token = readNativeCartToken(request, storeSlug);
    if (!token) return checkoutJson({ code: 'cart_not_found', message: 'A cart is required before checkout.' }, 401);
    const result = await opened.service.confirmReservation({ ...opened.context, token, ...body });
    const response = checkoutJson({ checkout: result.checkout, reservations: result.reservations, idempotent: result.idempotent }, result.idempotent ? 200 : 201);
    setNativeCartCookie(response, storeSlug, token);
    return response;
  } catch (error) {
    const response = checkoutErrorResponse(error);
    if (error instanceof NativeCheckoutServiceError && (error.code === 'checkout_expired' || error.code === 'checkout_not_found')) clearNativeCartCookie(response, storeSlug);
    return response;
  } finally { await opened?.runtime.pool.end().catch(() => undefined); }
}
