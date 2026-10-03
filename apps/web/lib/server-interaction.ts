import { loadInteractionServerConfig, loadServerConfig } from '@kablet/config';
import { createDb } from '@kablet/db';
import { createInteractionService } from './interaction-service';

let cachedService: ReturnType<typeof createInteractionService> | undefined;

export function getInteractionService(): ReturnType<typeof createInteractionService> {
  if (cachedService) return cachedService;
  const config = loadServerConfig();
const interaction = loadInteractionServerConfig();
const database = createDb(config.DATABASE_URL);

  cachedService = createInteractionService({ db: database.db, organizationId: interaction.KABLET_INTERACTION_ORGANIZATION_ID, businessId: interaction.KABLET_INTERACTION_BUSINESS_ID });
  return cachedService;
}
