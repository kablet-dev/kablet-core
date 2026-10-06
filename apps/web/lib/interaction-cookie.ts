import { cookies } from 'next/headers';

export const interactionCookieName = 'kablet_interaction';

export async function getInteractionHandle(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(interactionCookieName)?.value;
}
