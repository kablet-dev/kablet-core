import { describe, expect, it } from 'vitest'; import { KABLET_NAME } from '@kablet/domain';
describe('domain boundary',()=>{it('exports the project identity',()=>expect(KABLET_NAME).toContain('Kablet'));});
