'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ExperienceModel } from '@kablet/domain';
import { ExperienceRenderer } from './ExperienceRenderer';
import type { ActionPresentationStatus } from './ActionConfirmation';

const intents = [
  { value: 'explore_offerings', label: 'Explore your services' },
  { value: 'request_information', label: 'Ask for information' },
  { value: 'select_offering', label: 'I have something specific in mind' },
] as const;

type Intent = (typeof intents)[number]['value'];
type Failure = 'start' | 'intent' | 'action' | null;

export function InteractiveExperience() {
  const [experience, setExperience] = useState<ExperienceModel | null>(null);
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Intent>('request_information');
  const [selectedQualification, setSelectedQualification] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactConsent, setContactConsent] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionStatus, setActionStatus] = useState<ActionPresentationStatus>('idle');
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [failure, setFailure] = useState<Failure>(null);

  const start = useCallback(async () => {
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch('/api/interaction/start', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('start failed');
      const payload = await response.json();
      setExperience(payload.experience);
      setSubmissionKey(null);
    } catch {
      setFailure('start');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void start(); }, [start]);

  async function submit() {
    if (!experience || busy) return;
    const stableKey = submissionKey ?? crypto.randomUUID();
    setSubmissionKey(stableKey);
    setBusy(true);
    setFailure(null);
    try {
      const qualification = experience.components.find(component => component.type === 'qualification-question');
      const contact = experience.decisionType === 'request_contact';
      const endpoint = qualification ? '/api/interaction/qualification' : contact ? '/api/interaction/contact' : '/api/interaction/intent';
      const body = qualification ? { questionKey: qualification.questionKey, answer: selectedQualification, idempotencyKey: stableKey } : contact ? { name: contactName, email: contactEmail, consent: contactConsent, idempotencyKey: stableKey } : { intent: selected, idempotencyKey: stableKey };
      if (qualification && !selectedQualification) { setBusy(false); return; }
      if (contact && (!contactName || !contactEmail || !contactConsent)) { setBusy(false); return; }
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('intent failed');
      const payload = await response.json();
      setExperience(payload.experience);
      setSubmissionKey(null);
      setSelectedQualification(null);
    } catch {
      setFailure('intent');
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction() {
    if (!experience || actionBusy) return;
    setActionBusy(true);
    setActionStatus('pending');
    setFailure(null);
    const stableKey = actionKey ?? crypto.randomUUID();
    setActionKey(stableKey);
    try {
      const response = await fetch('/api/interaction/action', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decisionId: experience.decisionId, confirmed: true, idempotencyKey: stableKey }) });
      if (!response.ok) throw new Error('action failed');
      const payload = await response.json() as { status?: string };
      setActionStatus(payload.status === 'verified' ? 'verified' : payload.status === 'failed' ? 'failed' : payload.status === 'unknown' ? 'unknown' : 'idle');
      if (payload.status === 'failed' || payload.status === 'unknown') setFailure('action');
      else setActionKey(null);
    } catch { setActionStatus('unknown'); setFailure('action'); } finally { setActionBusy(false); }
  }

  return (
    <div className='interactive-panel'>
      <div className='interactive-status'>
        {busy && !experience ? 'Preparing your experience...' : 'Live server-connected preview'}
      </div>
      {failure && (
        <div className='interactive-error' role='alert'>
          {failure === 'start'
            ? 'We could not start this interaction. Please try again.'
            : failure === 'action' ? 'We could not complete the authorized next step. Please retry.' : 'We could not update this experience. Please retry.'}
          <button type='button' disabled={busy || actionBusy} onClick={() => failure === 'start' ? void start() : failure === 'action' ? void confirmAction() : void submit()}>Retry</button>
        </div>
      )}
      {experience && <ExperienceRenderer experience={experience} selectedQualification={selectedQualification} onQualificationSelect={setSelectedQualification} actionStatus={actionStatus} onConfirmAction={() => void confirmAction()} />}
      {experience?.decisionType !== 'request_qualification' && <div className='intent-panel'>
        <span className='eyebrow'>Your direction</span>
        <h2>What would be most useful?</h2>
        <div className='intent-options'>
          {intents.map(intent => (
            <button key={intent.value} type='button' className={selected === intent.value ? 'intent-option selected' : 'intent-option'}
              disabled={busy} onClick={() => { setSelected(intent.value); setSubmissionKey(null); }}>
              {intent.label}
            </button>
          ))}
        </div>
        <button className='intent-submit' type='button' onClick={() => void submit()} disabled={busy || !experience}>
          {busy ? 'Working...' : 'Continue'}
        </button>
      </div>}
      {experience?.decisionType === 'request_qualification' && <button className='intent-submit' type='button' onClick={() => void submit()} disabled={busy || !selectedQualification}>{busy ? 'Working...' : 'Continue'}</button>}
      {experience?.decisionType === 'request_contact' && <div className='intent-panel'><input aria-label='Name' value={contactName} onChange={event => setContactName(event.target.value)} placeholder='Your name' /><input aria-label='Email' value={contactEmail} onChange={event => setContactEmail(event.target.value)} placeholder='you@example.com' type='email' /><label><input type='checkbox' checked={contactConsent} onChange={event => setContactConsent(event.target.checked)} /> I agree to be contacted about this request.</label><button className='intent-submit' type='button' onClick={() => void submit()} disabled={busy || !contactName || !contactEmail || !contactConsent}>{busy ? 'Working...' : 'Continue'}</button></div>}
    </div>
  );
}
