import { ExperienceRenderer } from '../../components/experience/ExperienceRenderer';
import { loadDemoExperience } from '../../lib/load-demo-experience';
import { DemoDecisionSelector } from '../../components/experience/DemoDecisionSelector';

export default function ExperiencePage() {
  const experience = loadDemoExperience();
  return <main className="experience-shell"><div className="experience-frame"><header className="experience-header"><div className="brand-mark"><span className="brand-dot" />Northstar Studio</div><span className="eyebrow">Kablet demonstration</span><h1>Make the next step feel obvious.</h1><p className="hero-copy">Northstar Studio helps growing teams find clarity, build momentum and move forward with confidence.</p><div className="hero-meta"><span>Thoughtful guidance</span><span>Human-sized service</span></div></header><div className="initial-experience"><ExperienceRenderer experience={experience} /></div><DemoDecisionSelector /><p className="demo-note">Fictional demonstration only · no live Business Truth, availability, booking or action is connected.</p></div></main>;
}
