import { NativeCartServiceError } from '@kablet/db';
import {
  addNativeCartLineSchema,
  cartErrorResponse,
  cartJson,
  clearNativeCartCookie,
  isSameOriginMutation,
  NativeCartApiError,
  openNativeCartStore,
  readNativeCartJson,
  readNativeCartToken,
  setNativeCartCookie,
} from '../../../../../../lib/native-cart-api';

type Params = { params: Promise<{ storeSlug: string }> };

export async function POST(request: Request, { params }: Params) {
  const { storeSlug } = await params;
  if (!isSameOriginMutation(request)) return cartErrorResponse(new NativeCartApiError('origin_mismatch', 403));
  let opened: Awaited<ReturnType<typeof openNativeCartStore>> = null;
  try {
    const body = addNativeCartLineSchema.parse(await readNativeCartJson(request));
    opened = await openNativeCartStore(storeSlug);
    if (!opened) return cartJson({ code: 'store_not_found' }, 404);
    const token = readNativeCartToken(request, storeSlug);
    if (!token) return cartJson({ code: 'cart_not_found', message: 'Create a cart before adding products.' }, 401);
    const result = await opened.service.addLine({ ...opened.context, token, ...body });
    const response = cartJson({ cart: result.cart, idempotent: result.idempotent });
    setNativeCartCookie(response, storeSlug, token);
    return response;
  } catch (error) {
    const response = cartErrorResponse(error);
    if (error instanceof NativeCartServiceError && (error.code === 'cart_not_found' || error.code === 'cart_expired')) clearNativeCartCookie(response, storeSlug);
    return response;
  } finally { if (opened) await opened.runtime.pool.end(); }
}
