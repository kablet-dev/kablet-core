import { z } from 'zod';

export const nativeExperimentStateSchema = z.enum(['draft', 'approved', 'active', 'paused', 'ended']);
export const nativeExperimentArmSchema = z.enum(['control', 'treatment']);
export const nativeExperimentCompositionSchema = z.enum(['entry', 'discovery', 'comparison']);
export type NativeExperimentComposition = z.infer<typeof nativeExperimentCompositionSchema>;
export const nativeExperimentAssignmentStatusSchema = z.enum(['eligible', 'ineligible']);
export const nativeExperimentExposureStatusSchema = z.enum(['exposed', 'fallback', 'noncompliant']);

export const nativeExperimentEligibilitySchema = z.object({
  minPublishedProducts: z.number().int().nonnegative().max(10000).default(0),
}).strict();

export const nativeExperimentMetricSchema = z.object({
  key: z.string().trim().min(1).max(80),
  direction: z.enum(['maximize', 'minimize']),
}).strict();

export const nativeExperimentSchema = z.object({
  contractVersion: z.literal('native-experiment.v1'),
  experimentId: z.string().uuid(),
  organizationId: z.string().uuid(),
  businessId: z.string().uuid(),
  storeId: z.string().uuid(),
  experimentKey: z.string().regex(/^[a-z0-9._-]{1,80}$/),
  version: z.number().int().positive(),
  state: nativeExperimentStateSchema,
  eligibility: nativeExperimentEligibilitySchema,
  controlComposition: nativeExperimentCompositionSchema,
  treatmentComposition: nativeExperimentCompositionSchema,
  controlAllocationBps: z.number().int().min(0).max(10000),
  treatmentAllocationBps: z.number().int().min(0).max(10000),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable(),
  attributionWindowDays: z.number().int().positive().max(365),
  attributionRule: z.literal('last_native_exposure.v1'),
  primaryMetric: nativeExperimentMetricSchema,
  guardrailMetrics: z.array(nativeExperimentMetricSchema).max(20),
  createdBy: z.string().uuid(),
  approvedBy: z.string().uuid().nullable(),
  approvedAt: z.coerce.date().nullable(),
}).superRefine((value, ctx) => {
  if (value.controlAllocationBps + value.treatmentAllocationBps !== 10000) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'experiment allocations must total 10000 basis points' });
  if (value.controlComposition === value.treatmentComposition) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'experiment arms must have different compositions' });
  if (value.endsAt && value.endsAt <= value.startsAt) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'experiment end must be after start' });
  if (value.state === 'active' && (!value.approvedBy || !value.approvedAt)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'active experiments require approval provenance' });
});
export type NativeExperiment = z.infer<typeof nativeExperimentSchema>;

export const nativeExperimentAssignmentSchema = z.object({
  contractVersion: z.literal('native-experiment-assignment.v1'),
  assignmentId: z.string().uuid(), experimentId: z.string().uuid(), visitorIdentityId: z.string().uuid(),
  arm: nativeExperimentArmSchema, hashVersion: z.literal('sha256-bucket.v1'), bucket: z.number().int().min(0).max(9999),
  status: nativeExperimentAssignmentStatusSchema, exclusionReason: z.string().nullable(), assignedAt: z.coerce.date(),
}).strict();
export type NativeExperimentAssignment = z.infer<typeof nativeExperimentAssignmentSchema>;

export const nativeExperimentExposureSchema = z.object({
  contractVersion: z.literal('native-experiment-exposure.v1'), exposureId: z.string().uuid(), assignmentId: z.string().uuid(),
  arm: nativeExperimentArmSchema, compositionId: nativeExperimentCompositionSchema,
  status: nativeExperimentExposureStatusSchema, observedAt: z.coerce.date(),
}).strict();
export type NativeExperimentExposure = z.infer<typeof nativeExperimentExposureSchema>;
