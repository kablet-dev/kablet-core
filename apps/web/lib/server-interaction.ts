import { loadInteractionServerConfig, loadServerConfig } from '@kablet/config';
import { createDb } from '@kablet/db';
import { createInteractionService } from './interaction-service';
import { createDemoIntentInterpreter } from './demo-intent-interpreter';
import type { IntentInterpreter } from '@kablet/domain';

let cachedService: ReturnType<typeof createInteractionService> | undefined;
export function createConfiguredIntentInterpreter(env: NodeJS.ProcessEnv = process.env): IntentInterpreter | undefined {
  if (env.KABLET_INTERACTION_ENABLE_DEMO_INTERPRETER !== 'true') return undefined;
  if (env.NODE_ENV !== 'development') throw new Error('demo intent interpreter is only available in development');
  return createDemoIntentInterpreter();
}

export function getInteractionService(): ReturnType<typeof createInteractionService> {
  if (cachedService) return cachedService;
  const config = loadServerConfig();
const interaction = loadInteractionServerConfig();
const database = createDb(config.DATABASE_URL);

  cachedService = createInteractionService({ db: database.db, organizationId: interaction.KABLET_INTERACTION_ORGANIZATION_ID, businessId: interaction.KABLET_INTERACTION_BUSINESS_ID, intentInterpreter: createConfiguredIntentInterpreter() });
  return cachedService;
}
