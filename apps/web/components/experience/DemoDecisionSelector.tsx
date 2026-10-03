'use client';

import { useState } from 'react';
import { decisionToExperience, type DecisionType } from '@kablet/domain';
import { demoInputFor, demoRenderableOfferings } from '../../lib/experience-fixture';
import { ExperienceRenderer } from './ExperienceRenderer';

const options: Array<{ value: DecisionType; label: string }> = [
  { value: 'clarify_intent', label: 'Clarify intent' },
  { value: 'present_offering', label: 'Present offerings' },
  { value: 'request_time_window', label: 'Request timing' },
  { value: 'offer_next_step', label: 'Offer next step' },
  { value: 'no_safe_decision', label: 'Safe fallback' },
];

export function DemoDecisionSelector() {
  const [selected, setSelected] = useState<DecisionType>('clarify_intent');
  const experience = decisionToExperience(demoInputFor(selected), selected === 'present_offering' ? demoRenderableOfferings : []);
  return <section className="demo-lab" aria-label="Decision output demonstration">
    <div className="demo-lab-heading"><div><span className="eyebrow">Explore the runtime</span><h2>One context, five careful responses.</h2></div><span className="demo-pill">Fictional preview</span></div>
    <p className="demo-lab-copy">Switch the accepted Decision type to see how the same presentation runtime adapts. These controls are local to this demonstration and do not create Decisions.</p>
    <div className="decision-tabs" role="tablist" aria-label="Decision type preview">{options.map(option => <button key={option.value} type="button" className={selected === option.value ? 'decision-tab active' : 'decision-tab'} onClick={() => setSelected(option.value)}>{option.label}</button>)}</div>
    <ExperienceRenderer experience={experience} />
  </section>;
}
