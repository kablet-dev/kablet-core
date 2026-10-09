import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database } from './index.js';

export type AiIntentSettlementOutcome = 'succeeded' | 'failed' | 'unknown';

declare const definitiveNonConsumptionProof: unique symbol;

/** Capability supplied only by the trusted execution boundary. */
export type DefinitiveNonConsumptionProof = {
  readonly [definitiveNonConsumptionProof]: true;
};

export type SettleAiIntentRequest =
  | {
      organizationId: string;
      businessId: string;
      invocationId: string;
      outcome: 'succeeded';
      interpretation: {
        normalizedIntent: 'explore_offerings' | 'request_information' | 'select_offering' | 'unclear';
        reasonCode: 'intent_extracted' | 'ambiguous' | 'unsupported_request' | 'safety_filtered';
        confidence?: number;
        interpreterVersion: string;
      };
      providerRequestReference?: string;
    }
  | {
      organizationId: string;
      businessId: string;
      invocationId: string;
      outcome: 'failed';
      definitiveNonConsumptionProof: DefinitiveNonConsumptionProof;
      providerRequestReference?: string;
    }
  | {
      organizationId: string;
      businessId: string;
      invocationId: string;
      outcome: 'unknown';
      providerRequestReference?: string;
    };

export type AiIntentSettlementResult =
  | { outcome: 'settled'; invocationId: string; status: AiIntentSettlementOutcome }
  | { outcome: 'already_settled'; invocationId: string; status: AiIntentSettlementOutcome }
  | { outcome: 'settlement_conflict'; invocationId: string; status: string }
  | { outcome: 'not_found' }
  | { outcome: 'unauthorized' };

export interface ClaimAiIntentInput {
  organizationId: string;
  businessId: string;
  interactionSessionId: string;
  idempotencyKey: string;
  inputFingerprint: Uint8Array;
  interpreterVersion: string;
  reservationUnits: number;
}

export type ClaimClock = () => Date;

export type AiIntentClaimResult =
  | { outcome: 'created'; invocationId: string; dailyPeriodId: string; monthlyPeriodId: string; reservedUnits: number }
  | { outcome: 'replay'; invocationId: string; status: string; reservedUnits: number }
  | { outcome: 'idempotency_conflict'; invocationId: string }
  | { outcome: 'budget_exhausted'; period: 'daily' | 'monthly' }
  | { outcome: 'accounting_period_missing'; period: 'daily' | 'monthly' }
  | { outcome: 'session_invalid' };

function assertPositiveUnits(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('reservation units must be a positive safe integer');
}

function assertFingerprint(value: Uint8Array) {
  if (!(value instanceof Uint8Array) || value.byteLength === 0 || value.byteLength > 64) throw new Error('input fingerprint is invalid');
}

export function createAiIntentRepository(database: Database['db'], clock: ClaimClock = () => new Date()) {
  return {
    async claim(input: ClaimAiIntentInput): Promise<AiIntentClaimResult> {
      assertPositiveUnits(input.reservationUnits);
      assertFingerprint(input.inputFingerprint);
      if (!input.idempotencyKey || input.idempotencyKey.length > 200) throw new Error('idempotency key is invalid');
      if (!input.interpreterVersion || input.interpreterVersion.length > 64) throw new Error('interpreter version is invalid');

      return database.transaction(async tx => {
        const claimTime = clock();
        if (!(claimTime instanceof Date) || Number.isNaN(claimTime.getTime())) throw new Error('claim clock returned an invalid date');
        await tx.execute(sql`select set_config('kablet.organization_id',${input.organizationId},true), set_config('kablet.business_id',${input.businessId},true)`);
        const session = await tx.execute(sql`select id from interaction_sessions where id=${input.interactionSessionId}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and status='active' and expires_at > ${claimTime}::timestamptz`);
        if (session.rows.length === 0) return { outcome: 'session_invalid' };

        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(concat(${input.organizationId}::text,':',${input.businessId}::text,':',${input.interactionSessionId}::text,':',${input.idempotencyKey}::text),0))`);
        const existing = await tx.execute(sql`select id,status,reserved_units,input_fingerprint,interpreter_version from ai_intent_invocations where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and interaction_session_id=${input.interactionSessionId}::uuid and idempotency_key=${input.idempotencyKey} limit 1`);
        if (existing.rows.length > 0) {
          const row = existing.rows[0] as { id: string; status: string; reserved_units: string; input_fingerprint: Buffer | null; interpreter_version: string };
          const sameFingerprint = row.input_fingerprint !== null && Buffer.from(input.inputFingerprint).equals(row.input_fingerprint);
          if (!sameFingerprint || row.interpreter_version !== input.interpreterVersion) return { outcome: 'idempotency_conflict', invocationId: row.id };
          return { outcome: 'replay', invocationId: row.id, status: row.status, reservedUnits: Number(row.reserved_units) };
        }

        const periods = await tx.execute(sql`select id,period_kind,max_units,reserved_units,released_units from ai_intent_accounting_periods where organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid and ((period_kind='daily' and period_start <= (${claimTime}::timestamptz at time zone 'UTC')::date and period_end > (${claimTime}::timestamptz at time zone 'UTC')::date) or (period_kind='monthly' and period_start <= (${claimTime}::timestamptz at time zone 'UTC')::date and period_end > (${claimTime}::timestamptz at time zone 'UTC')::date)) order by case period_kind when 'daily' then 1 when 'monthly' then 2 end for update`);
        const daily = periods.rows.find(row => row.period_kind === 'daily') as { id: string; max_units: string; reserved_units: string; released_units: string } | undefined;
        const monthly = periods.rows.find(row => row.period_kind === 'monthly') as { id: string; max_units: string; reserved_units: string; released_units: string } | undefined;
        if (!daily) return { outcome: 'accounting_period_missing', period: 'daily' };
        if (!monthly) return { outcome: 'accounting_period_missing', period: 'monthly' };
        if (Number(daily.max_units) - (Number(daily.reserved_units) - Number(daily.released_units)) < input.reservationUnits) return { outcome: 'budget_exhausted', period: 'daily' };
        if (Number(monthly.max_units) - (Number(monthly.reserved_units) - Number(monthly.released_units)) < input.reservationUnits) return { outcome: 'budget_exhausted', period: 'monthly' };

        await tx.execute(sql`update ai_intent_accounting_periods set reserved_units=reserved_units+${input.reservationUnits} where id=${daily.id}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid`);
        await tx.execute(sql`update ai_intent_accounting_periods set reserved_units=reserved_units+${input.reservationUnits} where id=${monthly.id}::uuid and organization_id=${input.organizationId}::uuid and business_id=${input.businessId}::uuid`);
        const invocationId = randomUUID();
        await tx.execute(sql`insert into ai_intent_invocations (id,organization_id,business_id,interaction_session_id,idempotency_key,input_fingerprint,status,interpreter_version,reserved_units,daily_period_id,monthly_period_id,claimed_at) values (${invocationId}::uuid,${input.organizationId}::uuid,${input.businessId}::uuid,${input.interactionSessionId}::uuid,${input.idempotencyKey},${Buffer.from(input.inputFingerprint)},'claimed',${input.interpreterVersion},${input.reservationUnits},${daily.id}::uuid,${monthly.id}::uuid,${claimTime}::timestamptz)`);
        return { outcome: 'created', invocationId, dailyPeriodId: daily.id, monthlyPeriodId: monthly.id, reservedUnits: input.reservationUnits };
      });
    },
  };
}
