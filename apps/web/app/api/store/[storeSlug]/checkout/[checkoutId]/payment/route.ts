import { checkoutErrorResponse, checkoutJson, initiateNativeStripePayment, nativePaymentInitiationSchema, publicPaymentResult, requireCheckoutMutation } from '../../../../../../../lib/native-checkout-api';
import { readNativeCartJson, readNativeCartToken } from '../../../../../../../lib/native-cart-api';

type Params = { params: Promise<{ storeSlug: string; checkoutId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { storeSlug, checkoutId } = await params;
  try {
    requireCheckoutMutation(request);
    const body = nativePaymentInitiationSchema.parse(await readNativeCartJson(request));
    const token = readNativeCartToken(request, storeSlug);
    if (!token) return checkoutJson({ code: 'checkout_not_found' }, 404);
    const result = await initiateNativeStripePayment({ request, storeSlug, checkoutId, token, idempotencyKey: body.idempotencyKey });
    return checkoutJson(publicPaymentResult(result), result.idempotent ? 200 : 201);
  } catch (error) { return checkoutErrorResponse(error); }
}
