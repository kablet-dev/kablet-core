import { loadServerConfig } from '@kablet/config';
let stopping=false;
let idleHandle: NodeJS.Timeout | undefined;
try { const config=loadServerConfig(); console.log(`Kablet worker ready on database ${new URL(config.DATABASE_URL).host}`); idleHandle = setInterval(() => undefined, 60_000); } catch (error) { console.error('Worker startup failed:', error); process.exitCode=1; }
function shutdown(){ if(stopping)return; stopping=true; if(idleHandle) clearInterval(idleHandle); console.log('Kablet worker stopped'); }
process.on('SIGINT',shutdown); process.on('SIGTERM',shutdown);
