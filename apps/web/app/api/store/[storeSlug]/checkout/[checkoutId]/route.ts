import { checkoutErrorResponse, checkoutJson, openNativeCheckoutStore } from '../../../../../../lib/native-checkout-api';
import { readNativeCartToken } from '../../../../../../lib/native-cart-api';
import { createNativeVerifiedOrderService } from '@kablet/db';

type Params = { params: Promise<{ storeSlug: string; checkoutId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { storeSlug, checkoutId } = await params;
  const opened = await openNativeCheckoutStore(storeSlug);
  if (!opened) return checkoutJson({ code: 'store_not_found' }, 404);
  try {
    const token = readNativeCartToken(request, storeSlug);
    if (!token) return checkoutJson({ code: 'checkout_not_found' }, 404);
    const result = await opened.service.getCheckout({ ...opened.context, checkoutId, token });
    const order = await createNativeVerifiedOrderService(opened.runtime.db).getOrderForCheckout({ ...opened.context, checkoutId });
    return checkoutJson({ checkout: result.checkout, reservations: result.reservations, order });
  } catch (error) { return checkoutErrorResponse(error); }
  finally { await opened.runtime.pool.end().catch(() => undefined); }
}
