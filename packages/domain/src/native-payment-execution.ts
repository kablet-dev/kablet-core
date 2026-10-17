import type { NativePaymentEvidence, NativePaymentAttempt } from './native-payment.js';

export type NativePaymentCaptureMode = 'authorize_only' | 'authorize_and_capture';

export type NativePaymentAdapterCapabilities = {
  currencies: readonly string[];
  captureModes: readonly NativePaymentCaptureMode[];
  supportsHostedSession: boolean;
  supportsStatusRetrieval: boolean;
  supportsSignedWebhooks: boolean;
};

export type NativePaymentSessionRequest = {
  payment: NativePaymentAttempt;
  captureMode: NativePaymentCaptureMode;
  returnReference: string;
};

export type NativePaymentSessionResult = {
  providerSessionReference: string;
  customerActionRequired: boolean;
  expiresAt: string | null;
  url?: string;
};

export type NativePaymentStatusResult =
  | { kind: 'authorized'; providerPaymentReference: string }
  | { kind: 'captured'; providerPaymentReference: string }
  | { kind: 'failed'; providerPaymentReference: string | null; reasonCode: string }
  | { kind: 'cancelled'; providerPaymentReference: string | null }
  | { kind: 'unknown'; providerPaymentReference: string | null; reasonCode: string };

export type NativeVerifiedProviderEvent = {
  evidence: NativePaymentEvidence;
  authenticatedProviderEventReference: string;
};

export interface NativePaymentAdapter {
  readonly providerKey: string;
  readonly adapterVersion: string;
  readonly capabilities: NativePaymentAdapterCapabilities;
  createHostedSession(request: NativePaymentSessionRequest): Promise<NativePaymentSessionResult>;
  retrieveStatus(input: { payment: NativePaymentAttempt; providerPaymentReference: string }): Promise<NativePaymentStatusResult>;
  verifyWebhook(input: { rawBody: Uint8Array; signature: string; receivedAt: string }): Promise<NativeVerifiedProviderEvent | null>;
}

export type NativePaymentExecutionOutcome =
  | { status: 'created' | 'pending'; payment: NativePaymentAttempt; session: NativePaymentSessionResult }
  | { status: 'unknown'; payment: NativePaymentAttempt; retryAllowed: false; reason: string };

export function assertNativePaymentCapability(input: {
  accountStatus: 'pending' | 'onboarding' | 'active' | 'suspended' | 'revoked';
  supportedCurrencies: readonly string[];
  captureModes: readonly NativePaymentCaptureMode[];
  currency: string;
  captureMode: NativePaymentCaptureMode;
}): void {
  if (input.accountStatus !== 'active') throw new Error('merchant payment account is not active');
  if (!input.supportedCurrencies.includes(input.currency)) throw new Error('merchant account does not support checkout currency');
  if (!input.captureModes.includes(input.captureMode)) throw new Error('merchant account does not support capture mode');
}
