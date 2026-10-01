import { NextResponse } from 'next/server';
export async function GET(){ return NextResponse.json({status:'ok', application:'ready', database:'not_checked'}, {status:200}); }
