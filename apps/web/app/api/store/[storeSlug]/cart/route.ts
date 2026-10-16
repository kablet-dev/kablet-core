import { NextResponse } from 'next/server';
import {
  cartErrorResponse,
  cartJson,
  clearNativeCartCookie,
  createNativeCartSchema,
  isSameOriginMutation,
  NativeCartApiError,
  openNativeCartStore,
  readNativeCartJson,
  readNativeCartToken,
  setNativeCartCookie,
} from '../../../../../lib/native-cart-api';
import { NativeCartServiceError } from '@kablet/db';

type Params = { params: Promise<{ storeSlug: string }> };

export async function GET(request: Request, { params }: Params) {
  const { storeSlug } = await params;
  let opened: Awaited<ReturnType<typeof openNativeCartStore>> = null;
  try { opened = await openNativeCartStore(storeSlug); } catch (error) { return cartErrorResponse(error); }
  if (!opened) return cartJson({ code: 'store_not_found' }, 404);
  const token = readNativeCartToken(request, storeSlug);
  if (!token) { await opened.runtime.pool.end(); return cartJson({ cart: null }); }
  try {
    const cart = await opened.service.getCart({ ...opened.context, token });
    const response = cartJson({ cart });
    setNativeCartCookie(response, storeSlug, token);
    return response;
  } catch (error) {
    if (error instanceof NativeCartServiceError && (error.code === 'cart_not_found' || error.code === 'cart_expired')) {
      const response = cartJson({ cart: null });
      clearNativeCartCookie(response, storeSlug);
      return response;
    }
    return cartErrorResponse(error);
  } finally { await opened.runtime.pool.end(); }
}
export async function POST(request: Request, { params }: Params) {
  const { storeSlug } = await params;
  if (!isSameOriginMutation(request)) return cartErrorResponse(new NativeCartApiError('origin_mismatch', 403));
  let opened: Awaited<ReturnType<typeof openNativeCartStore>> = null;
  let idempotencyKey: string;
  try {
    const body = createNativeCartSchema.parse(await readNativeCartJson(request));
    opened = await openNativeCartStore(storeSlug);
    idempotencyKey = body.idempotencyKey;
  } catch (error) { return cartErrorResponse(error); }
  if (!opened) return cartJson({ code: 'store_not_found' }, 404);
  const existingToken = readNativeCartToken(request, storeSlug);
  try {
    if (existingToken) {
      try {
        const cart = await opened.service.getCart({ ...opened.context, token: existingToken });
        const response = cartJson({ cart });
        setNativeCartCookie(response, storeSlug, existingToken);
        return response;
      } catch (error) {
        if (!(error instanceof NativeCartServiceError) || (error.code !== 'cart_not_found' && error.code !== 'cart_expired')) throw error;
        const response = cartErrorResponse(error);
        clearNativeCartCookie(response, storeSlug);
        return response;
      }
    }
    const created = await opened.service.createCart(opened.context, { idempotencyKey });
    const response = cartJson({ cart: created.cart }, 201);
    setNativeCartCookie(response, storeSlug, created.token);
    return response;
  } catch (error) { return cartErrorResponse(error); }
  finally { await opened.runtime.pool.end(); }
}
