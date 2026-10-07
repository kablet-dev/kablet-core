import type { ExperienceComponent } from '@kablet/domain';

export type ActionPresentationStatus = 'idle' | 'pending' | 'verified' | 'failed' | 'unknown';

export function ActionConfirmation({ component, status = 'idle', onConfirm }: { component: ExperienceComponent; status?: ActionPresentationStatus; onConfirm?: () => void }) {
  if (component.type !== 'action-confirmation') return null;
  const pending = status === 'pending';
  const message = status === 'verified'
    ? 'Your request was securely delivered and verified.'
    : status === 'failed'
      ? 'The next step could not be verified. Your request was not reported as successful.'
      : status === 'unknown'
        ? 'We could not confirm the result yet. Please retry only if you are asked to do so.'
        : component.body;
  return <section className="experience-card action-confirmation" aria-live="polite">
    <span className="eyebrow">{status === 'verified' ? 'Verified result' : 'Authorization required'}</span>
    <h2>{component.heading}</h2>
    <p>{message}</p>
    {status === 'idle' && onConfirm && <button className="intent-submit" type="button" disabled={pending} onClick={onConfirm}>{component.label}</button>}
    {pending && <p className="action-status">Sending securely…</p>}
  </section>;
}
