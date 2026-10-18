import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { evaluateNativeCanvasDecision, nativeCanvasSignalSchema, nativeGuidanceRequestSchema, nativeGuidanceResponseSchema, nativeRuleIntentFor, observationSchema, type NativeCanvasSignal, type NativeGuidanceRequest, type NativeGuidanceResponse, type NativeRuleSelection } from '@kablet/domain';
import type { Database, DatabaseTransaction } from './index.js';
import { createInteractionSessionRepository } from './interaction.js';
import { createVisitorStateRepository } from './visitor-state.js';
import { createNativeExperimentRepository } from './native-experiment.js';
import { createNativeRuleRepository } from './native-rule.js';

type Context = { organizationId: string; businessId: string; storeId?: string };
export type NativeIntelligenceLineage = {
  visitorIdentityId: string;
  visitorSessionId: string;
  interactionSessionId: string;
  decisionId: string | null;
  exposureId: string | null;
  compositionId: string | null;
  compositionVersion: string | null;
};
type Result = { handle: string | null; composition: 'entry' | 'discovery' | 'comparison'; compositionVersion: 'native-canvas.v1'; decisionId: string; visitorIdentityId: string; visitorSessionId: string; interactionSessionId: string; visitorStateRevisionId: string; exposureId: string; guidance: NativeGuidanceResponse | null; rule: NativeRuleSelection | null; experiment?: { experimentId: string; assignmentId: string; arm: 'control' | 'treatment'; exposureStatus: 'exposed' | 'fallback' | 'noncompliant' } };

function signalIntent(signal: NativeCanvasSignal): 'explore_offerings' | 'select_offering' {
  return signal === 'discovery' ? 'explore_offerings' : 'select_offering';
}
function hashHandle(handle: string): Buffer { return createHash('sha256').update(handle, 'utf8').digest(); }

