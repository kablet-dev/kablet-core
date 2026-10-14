import { NextResponse } from 'next/server';
import { issuePlatformOperatorSession, revokePlatformOperatorSession } from '../../../../lib/control-auth';

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  try {
    const session = await issuePlatformOperatorSession(token);
    return session ? NextResponse.json({ session }, { headers: { 'Cache-Control': 'no-store' } }) : NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  } catch { return NextResponse.json({ code: 'unauthorized' }, { status: 401 }); }
}

export async function DELETE() {
  try { await revokePlatformOperatorSession(); } catch { /* revocation remains fail-closed */ }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
