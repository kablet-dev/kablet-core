import { notFound } from 'next/navigation';
import { createDb, createNativeStoreRepository } from '@kablet/db';
import { loadServerConfig } from '@kablet/config';
import { AdaptiveNativeCanvas } from '../../../components/native/AdaptiveNativeCanvas';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }) {
  return { title: `Native Store · ${(await params).storeSlug}` };
}

export default async function NativeStorePage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const runtime = createDb(loadServerConfig().DATABASE_URL);
  try {
    const storefront = await createNativeStoreRepository(runtime.db).getPublishedStorefront(storeSlug);
    if (!storefront) notFound();
    return <AdaptiveNativeCanvas storefront={storefront} />;
  } finally {
    await runtime.pool.end();
  }
}
