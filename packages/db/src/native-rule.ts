import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { nativeRuleConditionsSchema, nativeRuleSchema, nativeRuleSelectionSchema, type NativeRule, type NativeRuleConditions, type NativeRuleSelection } from '@kablet/domain';
import type { Database, DatabaseTransaction } from './index.js';

type Scope = { organizationId: string; businessId: string; storeId: string };
type Definition = Scope & Omit<NativeRule, 'contractVersion' | 'ruleId' | 'status' | 'organizationId' | 'businessId' | 'storeId'> & { createdBy: string };
type Row = Record<string, unknown>;

function mapRule(row: Row): NativeRule {
  return nativeRuleSchema.parse({
    contractVersion: 'native-rule.v1', ruleId: row.id, ruleKey: row.rule_key, version: Number(row.version),
    organizationId: row.organization_id, businessId: row.business_id, storeId: row.store_id, status: row.status,
    priority: Number(row.priority), conditions: row.conditions, composition: row.composition,
    reasonCode: row.reason_code, reason: row.reason,
  });
}

function txOrDb(db: Database['db'], transaction?: DatabaseTransaction): Database['db'] | DatabaseTransaction { return transaction ?? db; }

export function createNativeRuleRepository(db: Database['db']) {
  async function get(scope: Scope, ruleId: string, transaction?: DatabaseTransaction): Promise<NativeRule | null> {
    const result = await txOrDb(db, transaction).execute(sql`select * from kablet_native_rules where organization_id=${scope.organizationId}::uuid and business_id=${scope.businessId}::uuid and store_id=${scope.storeId}::uuid and id=${ruleId}::uuid`);
    return result.rows[0] ? mapRule(result.rows[0] as Row) : null;
  }
  async function updateStatus(scope: Scope, ruleId: string, status: string, actorId: string, transaction?: DatabaseTransaction) {
    const result = await txOrDb(db, transaction).execute(sql`update kablet_native_rules set status=${status}, approved_by=case when ${status} in ('approved','active') then coalesce(approved_by,${actorId}::uuid) else approved_by end, approved_at=case when ${status} in ('approved','active') then coalesce(approved_at,now()) else approved_at end, activated_at=case when ${status}='active' then now() else activated_at end where organization_id=${scope.organizationId}::uuid and business_id=${scope.businessId}::uuid and store_id=${scope.storeId}::uuid and id=${ruleId}::uuid returning *`);
    if (!result.rows[0]) throw new Error('native rule not found');
    return mapRule(result.rows[0] as Row);
  }
  return {
    get,
    async createDraft(input: Definition, transaction?: DatabaseTransaction): Promise<NativeRule> {
      const conditions = nativeRuleConditionsSchema.parse(input.conditions);
      const id = randomUUID();
      const result = await txOrDb(db, transaction).execute(sql`insert into kablet_native_rules(id,organization_id,business_id,store_id,rule_key,version,status,priority,conditions,composition,reason_code,reason,created_by) values (${id}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.storeId}::uuid,${input.ruleKey},${input.version},'draft',${input.priority},${JSON.stringify(conditions)}::jsonb,${input.composition},${input.reasonCode},${input.reason},${input.createdBy}::uuid) returning *`);
      return mapRule(result.rows[0] as Row);
    },
    async validate(scope: Scope, ruleId: string, actorId: string, transaction?: DatabaseTransaction): Promise<NativeRule> {
      const rule = await get(scope, ruleId, transaction);
      if (!rule || rule.status !== 'draft') throw new Error('native rule must be draft before validation');
      return updateStatus(scope, ruleId, 'validated', actorId, transaction);
    },
    async approve(scope: Scope, ruleId: string, actorId: string, transaction?: DatabaseTransaction): Promise<NativeRule> {
      const rule = await get(scope, ruleId, transaction);
      if (!rule || rule.status !== 'validated') throw new Error('native rule must be validated before approval');
      return updateStatus(scope, ruleId, 'approved', actorId, transaction);
    },
    async activate(scope: Scope, ruleId: string, actorId: string, transaction?: DatabaseTransaction): Promise<NativeRule> {
      const target = await get(scope, ruleId, transaction);
      if (!target || target.status !== 'approved') throw new Error('native rule must be approved before activation');
      const runner = txOrDb(db, transaction);
      await runner.execute(sql`update kablet_native_rules set status='disabled' where organization_id=${scope.organizationId}::uuid and business_id=${scope.businessId}::uuid and store_id=${scope.storeId}::uuid and rule_key=${target.ruleKey} and status='active'`);
      return updateStatus(scope, ruleId, 'active', actorId, transaction);
    },
    async disable(scope: Scope, ruleId: string, actorId: string, transaction?: DatabaseTransaction): Promise<NativeRule> {
      const target = await get(scope, ruleId, transaction);
      if (!target || target.status !== 'active') throw new Error('native rule must be active before disabling');
      return updateStatus(scope, ruleId, 'disabled', actorId, transaction);
    },
    async rollback(scope: Scope, ruleKey: string, version: number, actorId: string, transaction?: DatabaseTransaction): Promise<NativeRule> {
      const runner = txOrDb(db, transaction);
      const targetResult = await runner.execute(sql`select * from kablet_native_rules where organization_id=${scope.organizationId}::uuid and business_id=${scope.businessId}::uuid and store_id=${scope.storeId}::uuid and rule_key=${ruleKey} and version=${version}`);
      const target = targetResult.rows[0] ? mapRule(targetResult.rows[0] as Row) : null;
      if (!target || !['approved','disabled','rolled_back'].includes(target.status)) throw new Error('native rule version is not rollback eligible');
      await runner.execute(sql`update kablet_native_rules set status='rolled_back' where organization_id=${scope.organizationId}::uuid and business_id=${scope.businessId}::uuid and store_id=${scope.storeId}::uuid and rule_key=${ruleKey} and status='active'`);
      if (target.status === 'rolled_back') await runner.execute(sql`update kablet_native_rules set status='approved' where organization_id=${scope.organizationId}::uuid and business_id=${scope.businessId}::uuid and store_id=${scope.storeId}::uuid and id=${target.ruleId}::uuid`);
      return updateStatus(scope, target.ruleId, 'active', actorId, transaction);
    },
    async listActive(scope: Scope, transaction?: DatabaseTransaction): Promise<NativeRule[]> {
      const result = await txOrDb(db, transaction).execute(sql`select * from kablet_native_rules where organization_id=${scope.organizationId}::uuid and business_id=${scope.businessId}::uuid and store_id=${scope.storeId}::uuid and status='active' order by priority desc, version desc, rule_key asc, id asc`);
      return result.rows.map(row => mapRule(row as Row));
    },
    async selectActive(scope: Scope, input: { intent: NativeRule['conditions']['intent']; preference: NativeRule['conditions']['preference']; availableProductCount: number }, transaction?: DatabaseTransaction): Promise<NativeRuleSelection | null> {
      const rules = await this.listActive(scope, transaction);
      const selected = rules.find(rule => {
        const c = rule.conditions;
        return c.intent === input.intent && (c.preference === null || c.preference === input.preference) && (!c.requiresAvailableInventory || input.availableProductCount > 0) && (rule.composition !== 'discovery' || input.availableProductCount > 0);
      });
      return selected ? nativeRuleSelectionSchema.parse({ ruleId: selected.ruleId, ruleKey: selected.ruleKey, version: selected.version, composition: selected.composition, reasonCode: selected.reasonCode, reason: selected.reason }) : null;
    },
  };
}
