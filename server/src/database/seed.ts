import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

const services = [
  ['payment-api', 'Payment API', 'HEALTHY', 128, 0.4, 35, 48, 99.98],
  ['checkout', 'Checkout', 'HEALTHY', 94, 0.2, 29, 42, 99.99],
  ['redis-cache', 'Redis Cache', 'HEALTHY', 3, 0.1, 42, 61, 99.97],
  ['postgresql', 'PostgreSQL', 'HEALTHY', 12, 0.1, 41, 57, 99.99],
  ['kubernetes', 'Kubernetes', 'HEALTHY', 24, 0.1, 48, 53, 99.95],
  ['auth-service', 'Auth Service', 'HEALTHY', 72, 0.2, 26, 37, 99.99],
  ['api-gateway', 'API Gateway', 'HEALTHY', 33, 0.1, 31, 44, 99.98],
  ['inventory', 'Inventory', 'HEALTHY', 86, 0.1, 37, 50, 99.97],
  ['notification', 'Notification', 'HEALTHY', 106, 0.3, 21, 34, 99.94],
  ['order-service', 'Order Service', 'HEALTHY', 118, 0.2, 39, 49, 99.96],
] as const;

const cases = [
  { service: 'Payment API', title: 'Payment requests returning 503', cause: 'Database connection pool exhaustion', action: 'Increase PostgreSQL connection pool from 100 to 200', failed: 'Restart all application services', tag: 'database connections payment timeout 503', symptom: 'DB connection acquisition timeout' },
  { service: 'Redis Cache', title: 'Redis cache memory pressure', cause: 'Redis maxmemory limit reached during cache growth', action: 'Evict stale cache keys and raise maxmemory limit', failed: 'Flush the entire production cache', tag: 'redis memory eviction cache oom', symptom: 'Redis maxmemory exceeded' },
  { service: 'Kubernetes', title: 'Workloads in CrashLoopBackOff', cause: 'Container liveness probe timeout under load', action: 'Adjust liveness probe timeout and inspect pod events', failed: 'Delete all production pods', tag: 'kubernetes crashloop pod probe deployment', symptom: 'CrashLoopBackOff on 4 pods' },
  { service: 'PostgreSQL', title: 'Database query latency spike', cause: 'Missing index caused sequential scans', action: 'Add the missing index and verify query plan', failed: 'Restart the primary database', tag: 'database latency query index postgres', symptom: 'PostgreSQL query latency above 1 second' },
  { service: 'Auth Service', title: 'Authentication requests failing', cause: 'Expired signing key not rotated on a worker', action: 'Rotate signing key and restart auth workers', failed: 'Disable token validation', tag: 'authentication jwt signing key auth', symptom: 'JWT signature validation failed' },
] as const;

const runbookNames = [
  ['Payment API', 'Database connection recovery', 'HIGH'],
  ['Redis Cache', 'Redis memory recovery', 'HIGH'],
  ['Kubernetes', 'CrashLoopBackOff investigation', 'MEDIUM'],
  ['PostgreSQL', 'Database latency response', 'MEDIUM'],
  ['Auth Service', 'Authentication recovery', 'MEDIUM'],
  ['API Gateway', 'Gateway upstream recovery', 'MEDIUM'],
  ['Checkout', 'Checkout dependency check', 'LOW'],
  ['Inventory', 'Inventory API recovery', 'LOW'],
  ['Notification', 'Queue backlog resolution', 'LOW'],
  ['Order Service', 'Order processing recovery', 'MEDIUM'],
] as const;

