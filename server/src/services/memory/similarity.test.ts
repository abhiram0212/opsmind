import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../database/db';
import { seedDatabase } from '../../database/seed';
import { LocalMemoryProvider } from './local-provider';
import type { Incident, Memory } from '../../types/domain';
import { rankMemories } from './similarity';

const incident: Incident = {
  id: 'test', incidentNumber: 'INC-TEST', title: 'Payment API unavailable', description: 'Payment 503 connection pool timeout',
  severity: 'CRITICAL', status: 'INVESTIGATING', service: 'Payment API', environment: 'production',
  symptoms: ['DB connection acquisition timeout', 'HTTP 503', 'connection pool'], detectedAt: new Date().toISOString(),
  resolvedAt: null, rootCause: null, resolution: null, recoveryTime: null, aiAssisted: false, confidence: 0,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

describe('evidence-based memory search', () => {
  it('ranks service and symptom overlaps above unrelated memories', () => {
    const fixture = (id: string, services: string[], rootCause: string, content: string): Memory => ({
      id, incidentId: null, type: 'LESSON', title: content, content, rootCause,
      successfulActions: ['Inspect the connection pool'], failedActions: [], lessonsLearned: [],
      services, tags: ['payment', 'database', 'connection'], confidence: 0.9, createdAt: new Date().toISOString(),
    });
    const results = rankMemories(incident, [
      fixture('redis', ['Redis Cache'], 'Redis memory pressure', 'Cache eviction'),
      fixture('payment', ['Payment API'], 'Database connection pool exhaustion', 'Payment 503 DB connection acquisition timeout'),
    ]);
    expect(results[0]?.memory.id).toBe('payment');
    expect(results[0]?.similarity).toBeGreaterThan(0);
  });

  it('searches seeded persistent records and retrieves a newly stored experience', () => {
    const database = createDatabase(':memory:');
    seedDatabase(database);
    const provider = new LocalMemoryProvider(database);
    expect(provider.search(incident)[0]?.memory.services).toContain('Payment API');
    const initialCount = Number((database.prepare('SELECT COUNT(*) AS count FROM memories').get() as { count: number }).count);
    const storedIncidentId = String((database.prepare('SELECT id FROM incidents LIMIT 1').get() as { id: string }).id);
    database.prepare('INSERT INTO memories VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      'learned', storedIncidentId, 'INCIDENT', 'Learned payment outage', 'Payment API DB connection pool recovered after approved pool increase.',
      'Database connection pool exhaustion', JSON.stringify(['Increase PostgreSQL connection pool']), JSON.stringify(['Restart all services']),
      JSON.stringify(['Check this learned experience first']), JSON.stringify(['Payment API']), JSON.stringify(['payment', 'database', 'connection']), 0.96, new Date().toISOString(),
    );
    const results = provider.search(incident);
    expect(Number((database.prepare('SELECT COUNT(*) AS count FROM memories').get() as { count: number }).count)).toBe(initialCount + 1);
    expect(results.some((result) => result.memory.id === 'learned')).toBe(true);
    database.close();
  });
});