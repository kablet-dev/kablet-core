import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { businessIntentPolicyRevisionSchema, intentPolicyContractVersion, qualificationRequirementsForIntent, type BusinessIntentPolicyRevision } from '@kablet/domain';
import type { Database, DatabaseTransaction } from './index.js';

type Tx = DatabaseTransaction;
const uuid = /^[0-9a-f-]{36}$/i;

async function scoped<T>(db: Database['db'], organizationId: string, businessId: string, fn: (tx: Tx) => Promise<T>, existingTx?: Tx) {
  if (!uuid.test(organizationId) || !uuid.test(businessId)) throw new Error('invalid tenant context');
  const run = async (tx: Tx) => {
    await tx.execute(sql`select set_config('kablet.organization_id',${organizationId},true),set_config('kablet.business_id',${businessId},true)`);
    const business = await tx.execute(sql`select 1 from businesses where id=${businessId}::uuid and organization_id=${organizationId}::uuid and active`);
    if (!business.rows[0]) throw new Error('business does not belong to organization');
    return fn(tx);
  };
  return existingTx ? run(existingTx) : db.transaction(run);
}

function rowToPolicy(row: Record<string, unknown>, requirements: Record<string, unknown>[], rules: Record<string, unknown>[], refs: Record<string, unknown>[]): BusinessIntentPolicyRevision {
  const policy = businessIntentPolicyRevisionSchema.parse({ contractVersion: intentPolicyContractVersion, id: row.id, organizationId: row.organization_id, businessId: row.business_id, policyKey: row.policy_key, revisionNumber: Number(row.revision_number), createdAt: row.created_at, qualificationRequirements: requirements.map(item => ({ key: item.requirement_key, prompt: item.prompt, options: item.options })), intentRules: rules.map(rule => ({ intent: rule.intent, qualificationRequirementKeys: refs.filter(ref => ref.intent === rule.intent).map(ref => String(ref.requirement_key)) })) });
  return policy;
}

export function createIntentPolicyRepository(db: Database['db'], existingTx?: Tx) {
  return {
    async createRevision(input: Omit<BusinessIntentPolicyRevision, 'contractVersion' | 'revisionNumber' | 'createdAt' | 'id'> & { createdAt?: Date }) {
      businessIntentPolicyRevisionSchema.parse({ ...input, contractVersion: intentPolicyContractVersion, id: randomUUID(), revisionNumber: 1, createdAt: input.createdAt ?? new Date() });
      return scoped(db, input.organizationId, input.businessId, async tx => {
        const key = `${input.organizationId}:${input.businessId}:${input.policyKey}`;
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key},0))`);
        const next = await tx.execute(sql`select coalesce(max(revision_number),0)+1 as next_revision from business_intent_policy_revisions where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and policy_key=${input.policyKey}`);
        const revisionNumber = Number(next.rows[0].next_revision);
        const id = randomUUID();
        await tx.execute(sql`insert into business_intent_policy_revisions(id,organization_id,business_id,policy_key,revision_number,created_at) values (${id}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.policyKey},${revisionNumber},${input.createdAt ?? new Date()})`);
        for (const requirement of input.qualificationRequirements) await tx.execute(sql`insert into business_intent_policy_requirements(organization_id,business_id,policy_revision_id,requirement_key,prompt,options) values (${input.organizationId}::uuid,${input.businessId}::uuid,${id}::uuid,${requirement.key},${requirement.prompt},${JSON.stringify(requirement.options)}::jsonb)`);
        for (const rule of input.intentRules) {
          await tx.execute(sql`insert into business_intent_policy_rules(organization_id,business_id,policy_revision_id,intent) values (${input.organizationId}::uuid,${input.businessId}::uuid,${id}::uuid,${rule.intent})`);
          for (const keyRef of rule.qualificationRequirementKeys) await tx.execute(sql`insert into business_intent_policy_rule_requirements(organization_id,business_id,policy_revision_id,intent,requirement_key) values (${input.organizationId}::uuid,${input.businessId}::uuid,${id}::uuid,${rule.intent},${keyRef})`);
        }
        return this.getById(input.organizationId, input.businessId, id, tx);
      }, existingTx);
    },
    async publish(organizationId: string, businessId: string, policyKey: string, revisionId: string) {
      return scoped(db, organizationId, businessId, async tx => {
        const revision = await tx.execute(sql`select 1 from business_intent_policy_revisions where organization_id=${organizationId}::uuid and business_id=${businessId}::uuid and policy_key=${policyKey} and id=${revisionId}::uuid`);
        if (!revision.rows[0]) throw new Error('policy revision not found');
        await tx.execute(sql`insert into business_intent_policy_publications(organization_id,business_id,policy_key,revision_id) values (${organizationId}::uuid,${businessId}::uuid,${policyKey},${revisionId}::uuid) on conflict (organization_id,business_id,policy_key) do update set revision_id=excluded.revision_id,published_at=now()`);
      }, existingTx);
    },
    async getById(organizationId: string, businessId: string, revisionId: string, tx?: Tx): Promise<BusinessIntentPolicyRevision> {
      return scoped(db, organizationId, businessId, async inner => {
        const base = await inner.execute(sql`select * from business_intent_policy_revisions where organization_id=${organizationId}::uuid and business_id=${businessId}::uuid and id=${revisionId}::uuid`);
        if (!base.rows[0]) throw new Error('policy revision not found');
        const requirements = await inner.execute(sql`select requirement_key,prompt,options from business_intent_policy_requirements where organization_id=${organizationId}::uuid and business_id=${businessId}::uuid and policy_revision_id=${revisionId}::uuid order by requirement_key`);
        const rules = await inner.execute(sql`select intent from business_intent_policy_rules where organization_id=${organizationId}::uuid and business_id=${businessId}::uuid and policy_revision_id=${revisionId}::uuid order by intent`);
        const refs = await inner.execute(sql`select intent,requirement_key from business_intent_policy_rule_requirements where organization_id=${organizationId}::uuid and business_id=${businessId}::uuid and policy_revision_id=${revisionId}::uuid order by intent,requirement_key`);
        return rowToPolicy(base.rows[0] as Record<string, unknown>, requirements.rows as Record<string, unknown>[], rules.rows as Record<string, unknown>[], refs.rows as Record<string, unknown>[]);
      }, tx);
    },
    async getCurrent(organizationId: string, businessId: string, policyKey: string): Promise<BusinessIntentPolicyRevision> {
      return scoped(db, organizationId, businessId, async tx => {
        const current = await tx.execute(sql`select revision_id from business_intent_policy_publications where organization_id=${organizationId}::uuid and business_id=${businessId}::uuid and policy_key=${policyKey}`);
        if (!current.rows[0]) throw new Error('published intent policy not found');
        return this.getById(organizationId, businessId, String(current.rows[0].revision_id), tx);
      });
    },
    qualificationRequirementsForIntent,
  };
}
