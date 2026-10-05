import type { ExperienceComponent } from '@kablet/domain';

export function QualificationQuestion({ component, selected, onSelect }: { component: ExperienceComponent; selected: string | null; onSelect: (value: string) => void }) {
  if (component.type !== 'qualification-question') return null;
  return <section className="experience-card"><span className="eyebrow">A little more context</span><h2>{component.heading}</h2><p>{component.body}</p><div className="intent-options">{component.options.map(option => <button type="button" key={option.value} className={selected === option.value ? 'intent-option selected' : 'intent-option'} onClick={() => onSelect(option.value)}>{option.label}</button>)}</div></section>;
}
