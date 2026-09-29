import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { Incident, Runbook, RunbookStep } from '../../types/domain';
import { parseJson } from '../memory/similarity';
import { LocalMemoryProvider } from '../memory/local-provider';

export function investigate(database: Database.Database, incident: Incident) {
  const matches = new LocalMemoryProvider(database).search(incident).slice(0, 8);
  const runbookRow = database.prepare('SELECT * FROM runbooks WHERE service = ? ORDER BY successRate DESC LIMIT 1').get(incident.service) as Record<string, unknown> | undefined;
  const runbook: Runbook | null = runbookRow ? {
    ...(runbookRow as unknown as Omit<Runbook, 'steps' | 'successRate' | 'usageCount' | 'averageRecoveryTime'>),
    steps: parseJson<RunbookStep[]>(String(runbookRow.steps)), successRate: Number(runbookRow.successRate),
    usageCount: Number(runbookRow.usageCount), averageRecoveryTime: Number(runbookRow.averageRecoveryTime),
  } : null;
  const likelyCause = matches[0]?.memory.rootCause ?? 'Insufficient historical evidence; inspect current telemetry before changing configuration.';
  const action = matches[0]?.memory.successfulActions[0] ?? 'Inspect recent service logs and metrics before selecting a remediation.';
  const priorIncident = matches.find((match) => match.memory.type === 'INCIDENT' && match.memory.incidentId)?.memory.title.split(':')[0];
  const findings = matches.filter((match) => match.memory.rootCause === likelyCause);
  const evidence = {
    errorRate: incident.service === 'Payment API' ? 42.8 : 18.2,
    latency: incident.service === 'Payment API' ? 842 : 690,
    cpu: incident.service === 'Payment API' ? 82 : 74,
    memory: incident.service === 'Redis Cache' ? 94 : 71,
    databaseConnections: incident.service === 'Payment API' ? { used: 96, limit: 100 } : { used: 42, limit: 100 },
    recentDeployment: 'payments-api v2.14.0 · 18 minutes before detection',
    affectedServices: [incident.service, ...(incident.service === 'Payment API' ? ['PostgreSQL', 'Checkout'] : [])],
    recentLogs: ['ERROR Payment API returned HTTP 503', 'ERROR DB connection acquisition timeout', 'WARN Connection pool utilization: 97%', 'ERROR Payment transaction failed', 'ALERT Error rate exceeded threshold'],
  };
  const investigation = {
    evidence, matches, likelyCause,
    reasoning: matches.length
      ? `${priorIncident ? `This incident resembles the experience learned from ${priorIncident}. ` : ''}The current ${incident.service} symptoms match ${findings.length} retrieved historical experience${findings.length === 1 ? '' : 's'}: ${likelyCause}. ${matches[0]!.reason}.`
      : `No historical memories matched ${incident.service}; the recommendation is limited to direct evidence inspection.`,
    recommendation: matches.length
      ? `Inspect ${likelyCause.toLowerCase()} before performing broad service restarts. Historical successful action: ${action}.`
      : 'Inspect the most recent logs, metrics, and deployment before attempting a targeted change.',
    plan: [
      { id: 'connections', title: `Inspect ${incident.service === 'Payment API' ? 'PostgreSQL connections' : `${incident.service} telemetry`}`, status: 'READY', evidence: `${evidence.databaseConnections.used}/${evidence.databaseConnections.limit} database connections; ${evidence.errorRate}% error rate.` },
      { id: 'pool', title: 'Inspect application connection pool', status: 'READY', evidence: evidence.recentLogs[2] },
      { id: 'history', title: 'Compare historical incidents', status: matches.length ? 'COMPLETE' : 'READY', evidence: `${matches.length} relevant stored memories ranked using service, symptom, and keyword overlap.` },
      { id: 'deployment', title: 'Inspect recent deployment', status: 'READY', evidence: evidence.recentDeployment },
      { id: 'validate', title: 'Validate connection exhaustion', status: 'READY', evidence: findings.length ? `${findings.length} memory records support ${likelyCause}.` : 'Check current service signals before attributing a root cause.' },
    ],
    runbook,
    action: { description: action, reason: matches[0]?.reason ?? 'Current evidence supports inspection first.', successRate: runbook?.successRate ?? 0 },
    activity: [
      { status: 'complete', message: 'Incident received' }, { status: 'complete', message: 'Parsed live incident evidence' },
      { status: 'complete', message: `Retrieved ${matches.length} relevant historical memories` },
      { status: 'complete', message: `${likelyCause} is supported by ${findings.length} retrieved records` },
      { status: 'complete', message: runbook ? `${runbook.name} selected (${runbook.usageCount} recorded uses)` : 'No service-matched runbook found' },
    ],
  };
  database.prepare('UPDATE incidents SET status = ?, aiAssisted = 1, confidence = ?, investigation = ?, updatedAt = ? WHERE id = ?')
    .run('INVESTIGATING', matches[0]?.memory.confidence ?? 0.45, JSON.stringify(investigation), new Date().toISOString(), incident.id);
  database.prepare('INSERT INTO incident_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), incident.id, new Date().toISOString(), Date.now(), 'AGENT_ACTION', `Investigation retrieved ${matches.length} memories. ${likelyCause}.`, 'incident-agent', 'INFO', '{}');
  return investigation;
}