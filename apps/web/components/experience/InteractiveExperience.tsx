'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ExperienceModel } from '@kablet/domain';
import { ExperienceRenderer } from './ExperienceRenderer';

const intents = [
  { value: 'explore_offerings', label: 'Explore your services' },
  { value: 'request_information', label: 'Ask for information' },
  { value: 'select_offering', label: 'I have something specific in mind' },
] as const;

type Intent = (typeof intents)[number]['value'];
type Failure = 'start' | 'intent' | null;

export function InteractiveExperience() {
  const [experience, setExperience] = useState<ExperienceModel | null>(null);
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Intent>('request_information');
  const [selectedQualification, setSelectedQualification] = useState<string | null>(null);
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
      const endpoint = qualification ? '/api/interaction/qualification' : '/api/interaction/intent';
      const body = qualification ? { questionKey: qualification.questionKey, answer: selectedQualification, idempotencyKey: stableKey } : { intent: selected, idempotencyKey: stableKey };
      if (qualification && !selectedQualification) { setBusy(false); return; }
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

  return (
    <div className='interactive-panel'>
      <div className='interactive-status'>
        {busy && !experience ? 'Preparing your experience...' : 'Live server-connected preview'}
      </div>
      {failure && (
        <div className='interactive-error' role='alert'>
          {failure === 'start'
            ? 'We could not start this interaction. Please try again.'
            : 'We could not update this experience. Please retry.'}
          <button type='button' disabled={busy} onClick={() => failure === 'start' ? void start() : void submit()}>Retry</button>
        </div>
      )}
      {experience && <ExperienceRenderer experience={experience} selectedQualification={selectedQualification} onQualificationSelect={setSelectedQualification} />}
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
    </div>
  );
}
