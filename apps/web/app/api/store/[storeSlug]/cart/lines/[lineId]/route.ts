import { NativeCartServiceError } from '@kablet/db';
import {
  cartErrorResponse,
  cartJson,
  cartMutationRequestSchema,
  clearNativeCartCookie,
  isSameOriginMutation,
  nativeCartLineIdSchema,
  NativeCartApiError,
  openNativeCartStore,
  readNativeCartJson,
  readNativeCartToken,
  setNativeCartCookie,
  updateNativeCartLineSchema,
} from '../../../../../../../lib/native-cart-api';

type Params = { params: Promise<{ storeSlug: string; lineId: string }> };

async function mutation(request: Request, params: Params['params'], operation: 'update' | 'remove') {
  const { storeSlug, lineId } = await params;
  if (!isSameOriginMutation(request)) return cartErrorResponse(new NativeCartApiError('origin_mismatch', 403));
  let opened: Awaited<ReturnType<typeof openNativeCartStore>> = null;
  try {
    const parsedLineId = nativeCartLineIdSchema.parse(lineId);
    const body = operation === 'update' ? updateNativeCartLineSchema.parse(await readNativeCartJson(request)) : cartMutationRequestSchema.parse(await readNativeCartJson(request));
    opened = await openNativeCartStore(storeSlug);
    if (!opened) return cartJson({ code: 'store_not_found' }, 404);
    const token = readNativeCartToken(request, storeSlug);
    if (!token) return cartJson({ code: 'cart_not_found', message: 'The cart was not found.' }, 401);
    const input = { ...opened.context, token, lineId: parsedLineId, ...body };
    const result = operation === 'update' ? await opened.service.updateLine(input) : await opened.service.removeLine(input);
    const response = cartJson({ cart: result.cart, idempotent: result.idempotent });
    setNativeCartCookie(response, storeSlug, token);
    return response;
  } catch (error) {
    const response = cartErrorResponse(error);
    if (error instanceof NativeCartServiceError && (error.code === 'cart_not_found' || error.code === 'cart_expired')) clearNativeCartCookie(response, storeSlug);
    return response;
  } finally { if (opened) await opened.runtime.pool.end(); }
}

export async function PATCH(request: Request, { params }: Params) { return mutation(request, params, 'update'); }
export async function DELETE(request: Request, { params }: Params) { return mutation(request, params, 'remove'); }
