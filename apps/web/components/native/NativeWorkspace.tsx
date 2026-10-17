import type { ReactNode } from 'react';

export type NativeWorkspaceMode = 'exploration' | 'cart' | 'checkout';

type ShellProps = {
  mode: NativeWorkspaceMode;
  rail: ReactNode;
  proof?: ReactNode;
  children: ReactNode;
};

export function NativeWorkspaceShell({ mode, rail, proof, children }: ShellProps) {
  return <section className={`adaptive-workspace adaptive-workspace-${mode}`} aria-label={`${mode} workspace`}>
    <aside className="adaptive-workspace-rail">{rail}</aside>
    <div className="adaptive-workspace-main">{children}</div>
    {proof ? <aside className="adaptive-workspace-proof">{proof}</aside> : <div className="adaptive-workspace-proof is-empty" aria-hidden="true" />}
  </section>;
}

export type NativeContextualAction = {
  id: string;
  label: string;
  available: boolean;
  onSelect: () => void;
};

type RailProps = {
  intent: string | null;
  actions: NativeContextualAction[];
  intentInput?: ReactNode;
  feedback?: string | null;
  error?: string | null;
  onClose?: () => void;
  compact?: boolean;
};

export function NativeIntelligenceRail({ intent, actions, intentInput, feedback, error, onClose, compact = false }: RailProps) {
  const availableActions = actions.filter(action => action.available);
  const heading = compact ? 'Keep your place.' : intent === 'compare' ? 'Compare with intent.' : intent === 'find' ? 'Explore with intent.' : 'Choose a direction.';
  return <div className={`adaptive-intelligence-rail${compact ? ' is-compact' : ''}`}>
    <p className="eyebrow">Shopping guide</p>
    <h2>{heading}</h2>
    {intentInput}
    <nav aria-label="Shopping workspace actions" className="adaptive-workspace-actions">
      {availableActions.map(action => <button key={action.id} type="button" onClick={action.onSelect}>{action.label}</button>)}
      {onClose && <button type="button" onClick={onClose}>Close panel</button>}
    </nav>
    {intent && <p className="adaptive-workspace-rail-state" role="status">Current direction: <strong>{intent === 'compare' ? 'comparison' : intent === 'find' ? 'discovery' : intent}</strong></p>}
    {feedback && <p className="adaptive-workspace-rail-feedback" role="status" aria-live="polite">{feedback}</p>}
    {error && <p className="adaptive-workspace-rail-feedback is-error" role="alert">{error}</p>}
  </div>;
}

export function NativeContextProof({ title, eyebrow, facts }: { title: string; eyebrow: string; facts: string[] }) {
  return <div className="adaptive-context-proof">
    <p className="eyebrow">{eyebrow}</p>
    <p className="adaptive-context-proof-title">{title}</p>
    <ul>{facts.map(fact => <li key={fact}>{fact}</li>)}</ul>
  </div>;
}