export function seedDatabase(database: Database.Database): void {
  if (Number((database.prepare('SELECT COUNT(*) AS count FROM services').get() as { count: number }).count) > 0) return;
  const now = Date.now();
  const insertService = database.prepare('INSERT INTO services VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  services.forEach((service) => insertService.run(...service, null));

  const insertIncident = database.prepare(`INSERT INTO incidents
    (id, incidentNumber, title, description, severity, status, service, environment, symptoms,
     detectedAt, resolvedAt, rootCause, resolution, recoveryTime, aiAssisted, confidence, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 'RESOLVED', ?, 'production', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertMemory = database.prepare(`INSERT INTO memories VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertEvent = database.prepare(`INSERT INTO incident_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertRunbook = database.prepare('INSERT INTO runbooks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

  for (let index = 0; index < 30; index += 1) {
    const scenario = cases[index % cases.length]!;
    const incidentNumber = `INC-${String(217 + index).padStart(4, '0')}`;
    const incidentId = randomUUID();
    const detectedAt = new Date(now - (30 - index) * 86400000).toISOString();
    const resolvedAt = new Date(Date.parse(detectedAt) + (12 + (index % 6) * 7) * 60000).toISOString();
    const symptoms = [scenario.symptom, ...(scenario.tag.split(' ').slice(0, 3))];
    insertIncident.run(incidentId, incidentNumber, scenario.title, `${scenario.title} affected ${scenario.service} in production.`, index % 6 === 0 ? 'CRITICAL' : 'HIGH', scenario.service, JSON.stringify(symptoms), detectedAt, resolvedAt, scenario.cause, scenario.action, Date.parse(resolvedAt) - Date.parse(detectedAt), index % 3 !== 0 ? 1 : 0, 0.84 + (index % 13) / 100, detectedAt, resolvedAt);
    if (index < 20) insertEvent.run(randomUUID(), incidentId, resolvedAt, now, 'RECOVERY', scenario.action, 'on-call', 'INFO', '{}');
    if (index < 30) insertMemory.run(randomUUID(), incidentId, 'INCIDENT', scenario.title, `${scenario.service}: ${scenario.symptom}. Resolved with ${scenario.action}. Similarity evidence: ${scenario.tag}.`, scenario.cause, JSON.stringify([scenario.action]), JSON.stringify([scenario.failed]), JSON.stringify([`Verify ${scenario.cause.toLowerCase()} before broad restarts.`, 'Compare current telemetry against this incident.']), JSON.stringify([scenario.service]), JSON.stringify(scenario.tag.split(' ')), 0.88 + (index % 10) / 100, resolvedAt);
  }

  for (let index = 0; index < 20; index += 1) {
    const scenario = cases[index % cases.length]!;
    insertMemory.run(randomUUID(), null, 'LESSON', `${scenario.service}: recovery lesson ${index + 1}`, `${scenario.title}. ${scenario.symptom}; successful action: ${scenario.action}.`, scenario.cause, JSON.stringify([scenario.action]), JSON.stringify([scenario.failed]), JSON.stringify([`Check ${scenario.cause.toLowerCase()} first.`]), JSON.stringify([scenario.service]), JSON.stringify(scenario.tag.split(' ')), 0.8 + (index % 15) / 100, new Date(now - index * 3600000).toISOString());
  }

  runbookNames.forEach(([service, name, severity], index) => insertRunbook.run(
    `rb-${index + 1}`, name, `Evidence-led response procedures for ${service}.`, service, severity,
    JSON.stringify([
      { id: 'inspect', title: 'Inspect current evidence', description: 'Review service metrics, recent logs, and deployment history.', risk: 'LOW', requiresApproval: false, status: 'PENDING' },
      { id: 'compare', title: 'Compare prior incidents', description: 'Compare the live symptoms against stored incident experience.', risk: 'LOW', requiresApproval: false, status: 'PENDING' },
      { id: 'remediate', title: 'Apply targeted mitigation', description: 'Apply the evidence-supported change after operator approval.', risk: 'MEDIUM', requiresApproval: true, status: 'PENDING' },
      { id: 'verify', title: 'Verify service recovery', description: 'Confirm health metrics recover and observe for regression.', risk: 'LOW', requiresApproval: false, status: 'PENDING' },
    ]), index % 3 === 0 ? 'HIGH' : index % 2 === 0 ? 'MEDIUM' : 'LOW', 84 + (index % 14), 8 + index * 3, 14 + index * 6,
    new Date(now - 90 * 86400000).toISOString(), new Date(now).toISOString(),
  ));
}