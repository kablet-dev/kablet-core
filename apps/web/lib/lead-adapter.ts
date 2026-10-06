import { adapterReceiptSchema, type ActionAdapter } from '@kablet/domain';
import { z } from 'zod';

export type ControlledLeadInput = { name: string; email: string; consentPurpose: string; consentVersion: string };
export const controlledLeadAdapter: ActionAdapter<ControlledLeadInput> = {
  adapterKey: 'controlled.lead.v1',
  capabilityVersion: '1',
  validateInput: input => z.object({ name: z.string().min(1), email: z.string().email(), consentPurpose: z.string().min(1), consentVersion: z.string().min(1) }).parse(input),
  async execute(input, context) { return adapterReceiptSchema.parse({ externalOperationId: context.externalOperationId, receiptReference: `controlled-lead:${context.actionRequestId}:${input.email.length}` }); },
  async verify(receipt) { if (!receipt.externalOperationId.startsWith('kablet:') || !receipt.receiptReference.startsWith('controlled-lead:')) return { status: 'rejected', evidenceType: 'controlled_receipt', evidenceReference: 'invalid_receipt' }; return { status: 'verified', evidenceType: 'controlled_receipt', evidenceReference: receipt.receiptReference }; },
};
