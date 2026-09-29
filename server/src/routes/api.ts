import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { seedDatabase } from '../database/seed';
import { investigate } from '../services/agent/incident-agent';
import { parseJson } from '../services/memory/similarity';
import type { Incident, Memory, RunbookStep, Service } from '../types/domain';

const createSchema = z.object({ scenario: z.enum(['payment', 'redis', 'kubernetes', 'database', 'auth', 'gateway']).default('payment') });
const decisionSchema = z.object({ decision: z.enum(['approve', 'reject']), approvedBy: z.string().trim().min(2).max(80).default('Demo operator') });
const querySchema = z.object({ q: z.string().trim().max(240).default(''), service: z.string().max(80).optional() });
const scenarios = {
  payment: { service: 'Payment API', title: 'Payment API unavailable', symptoms: ['HTTP 503', 'DB connection acquisition timeout', 'Connection pool utilization 97%', 'Payment transaction failure'] },
  redis: { service: 'Redis Cache', title: 'Redis memory exhaustion', symptoms: ['Redis maxmemory exceeded', 'Cache eviction rate increased'] },
  kubernetes: { service: 'Kubernetes', title: 'Kubernetes CrashLoopBackOff', symptoms: ['CrashLoopBackOff', 'Liveness probe timeout'] },
  database: { service: 'PostgreSQL', title: 'Database latency spike', symptoms: ['Query latency above 1 second', 'Sequential scan increased'] },
  auth: { service: 'Auth Service', title: 'Authentication failure', symptoms: ['JWT signature validation failed', 'Authentication requests returning 401'] },
  gateway: { service: 'API Gateway', title: 'API gateway upstream failure', symptoms: ['Upstream connection timeout', 'Gateway returned HTTP 502'] },
} as const;
const serviceBaselines: Record<string, { latency: number; cpu: number; memory: number; uptime: number }> = {
  'Payment API': { latency: 128, cpu: 35, memory: 48, uptime: 99.98 }, Checkout: { latency: 94, cpu: 29, memory: 42, uptime: 99.99 },
  'Redis Cache': { latency: 3, cpu: 42, memory: 61, uptime: 99.97 }, PostgreSQL: { latency: 12, cpu: 41, memory: 57, uptime: 99.99 },
  Kubernetes: { latency: 24, cpu: 48, memory: 53, uptime: 99.95 }, 'Auth Service': { latency: 72, cpu: 26, memory: 37, uptime: 99.99 },
  'API Gateway': { latency: 33, cpu: 31, memory: 44, uptime: 99.98 }, Inventory: { latency: 86, cpu: 37, memory: 50, uptime: 99.97 },
  Notification: { latency: 106, cpu: 21, memory: 34, uptime: 99.94 }, 'Order Service': { latency: 118, cpu: 39, memory: 49, uptime: 99.96 },
};

function mapIncident(row: Record<string, unknown>): Incident {
  return { ...(row as unknown as Omit<Incident, 'symptoms' | 'aiAssisted' | 'confidence'>), symptoms: parseJson<string[]>(String(row.symptoms)), aiAssisted: Boolean(row.aiAssisted), confidence: Number(row.confidence) };
}

function rows<T>(database: Database.Database, sql: string, ...params: unknown[]): T[] {
  return database.prepare(sql).all(...params) as T[];
}

function error(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({ success: false, error: { code, message } });
}

