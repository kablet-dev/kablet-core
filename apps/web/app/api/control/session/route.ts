import { NextResponse } from 'next/server';
import { issueControlSession, revokeControlSession, resolveControlContext } from '../../../../lib/control-auth';

function unauthorized() { return NextResponse.json({ code: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } }); }

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return unauthorized();
  try { const session = await issueControlSession(token); return session ? NextResponse.json({ session }, { headers: { 'Cache-Control': 'no-store' } }) : unauthorized(); } catch { return unauthorized(); }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organizationId');
  const businessId = url.searchParams.get('businessId');
  if (!organizationId || !businessId) return unauthorized();
  try { const context = await resolveControlContext(organizationId, businessId); return context ? NextResponse.json({ context: { ...context, capabilities: context.capabilities } }, { headers: { 'Cache-Control': 'no-store' } }) : unauthorized(); } catch { return unauthorized(); }
}

export async function DELETE() { try { await revokeControlSession(); } catch { /* revoke remains fail-closed */ } return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } }); }
