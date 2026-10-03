import { decisionToExperience, experienceInputSchema } from '@kablet/domain';
import { demoExperienceInput } from './experience-fixture';

export function loadDemoExperience() {
  const input = experienceInputSchema.parse(demoExperienceInput);
  return decisionToExperience(input);
}
