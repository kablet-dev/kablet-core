import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { notFound } from 'next/navigation';
import { createDb, createNativeStoreRepository } from '@kablet/db';
import { loadServerConfig } from '@kablet/config';
import { AdaptiveNativeCanvas } from '../../../components/native/AdaptiveNativeCanvas';
import type { EntryStrategy } from '../../../lib/native-canvas';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }) {
  return { title: `Native Store · ${(await params).storeSlug}` };
}

const previewStrategies = new Set<EntryStrategy>(['editorial', 'product-led', 'typography-led']);
const veloraEditorialRelativePath = 'demo/velora/editorial/velora-botanical-campaign.jpg';

function findLocalPublicAsset(relativePath: string): string | null {
  const candidates = [
    resolve(process.cwd(), 'public', relativePath),
    resolve(process.cwd(), 'apps/web/public', relativePath),
  ];
  return candidates.find(candidate => existsSync(candidate)) ? `/${relativePath}` : null;
}

export default async function NativeStorePage({ params, searchParams }: { params: Promise<{ storeSlug: string }>; searchParams?: Promise<{ entryStrategy?: string }> }) {
  const { storeSlug } = await params;
  const requestedPreview = (await searchParams)?.entryStrategy;
  const entryStrategyPreview = process.env.NODE_ENV !== 'production' && requestedPreview && previewStrategies.has(requestedPreview as EntryStrategy)
    ? requestedPreview as EntryStrategy
    : undefined;
  const veloraEditorialAsset = process.env.NODE_ENV !== 'production' && storeSlug === 'velora-demo'
    ? findLocalPublicAsset(veloraEditorialRelativePath)
    : null;
  const runtime = createDb(loadServerConfig().DATABASE_URL);
  try {
    const storefront = await createNativeStoreRepository(runtime.db).getPublishedStorefront(storeSlug);
    if (!storefront) notFound();
    return <AdaptiveNativeCanvas storefront={storefront} entryStrategyPreview={entryStrategyPreview} approvedEditorialImageUrl={veloraEditorialAsset} />;
  } finally {
    await runtime.pool.end();
  }
}