export function createNativeIntelligenceService(db: Database['db'], context: Context) {
  const visitors = createVisitorStateRepository(db);
  const sessions = createInteractionSessionRepository(db);
  const experiments = createNativeExperimentRepository(db);
  const rules = createNativeRuleRepository(db);
  async function scoped<T>(work: (tx: DatabaseTransaction) => Promise<T>) {
    return db.transaction(async tx => {
      await tx.execute(sql`select set_config('kablet.organization_id', ${context.organizationId}, true), set_config('kablet.business_id', ${context.businessId}, true)`);
      return work(tx);
    });
  }

  async function evaluateGuidance(tx: DatabaseTransaction, request: NativeGuidanceRequest | undefined): Promise<NativeGuidanceResponse | null> {
    if (!request || !context.storeId) return null;
    const parsed = nativeGuidanceRequestSchema.parse(request);
    const productsResult = await tx.execute(sql`select id, title, description, amount_minor::text, currency, availability, fulfillment_type, inventory_quantity
      from kablet_native_products
      where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId}::uuid and status='published'
      order by title asc, id asc`);
    const products = productsResult.rows.map(row => {
      const value = row as Record<string, unknown>;
      return {
        productId: String(value.id), title: String(value.title), description: String(value.description ?? ''), amountMinor: String(value.amount_minor), currency: String(value.currency),
        availability: String(value.availability) as 'unknown' | 'available' | 'unavailable' | 'stale', fulfillmentType: String(value.fulfillment_type ?? 'physical') as 'physical' | 'digital',
        inventoryQuantity: value.inventory_quantity === null ? null : Number(value.inventory_quantity),
      };
    });
    const presentable = products.map(({ inventoryQuantity: _inventoryQuantity, ...product }) => product);
    const available = products.filter(product => product.availability === 'available' && product.inventoryQuantity !== null && product.inventoryQuantity > 0);
    const toResponse = (input: Omit<NativeGuidanceResponse, 'contractVersion'>): NativeGuidanceResponse => nativeGuidanceResponseSchema.parse({ contractVersion: 'native-guidance.v1', ...input });
    if (parsed.mode === 'reassurance') {
      const policy = await tx.execute(sql`select id, eligible_countries, tax_rate_bps
        from kablet_native_checkout_policies
        where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId}::uuid
          and status='active' and currency=(select primary_currency from kablet_native_stores where id=${context.storeId}::uuid)
        order by revision desc limit 2`);
      const facts = policy.rows.length === 1
        ? [`An active checkout policy is configured for ${Array.isArray((policy.rows[0] as Record<string, unknown>).eligible_countries) ? ((policy.rows[0] as Record<string, unknown>).eligible_countries as unknown[]).length : 0} shipping countries.`, 'Totals are recalculated by the server before checkout.']
        : ['No single active checkout policy is available for this store and currency.'];
      return toResponse({ mode: parsed.mode, heading: policy.rows.length === 1 ? 'The store policy is available.' : 'Policy information is limited.', body: policy.rows.length === 1 ? 'Here is the merchant information currently available for checkout.' : 'The merchant has not supplied enough active policy information to make a more specific promise.', facts, products: [], options: [], fallback: policy.rows.length !== 1 });
    }
    if (parsed.mode === 'product') {
      const product = parsed.productId ? products.find(item => item.productId === parsed.productId) : undefined;
      if (!product) return toResponse({ mode: parsed.mode, heading: 'Product information is unavailable.', body: 'That product is not part of the published collection for this store.', facts: [], products: [], options: [], fallback: true });
      const availability = product.availability === 'available' && product.inventoryQuantity !== null && product.inventoryQuantity > 0 ? 'Available for purchase.' : product.availability === 'unknown' || product.inventoryQuantity === null ? 'Availability is not confirmed.' : 'Currently unavailable.';
      return toResponse({ mode: parsed.mode, heading: product.title, body: product.description || 'The merchant has not provided a product description.', facts: [product.amountMinor ? `Price: ${product.currency} ${product.amountMinor}.` : 'Price information is unavailable.', availability, product.fulfillmentType === 'digital' ? 'Digital fulfillment.' : 'Physical fulfillment.'], products: [presentable.find(item => item.productId === product.productId)!], options: [], fallback: false });
    }
    if (parsed.mode === 'purchase_readiness') {
      const product = parsed.productId ? products.find(item => item.productId === parsed.productId) : undefined;
      if (!product) return toResponse({ mode: parsed.mode, heading: 'Purchase details are unavailable.', body: 'Select a published product before continuing.', facts: [], products: [], options: [], fallback: true });
      const sellable = product.availability === 'available' && product.inventoryQuantity !== null && product.inventoryQuantity > 0;
      const availability = sellable ? 'Available for the authorized cart flow.' : product.availability === 'unknown' || product.inventoryQuantity === null ? 'Availability is not confirmed; the cart will not authorize this item.' : 'Currently unavailable; the cart will not authorize this item.';
      return toResponse({ mode: parsed.mode, heading: sellable ? 'Ready to review.' : 'Purchase readiness is limited.', body: sellable ? 'The server will recalculate price and inventory before checkout.' : 'The merchant catalog does not currently support an authorized purchase for this product.', facts: [product.amountMinor ? `Price: ${product.currency} ${product.amountMinor}.` : 'Price information is unavailable.', availability], products: [presentable.find(item => item.productId === product.productId)!], options: [], fallback: !sellable });
    }
    if (parsed.mode === 'comparison') {
      const comparison = products.slice(0, 2);
      return toResponse({ mode: parsed.mode, heading: comparison.length >= 2 ? 'Compare the available facts.' : 'Comparison needs another published product.', body: comparison.length >= 2 ? 'Only merchant-supplied product information is shown.' : 'There are not enough published products to compare safely.', facts: comparison.length >= 2 ? ['Prices and availability come from the published catalog.'] : [], products: comparison.map(({ inventoryQuantity: _inventoryQuantity, ...product }) => product), options: [], fallback: comparison.length < 2 });
    }
    if (!parsed.preference) {
      const options = [
        ...(available.length > 0 ? [{ preference: 'available' as const, label: 'Show available options' }] : []),
        ...(products.some(product => product.fulfillmentType === 'physical') ? [{ preference: 'physical' as const, label: 'Show physical products' }] : []),
        ...(products.some(product => product.fulfillmentType === 'digital') ? [{ preference: 'digital' as const, label: 'Show digital products' }] : []),
        ...(products.length > 1 ? [{ preference: 'lower_price' as const, label: 'Start with lower-priced options' }] : []),
      ].slice(0, 4);
      return toResponse({ mode: parsed.mode, heading: options.length > 0 ? 'What should guide the first choice?' : 'The collection needs more information.', body: options.length > 0 ? 'Choose a direction and the server will show matching published products.' : 'There is not enough current catalog information to narrow the collection safely.', facts: available.length > 0 ? [`${available.length} published product${available.length === 1 ? '' : 's'} currently show available inventory.`] : ['No published product currently has confirmed available inventory.'], products: [], options, fallback: options.length === 0 });
    }
    const matching = (parsed.preference === 'available' ? available : products.filter(product => parsed.preference === 'physical' || parsed.preference === 'digital' ? product.fulfillmentType === parsed.preference : true))
      .sort((a, b) => parsed.preference === 'lower_price' ? BigInt(a.amountMinor) < BigInt(b.amountMinor) ? -1 : BigInt(a.amountMinor) > BigInt(b.amountMinor) ? 1 : a.title.localeCompare(b.title) : (a.availability === 'available' ? -1 : 1) - (b.availability === 'available' ? -1 : 1) || a.title.localeCompare(b.title));
    return toResponse({ mode: parsed.mode, heading: matching.length > 0 ? 'These products match that direction.' : 'No published product matches that direction.', body: matching.length > 0 ? 'The selection is based on the merchant catalog and current availability fields.' : 'The merchant has not supplied a published product that matches this direction.', facts: matching.length > 0 ? ['Availability is shown as supplied by the merchant catalog.'] : ['Try another supported direction or continue with the full collection.'], products: matching.slice(0, 3).map(({ inventoryQuantity: _inventoryQuantity, ...product }) => product), options: [], fallback: matching.length === 0 });
  }

  return {
    async resolveLineage(handle: string): Promise<NativeIntelligenceLineage | null> {
      return scoped(async tx => {
        const result = await tx.execute(sql`select i.visitor_identity_id, i.visitor_session_id, i.id as interaction_session_id, e.decision_id, e.id as exposure_id, e.composition_id, e.composition_version
          from interaction_sessions i
          left join lateral (
            select e.id, e.decision_id, e.composition_id, e.composition_version
              from experience_exposures e
              join visitor_decisions d on d.organization_id=e.organization_id and d.business_id=e.business_id and d.id=e.decision_id
             where e.organization_id=i.organization_id and e.business_id=i.business_id and e.interaction_session_id=i.id
               and e.composition_version='native-canvas.v1'
               and d.decision_type in ('native_entry','native_discovery','native_comparison')
             order by e.exposure_sequence desc, e.id desc limit 1
          ) e on true
         where i.organization_id=${context.organizationId}::uuid and i.business_id=${context.businessId}::uuid
           and i.handle_hash=${hashHandle(handle)} and i.status='active' and i.expires_at > now()`);
        const row = result.rows[0] as Record<string, unknown> | undefined;
        if (!row) return null;
        return {
          visitorIdentityId: String(row.visitor_identity_id),
          visitorSessionId: String(row.visitor_session_id),
          interactionSessionId: String(row.interaction_session_id),
          decisionId: row.decision_id ? String(row.decision_id) : null,
          exposureId: row.exposure_id ? String(row.exposure_id) : null,
          compositionId: row.composition_id ? String(row.composition_id) : null,
          compositionVersion: row.composition_version ? String(row.composition_version) : null,
        };
      });
    },
    async resolve(handle: string | null, signal: NativeCanvasSignal | null, idempotencyKey: string, guidanceRequest?: NativeGuidanceRequest): Promise<Result> {
      const parsedSignal = signal === null ? null : nativeCanvasSignalSchema.parse(signal);
      return scoped(async tx => {
        let identity: { visitorIdentityId: string; visitorSessionId: string; interactionSessionId: string; handle: string | null };
        if (handle) {
          const resolved = await sessions.resolve(context.organizationId, context.businessId, handle);
          if (!resolved) throw new Error('native_intelligence_session_expired');
          identity = { ...resolved, handle };
        } else {
          const visitorIdentityId = await createVisitorStateRepository(db, tx).createVisitor(context.organizationId, context.businessId, new Date(Date.now() + 180 * 24 * 60 * 60 * 1000));
          const visitorSessionId = await createVisitorStateRepository(db, tx).createSession(context.organizationId, context.businessId, visitorIdentityId);
          const interaction = await sessions.createWithId(context.organizationId, context.businessId, visitorIdentityId, visitorSessionId, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), tx);
          identity = { visitorIdentityId, visitorSessionId, interactionSessionId: interaction.id, handle: interaction.handle };
        }

        const before = await createVisitorStateRepository(db, tx).getCurrentState(context.organizationId, context.businessId, identity.visitorIdentityId);
        if (parsedSignal) {
          const observation = observationSchema.parse({
            id: randomUUID(), organizationId: context.organizationId, businessId: context.businessId,
            visitorIdentityId: identity.visitorIdentityId, sessionId: identity.visitorSessionId,
            expectedVersion: before.version, kind: 'intent.expressed',
            value: { type: 'intent', value: signalIntent(parsedSignal) }, idempotencyKey,
            observedAt: new Date(), sourceType: 'visitor', sourceReference: 'native-canvas', correctionOfObservationId: null,
          });
          await createVisitorStateRepository(db, tx).ingest(context.organizationId, observation, tx);
        }
        const after = await createVisitorStateRepository(db, tx).getCurrentState(context.organizationId, context.businessId, identity.visitorIdentityId);
        const derivedSignal = after.state.intent?.status !== 'withdrawn' && after.state.intent?.status !== 'invalidated'
          ? after.state.intent?.value === 'explore_offerings' ? 'discovery' as const : after.state.intent?.value === 'select_offering' ? 'comparison' as const : null
          : null;
        const effectiveSignal = parsedSignal ?? derivedSignal;
        const guidanceFingerprint = guidanceRequest ? createHash('sha256').update(JSON.stringify(guidanceRequest)).digest('hex').slice(0, 32) : 'baseline';
        const decisionKey = parsedSignal ? `native:${idempotencyKey}` : effectiveSignal ? `native:resume:${after.revisionId}:${guidanceFingerprint}` : `native:baseline:${guidanceFingerprint}`;
        // Lock governance only after visitor state is settled. A pause/end
        // update therefore either wins before this read (baseline) or waits
        // until assignment/exposure persistence commits (assignment wins).
        // An already-running response cannot be revoked.
        const activeExperiment = context.storeId
          ? await experiments.getActive({ organizationId: context.organizationId, businessId: context.businessId, storeId: context.storeId }, new Date(), tx)
          : null;
        const assignment = activeExperiment && context.storeId ? await experiments.assign({ organizationId: context.organizationId, businessId: context.businessId, storeId: context.storeId }, activeExperiment, identity.visitorIdentityId, tx) : null;
        const selectedRule = context.storeId ? await rules.selectActive({ organizationId: context.organizationId, businessId: context.businessId, storeId: context.storeId }, { intent: nativeRuleIntentFor({ signal: effectiveSignal, guidanceMode: guidanceRequest?.mode }), preference: guidanceRequest?.preference ?? null, availableProductCount: Number((await tx.execute(sql`select count(*)::int as count from kablet_native_products where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId}::uuid and status='published' and availability='available' and inventory_quantity > 0`)).rows[0].count) }, tx) : null;
        const existing = await tx.execute(sql`select d.id, d.decision_type, d.native_rule_id, d.native_rule_version, d.native_rule_reason_code, d.native_rule_reason, r.rule_key, r.composition as rule_composition from visitor_decisions d left join kablet_native_rules r on r.organization_id=d.organization_id and r.business_id=d.business_id and r.store_id=d.native_store_id and r.id=d.native_rule_id where d.organization_id=${context.organizationId}::uuid and d.business_id=${context.businessId}::uuid and d.visitor_identity_id=${identity.visitorIdentityId}::uuid and d.idempotency_key=${decisionKey}`);
        let decisionId: string;
        let composition: Result['composition'];
        let appliedRule: NativeRuleSelection | null = selectedRule;
        let experimentStatus: 'exposed' | 'fallback' | 'noncompliant' | null = null;
        if (existing.rows[0]) {
          decisionId = String(existing.rows[0].id);
          composition = existing.rows[0].decision_type === 'native_discovery' ? 'discovery' : existing.rows[0].decision_type === 'native_comparison' ? 'comparison' : 'entry';
          appliedRule = existing.rows[0].native_rule_id ? { ruleId: String(existing.rows[0].native_rule_id), ruleKey: String(existing.rows[0].rule_key), version: Number(existing.rows[0].native_rule_version), composition: String(existing.rows[0].rule_composition) as NativeRuleSelection['composition'], reasonCode: String(existing.rows[0].native_rule_reason_code) as NativeRuleSelection['reasonCode'], reason: String(existing.rows[0].native_rule_reason) } : null;
        } else {
          const evaluated = evaluateNativeCanvasDecision({ signal: effectiveSignal });
          let experimentComposition: Result['composition'] | null = null;
          if (activeExperiment && assignment?.status === 'eligible') {
            experimentComposition = assignment.arm === 'control' ? activeExperiment.controlComposition : activeExperiment.treatmentComposition;
            const productCount = await tx.execute(sql`select count(*)::int as count from kablet_native_products where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and store_id=${context.storeId!}::uuid and status='published'`);
            const count = Number((productCount.rows[0] as Record<string, unknown>).count);
            const available = experimentComposition === 'entry' || (experimentComposition === 'discovery' && count >= 1) || (experimentComposition === 'comparison' && count >= 2);
            if (!available) { experimentComposition = 'entry'; experimentStatus = 'fallback'; } else experimentStatus = 'exposed';
          }
          decisionId = randomUUID();
          const inputFingerprint = createHash('sha256').update(JSON.stringify({ signal: effectiveSignal, revision: after.revisionId })).digest('hex');
          composition = selectedRule?.composition ?? experimentComposition ?? evaluated.composition;
          const decisionType = composition === 'discovery' ? 'native_discovery' : composition === 'comparison' ? 'native_comparison' : 'native_entry';
          await tx.execute(sql`insert into visitor_decisions (id,organization_id,business_id,visitor_identity_id,session_id,decision_type,status,contract_version,policy_id,policy_version,visitor_state_revision_id,visitor_state_version,idempotency_key,input_fingerprint,native_experiment_id,native_experiment_assignment_id,native_store_id,native_rule_id,native_rule_version,native_rule_reason_code,native_rule_reason) values (${decisionId}::uuid,${context.organizationId}::uuid,${context.businessId}::uuid,${identity.visitorIdentityId}::uuid,${identity.visitorSessionId}::uuid,${decisionType},'accepted','decision.v1','native-canvas','native-canvas.v1',${after.revisionId}::uuid,${after.version},${decisionKey},${inputFingerprint},${assignment?.status === 'eligible' ? activeExperiment?.experimentId ?? null : null}::uuid,${assignment?.status === 'eligible' ? assignment?.assignmentId ?? null : null}::uuid,${context.storeId ?? null}::uuid,${appliedRule?.ruleId ?? null}::uuid,${appliedRule?.version ?? null},${appliedRule?.reasonCode ?? null},${appliedRule?.reason ?? null})`);
        }
        const exposureKey = `native:${decisionId}`;
        const exposure = await tx.execute(sql`insert into experience_exposures (id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,decision_id,exposure_sequence,exposure_kind,composition_id,composition_version,exposure_idempotency_key,exposed_at) select ${randomUUID()}::uuid,${context.organizationId}::uuid,${context.businessId}::uuid,${identity.visitorIdentityId}::uuid,${identity.visitorSessionId}::uuid,${identity.interactionSessionId}::uuid,${decisionId}::uuid,coalesce(max(exposure_sequence),0)+1,'server_response',${composition},'native-canvas.v1',${exposureKey},now() from experience_exposures where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and interaction_session_id=${identity.interactionSessionId}::uuid on conflict (organization_id,business_id,interaction_session_id,exposure_idempotency_key) where exposure_idempotency_key is not null do nothing returning id`);
        const exposureId = exposure.rows[0]?.id ?? (await tx.execute(sql`select id from experience_exposures where organization_id=${context.organizationId}::uuid and business_id=${context.businessId}::uuid and interaction_session_id=${identity.interactionSessionId}::uuid and exposure_idempotency_key=${exposureKey}`)).rows[0].id;
        if (parsedSignal) await tx.execute(sql`insert into interaction_facts (id,organization_id,business_id,visitor_identity_id,visitor_session_id,interaction_session_id,decision_id,exposure_id,interaction_kind,occurred_at,idempotency_key,action_request_id) values (${randomUUID()}::uuid,${context.organizationId}::uuid,${context.businessId}::uuid,${identity.visitorIdentityId}::uuid,${identity.visitorSessionId}::uuid,${identity.interactionSessionId}::uuid,${decisionId}::uuid,${exposureId}::uuid,'native_composition_selected',now(),${idempotencyKey},null) on conflict (organization_id,business_id,interaction_session_id,interaction_kind,idempotency_key) do nothing`);
        const experiment = activeExperiment && assignment?.status === 'eligible' && context.storeId ? await experiments.recordExposure({ organizationId: context.organizationId, businessId: context.businessId, storeId: context.storeId, experimentId: activeExperiment.experimentId, assignmentId: assignment.assignmentId, decisionId, exposureId: String(exposureId), arm: assignment.arm, compositionId: composition, status: experimentStatus ?? 'exposed' }, tx) : null;
        return { handle: identity.handle, composition, compositionVersion: 'native-canvas.v1', decisionId, visitorIdentityId: identity.visitorIdentityId, visitorSessionId: identity.visitorSessionId, interactionSessionId: identity.interactionSessionId, visitorStateRevisionId: after.revisionId, exposureId: String(exposureId), guidance: await evaluateGuidance(tx, guidanceRequest), rule: appliedRule, ...(experiment ? { experiment: { experimentId: activeExperiment!.experimentId, assignmentId: experiment.assignmentId, arm: experiment.arm, exposureStatus: experiment.status } } : {}) };
      });
    },
  };
}