export function createApi(database: Database.Database): Router {
  const router = Router();
  const getIncident = (id: string): Incident | undefined => {
    const row = database.prepare('SELECT * FROM incidents WHERE id = ? OR incidentNumber = ?').get(id, id) as Record<string, unknown> | undefined;
    return row ? mapIncident(row) : undefined;
  };

  router.get('/health', (_request, response) => response.json({ success: true, data: { server: 'healthy', database: database.open ? 'healthy' : 'unavailable', memoryProvider: process.env.MEMORY_PROVIDER === 'hindsight' ? 'Local Memory Fallback' : 'Local Memory Fallback', environment: process.env.NODE_ENV ?? 'development', version: '1.0.0' } }));
  router.get('/dashboard', (_request, response) => {
    const data = {
      metrics: {
        activeIncidents: Number((database.prepare("SELECT COUNT(*) AS count FROM incidents WHERE status NOT IN ('RESOLVED','FAILED')").get() as { count: number }).count),
        resolvedToday: Number((database.prepare("SELECT COUNT(*) AS count FROM incidents WHERE status = 'RESOLVED' AND date(resolvedAt) = date('now')").get() as { count: number }).count),
        averageMttr: Number((database.prepare("SELECT ROUND(AVG(recoveryTime) / 60000, 1) AS value FROM incidents WHERE status = 'RESOLVED'").get() as { value: number | null }).value ?? 0),
        memoryCount: Number((database.prepare('SELECT COUNT(*) AS count FROM memories').get() as { count: number }).count),
        aiAssisted: Number((database.prepare("SELECT COUNT(*) AS count FROM incidents WHERE aiAssisted = 1").get() as { count: number }).count),
        runbookSuccessRate: Number((database.prepare('SELECT ROUND(AVG(successRate), 1) AS value FROM runbooks').get() as { value: number }).value),
      },
      incidents: rows<Incident>(database, 'SELECT * FROM incidents ORDER BY createdAt DESC LIMIT 8').map((row) => mapIncident(row as unknown as Record<string, unknown>)),
      memories: rows<Memory>(database, 'SELECT * FROM memories ORDER BY createdAt DESC LIMIT 6').map((memory) => ({ ...memory, successfulActions: parseJson<string[]>(memory.successfulActions as unknown as string), failedActions: parseJson<string[]>(memory.failedActions as unknown as string), lessonsLearned: parseJson<string[]>(memory.lessonsLearned as unknown as string), services: parseJson<string[]>(memory.services as unknown as string), tags: parseJson<string[]>(memory.tags as unknown as string) })),
      services: rows<Service>(database, 'SELECT * FROM services'),
      provider: 'Local Memory Fallback',
    };
    response.json({ success: true, data });
  });

  router.get('/incidents', (request, response) => {
    const search = String(request.query.q ?? '').trim();
    const incidentRows = rows<Record<string, unknown>>(database, `SELECT * FROM incidents
      WHERE (? = '' OR incidentNumber LIKE ? OR title LIKE ? OR service LIKE ?)
      ORDER BY createdAt DESC LIMIT 100`, search, `%${search}%`, `%${search}%`, `%${search}%`).map(mapIncident);
    response.json({ success: true, data: incidentRows });
  });

  router.post('/incidents', (request, response) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return error(response, 400, 'INVALID_INPUT', 'Choose a supported demo incident scenario.');
    const scenario = scenarios[parsed.data.scenario];
    const incidentNumber = `INC-${String(Number((database.prepare("SELECT COALESCE(MAX(CAST(SUBSTR(incidentNumber, 5) AS INTEGER)), 246) AS value FROM incidents").get() as { value: number }).value) + 1).padStart(4, '0')}`;
    const id = randomUUID();
    const now = new Date().toISOString();
    database.prepare(`INSERT INTO incidents (id, incidentNumber, title, description, severity, status, service, environment, symptoms, detectedAt, aiAssisted, confidence, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'CRITICAL', 'DETECTED', ?, 'production', ?, ?, 0, 0, ?, ?)`).run(id, incidentNumber, scenario.title, `${scenario.title}. ${scenario.symptoms.join('; ')}.`, scenario.service, JSON.stringify(scenario.symptoms), now, now, now);
    database.prepare('UPDATE services SET status = ?, errorRate = ?, latency = ?, lastIncident = ? WHERE name = ?').run('DEGRADED', 42.8, 842, incidentNumber, scenario.service);
    const baseLogs = scenario.symptoms.map((symptom, index) => ({ message: `${index === 0 ? 'ERROR' : index === 2 ? 'WARN' : 'ERROR'} ${symptom}`, severity: index === 2 ? 'WARN' : 'ERROR' }));
    if (parsed.data.scenario === 'payment') baseLogs.push({ message: 'ALERT Error rate exceeded threshold', severity: 'CRITICAL' });
    const insertEvent = database.prepare('INSERT INTO incident_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    baseLogs.forEach((log, index) => insertEvent.run(randomUUID(), id, new Date(Date.now() + index * 1400).toISOString(), Date.now() + index * 1400, 'LOG_EVENT', log.message, 'simulated-infrastructure', log.severity, '{}'));
    insertEvent.run(randomUUID(), id, now, Date.now(), 'METRIC_ALERT', 'Error rate exceeded threshold; affected service degraded.', 'simulated-infrastructure', 'CRITICAL', JSON.stringify({ errorRate: 42.8, latency: 842 }));
    response.status(201).json({ success: true, data: getIncident(id) });
  });

  router.get('/incidents/:id', (request, response) => {
    const incident = getIncident(request.params.id ?? '');
    if (!incident) return error(response, 404, 'INCIDENT_NOT_FOUND', 'Incident not found.');
    const events = rows<Record<string, unknown>>(database, 'SELECT * FROM incident_events WHERE incidentId = ? AND availableAt <= ? ORDER BY timestamp ASC', incident.id, Date.now());
    const investigationRow = database.prepare('SELECT investigation FROM incidents WHERE id = ?').get(incident.id) as { investigation: string | null };
    const learned = Boolean(database.prepare('SELECT id FROM memories WHERE incidentId = ?').get(incident.id));
    response.json({ success: true, data: { incident, events, learned, investigation: investigationRow.investigation ? JSON.parse(investigationRow.investigation) as unknown : null, actions: rows(database, 'SELECT * FROM agent_actions WHERE incidentId = ? ORDER BY rowid DESC', incident.id) } });
  });

  router.post('/incidents/:id/investigate', (request, response) => {
    const incident = getIncident(request.params.id ?? '');
    if (!incident) return error(response, 404, 'INCIDENT_NOT_FOUND', 'Incident not found.');
    response.json({ success: true, data: investigate(database, incident) });
  });

  router.post('/incidents/:id/actions', (request, response) => {
    const incident = getIncident(request.params.id ?? '');
    if (!incident) return error(response, 404, 'INCIDENT_NOT_FOUND', 'Incident not found.');
    const investigationRow = database.prepare('SELECT investigation FROM incidents WHERE id = ?').get(incident.id) as { investigation: string | null };
    if (!investigationRow.investigation) return error(response, 409, 'INVESTIGATION_REQUIRED', 'Run an investigation before requesting a remediation.');
    const investigation = JSON.parse(investigationRow.investigation) as { action: { description: string; reason: string; successRate: number } };
    const action = { id: randomUUID(), incidentId: incident.id, action: investigation.action.description, reason: investigation.action.reason, status: 'PENDING', requiresApproval: true, approvedBy: null, executedAt: null, result: null };
    database.prepare('INSERT INTO agent_actions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(action.id, action.incidentId, action.action, `Historical evidence: ${action.reason}. Runbook success: ${investigation.action.successRate}%.`, 'PENDING', 1, null, null, null);
    response.status(201).json({ success: true, data: action });
  });

  router.post('/actions/:id/decision', (request, response) => {
    const parsed = decisionSchema.safeParse(request.body);
    if (!parsed.success) return error(response, 400, 'INVALID_INPUT', 'Provide an approve or reject decision.');
    const action = database.prepare('SELECT * FROM agent_actions WHERE id = ?').get(request.params.id) as Record<string, unknown> | undefined;
    if (!action) return error(response, 404, 'ACTION_NOT_FOUND', 'Agent action not found.');
    if (action.status !== 'PENDING') return error(response, 409, 'ACTION_ALREADY_REVIEWED', 'This action has already been reviewed.');
    const status = parsed.data.decision === 'approve' ? 'APPROVED' : 'REJECTED';
    database.prepare('UPDATE agent_actions SET status = ?, approvedBy = ? WHERE id = ?').run(status, parsed.data.decision === 'approve' ? parsed.data.approvedBy : null, request.params.id);
    database.prepare('INSERT INTO incident_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), String(action.incidentId), new Date().toISOString(), Date.now(), 'HUMAN_ACTION', `Operator ${parsed.data.decision === 'approve' ? 'approved' : 'rejected'} remediation: ${String(action.action)}.`, parsed.data.approvedBy, parsed.data.decision === 'approve' ? 'INFO' : 'WARN', JSON.stringify({ actionId: action.id }));
    response.json({ success: true, data: { ...action, status, approvedBy: parsed.data.approvedBy } });
  });

  router.post('/actions/:id/execute', (request, response) => {
    const action = database.prepare('SELECT * FROM agent_actions WHERE id = ?').get(request.params.id) as Record<string, unknown> | undefined;
    if (!action) return error(response, 404, 'ACTION_NOT_FOUND', 'Agent action not found.');
    if (action.requiresApproval && action.status !== 'APPROVED') return error(response, 403, 'APPROVAL_REQUIRED', 'An operator must approve this action before execution.');
    const now = new Date().toISOString();
    database.prepare("UPDATE agent_actions SET status = 'EXECUTING' WHERE id = ?").run(request.params.id);
    const incident = getIncident(String(action.incidentId));
    if (!incident) return error(response, 404, 'INCIDENT_NOT_FOUND', 'The action incident no longer exists.');
    const investigationRow = database.prepare('SELECT investigation FROM incidents WHERE id = ?').get(incident.id) as { investigation: string | null };
    const investigation = investigationRow.investigation ? JSON.parse(investigationRow.investigation) as { likelyCause?: string; runbook?: { id: string; averageRecoveryTime: number; usageCount: number } | null } : {};
    const baseline = serviceBaselines[incident.service] ?? { latency: 120, cpu: 35, memory: 48, uptime: 99.9 };
    const isPayment = incident.service === 'Payment API';
    const result = isPayment
      ? 'Connection pool raised from 100 to 200; active connections recovered to 54.'
      : `${incident.service} service metrics returned to the simulated healthy baseline after the approved remediation.`;
    database.prepare("UPDATE agent_actions SET status = 'SUCCESS', executedAt = ?, result = ? WHERE id = ?").run(now, result, request.params.id);
    database.prepare("UPDATE services SET status = 'HEALTHY', latency = ?, errorRate = 0.4, cpu = ?, memory = ?, uptime = ?, lastIncident = ? WHERE name = ?")
      .run(baseline.latency, baseline.cpu, baseline.memory, baseline.uptime, incident.incidentNumber, incident.service);
    if (incident) {
      const recoveryTime = Math.max(Date.now() - Date.parse(incident.detectedAt), 60000);
      database.prepare("UPDATE incidents SET status = 'RESOLVED', resolvedAt = ?, rootCause = ?, resolution = ?, recoveryTime = ?, updatedAt = ?, confidence = MAX(confidence, 0.92) WHERE id = ?").run(now, investigation.likelyCause ?? 'Evidence-led investigation; root cause confirmed through operator-approved remediation', String(action.action), recoveryTime, now, incident.id);
      database.prepare('INSERT INTO incident_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), incident.id, now, Date.now(), 'AGENT_ACTION', `Approved remediation executed: ${String(action.action)}.`, 'incident-agent', 'INFO', JSON.stringify({ actionId: action.id }));
      database.prepare('INSERT INTO incident_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), incident.id, now, Date.now(), 'RECOVERY', `Service recovery verified after approved action: ${String(action.action)}.`, 'simulated-infrastructure', 'INFO', JSON.stringify({ latency: baseline.latency, errorRate: 0.4 }));
      if (investigation.runbook?.id) {
        database.prepare(`UPDATE runbooks SET usageCount = usageCount + 1, averageRecoveryTime = ROUND((averageRecoveryTime * usageCount + ?) / (usageCount + 1), 1), updatedAt = ? WHERE id = ?`)
          .run(recoveryTime / 60000, now, investigation.runbook.id);
      }
    }
    response.json({ success: true, data: { actionId: action.id, status: 'SUCCESS', resolved: true, recoveryTime: Date.now() - Date.parse(incident.detectedAt), result } });
  });

  router.post('/incidents/:id/learn', (request, response) => {
    const incident = getIncident(request.params.id ?? '');
    if (!incident) return error(response, 404, 'INCIDENT_NOT_FOUND', 'Incident not found.');
    if (incident.status !== 'RESOLVED') return error(response, 409, 'INCIDENT_NOT_RESOLVED', 'Resolve the incident before saving its experience.');
    const existing = database.prepare('SELECT id FROM memories WHERE incidentId = ?').get(incident.id);
    if (existing) return response.json({ success: true, data: { stored: false, memoryCount: Number((database.prepare('SELECT COUNT(*) AS count FROM memories').get() as { count: number }).count) } });
    const row = database.prepare('SELECT investigation FROM incidents WHERE id = ?').get(incident.id) as { investigation: string | null };
    const investigation = row.investigation ? JSON.parse(row.investigation) as { matches?: Array<{ memory: Memory }> } : {};
    const previous = investigation.matches?.[0]?.memory;
    const memoryId = randomUUID();
    database.prepare('INSERT INTO memories VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(memoryId, incident.id, 'INCIDENT', `${incident.incidentNumber}: ${incident.title}`, `${incident.description} Resolved by ${incident.resolution ?? 'an approved remediation'}.`, incident.rootCause ?? previous?.rootCause ?? 'Investigated production incident', JSON.stringify([incident.resolution ?? previous?.successfulActions[0] ?? 'Evidence-led operator investigation']), JSON.stringify(previous?.failedActions ?? []), JSON.stringify(['Compare current symptoms to this validated incident before attempting broad restarts.', `Resolved in ${Math.round((incident.recoveryTime ?? 0) / 60000)} minutes with an approved action.`]), JSON.stringify([incident.service]), JSON.stringify([...incident.symptoms, 'learned-experience']), 0.96, new Date().toISOString());
    response.status(201).json({ success: true, data: { stored: true, memoryId, memoryCount: Number((database.prepare('SELECT COUNT(*) AS count FROM memories').get() as { count: number }).count) } });
  });

  router.get('/memories', (request, response) => {
    const parsed = querySchema.safeParse({ q: request.query.q ?? '', service: request.query.service });
    if (!parsed.success) return error(response, 400, 'INVALID_INPUT', 'Search query is too long.');
    const query = parsed.data.q;
    const memoryRows = rows<Record<string, unknown>>(database, `SELECT * FROM memories
      WHERE (? = '' OR title LIKE ? OR content LIKE ? OR rootCause LIKE ? OR tags LIKE ?)
      AND (? IS NULL OR services LIKE ?) ORDER BY createdAt DESC LIMIT 100`, query, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, parsed.data.service ?? null, `%${parsed.data.service ?? ''}%`);
    response.json({ success: true, data: memoryRows.map((memory) => ({ ...memory, successfulActions: parseJson<string[]>(String(memory.successfulActions)), failedActions: parseJson<string[]>(String(memory.failedActions)), lessonsLearned: parseJson<string[]>(String(memory.lessonsLearned)), services: parseJson<string[]>(String(memory.services)), tags: parseJson<string[]>(String(memory.tags)) })) });
  });

  router.get('/services', (_request, response) => response.json({ success: true, data: rows(database, 'SELECT * FROM services ORDER BY name') }));
  router.get('/runbooks', (_request, response) => response.json({ success: true, data: rows<Record<string, unknown>>(database, 'SELECT * FROM runbooks ORDER BY successRate DESC').map((runbook) => ({ ...runbook, steps: parseJson<RunbookStep[]>(String(runbook.steps)) })) }));

  router.get('/analytics', (_request, response) => response.json({ success: true, data: {
    incidentFrequency: rows(database, "SELECT strftime('%Y-%m-%d', detectedAt) AS date, COUNT(*) AS count FROM incidents GROUP BY date ORDER BY date DESC LIMIT 14"),
    rootCauses: rows(database, 'SELECT rootCause AS name, COUNT(*) AS count FROM incidents WHERE rootCause IS NOT NULL GROUP BY rootCause ORDER BY count DESC LIMIT 8'),
    recovery: rows(database, "SELECT strftime('%Y-%m-%d', detectedAt) AS date, ROUND(AVG(recoveryTime) / 60000, 1) AS minutes, COUNT(*) AS count FROM incidents WHERE status = 'RESOLVED' GROUP BY date ORDER BY date DESC LIMIT 14"),
  } }));

  router.post('/demo/reset', (_request, response) => {
    const clear = database.transaction(() => {
      database.exec('DELETE FROM agent_actions; DELETE FROM incident_events; DELETE FROM memories; DELETE FROM incidents; DELETE FROM runbooks; DELETE FROM services;');
      seedDatabase(database);
    });
    clear();
    response.json({ success: true, data: { reset: true, incidentCount: Number((database.prepare('SELECT COUNT(*) AS count FROM incidents').get() as { count: number }).count), memoryCount: Number((database.prepare('SELECT COUNT(*) AS count FROM memories').get() as { count: number }).count) } });
  });

  return router;
}