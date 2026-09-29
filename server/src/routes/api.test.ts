import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../database/db';
import { seedDatabase } from '../database/seed';
import { createApi } from './api';

describe('primary payment incident learning loop', () => {
  let server: Server;
  let database: ReturnType<typeof createDatabase>;
  let baseUrl: string;

  beforeEach(async () => {
    database = createDatabase(':memory:');
    seedDatabase(database);
    const app = express();
    app.use(express.json());
    app.use('/api', createApi(database));
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((problem) => problem ? reject(problem) : resolve()));
    database.close();
  });

  it('requires human approval, resolves the incident, stores learning, and retrieves it next time', async () => {
    const launch = await fetch(`${baseUrl}/incidents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: 'payment' }) });
    expect(launch.status).toBe(201);
    const launched = await launch.json() as { data: { id: string; incidentNumber: string } };
    expect(launched.data.incidentNumber).toBe('INC-0247');

    const investigationResponse = await fetch(`${baseUrl}/incidents/${launched.data.id}/investigate`, { method: 'POST' });
    expect(investigationResponse.status).toBe(200);
    const investigation = await investigationResponse.json() as { data: { matches: Array<{ memory: { services: string[] } }> } };
    expect(investigation.data.matches.length).toBeGreaterThan(0);
    expect(investigation.data.matches[0]?.memory.services).toContain('Payment API');

    const actionResponse = await fetch(`${baseUrl}/incidents/${launched.data.id}/actions`, { method: 'POST' });
    const action = await actionResponse.json() as { data: { id: string } };
    const blocked = await fetch(`${baseUrl}/actions/${action.data.id}/execute`, { method: 'POST' });
    expect(blocked.status).toBe(403);

    const rejected = await fetch(`${baseUrl}/actions/${action.data.id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'reject' }) });
    expect(rejected.status).toBe(200);
    const stillBlocked = await fetch(`${baseUrl}/actions/${action.data.id}/execute`, { method: 'POST' });
    expect(stillBlocked.status).toBe(403);

    const approved = await fetch(`${baseUrl}/actions/${action.data.id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'approve', approvedBy: 'Operator' }) });
    expect(approved.status).toBe(409);
    const replacementResponse = await fetch(`${baseUrl}/incidents/${launched.data.id}/actions`, { method: 'POST' });
    const replacement = await replacementResponse.json() as { data: { id: string } };
    const approvedReplacement = await fetch(`${baseUrl}/actions/${replacement.data.id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'approve', approvedBy: 'Operator' }) });
    expect(approvedReplacement.status).toBe(200);
    const execution = await fetch(`${baseUrl}/actions/${replacement.data.id}/execute`, { method: 'POST' });
    expect(execution.status).toBe(200);
    expect((await execution.json() as { data: { status: string } }).data.status).toBe('SUCCESS');

    const learningResponse = await fetch(`${baseUrl}/incidents/${launched.data.id}/learn`, { method: 'POST' });
    const learning = await learningResponse.json() as { data: { memoryCount: number } };
    expect(learningResponse.status).toBe(201);
    expect(learning.data.memoryCount).toBe(51);

    const secondLaunch = await fetch(`${baseUrl}/incidents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: 'payment' }) });
    const secondIncident = await secondLaunch.json() as { data: { id: string; incidentNumber: string } };
    const secondInvestigation = await fetch(`${baseUrl}/incidents/${secondIncident.data.id}/investigate`, { method: 'POST' });
    const nextEvidence = await secondInvestigation.json() as { data: { matches: Array<{ memory: { title: string } }>; reasoning: string; recommendation: string } };
    expect(nextEvidence.data.matches[0]?.memory.title).toBe('INC-0247: Payment API unavailable');
    expect(nextEvidence.data.reasoning).toContain('experience learned from INC-0247');
    expect(nextEvidence.data.recommendation).toContain('Increase PostgreSQL connection pool');

    const reset = await fetch(`${baseUrl}/demo/reset`, { method: 'POST' });
    const resetData = await reset.json() as { data: { incidentCount: number; memoryCount: number } };
    expect(reset.status).toBe(200);
    expect(resetData.data.incidentCount).toBe(30);
    expect(resetData.data.memoryCount).toBe(50);
  });

  it('recovers a Redis incident using its own historical evidence and service baseline', async () => {
    const launch = await fetch(`${baseUrl}/incidents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: 'redis' }) });
    const launched = await launch.json() as { data: { id: string } };
    const investigationResponse = await fetch(`${baseUrl}/incidents/${launched.data.id}/investigate`, { method: 'POST' });
    const investigation = await investigationResponse.json() as { data: { likelyCause: string; action: { description: string } } };
    expect(investigation.data.likelyCause).toContain('Redis');
    expect(investigation.data.action.description).toContain('cache keys');

    const actionResponse = await fetch(`${baseUrl}/incidents/${launched.data.id}/actions`, { method: 'POST' });
    const action = await actionResponse.json() as { data: { id: string } };
    await fetch(`${baseUrl}/actions/${action.data.id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'approve' }) });
    const execution = await fetch(`${baseUrl}/actions/${action.data.id}/execute`, { method: 'POST' });
    expect(execution.status).toBe(200);

    const detail = await fetch(`${baseUrl}/incidents/${launched.data.id}`).then((response) => response.json()) as { data: { incident: { status: string; rootCause: string } } };
    const services = await fetch(`${baseUrl}/services`).then((response) => response.json()) as { data: Array<{ name: string; status: string; latency: number }> };
    expect(detail.data.incident.status).toBe('RESOLVED');
    expect(detail.data.incident.rootCause).toContain('Redis');
    expect(services.data.find((service) => service.name === 'Redis Cache')).toMatchObject({ status: 'HEALTHY', latency: 3 });
  });
});