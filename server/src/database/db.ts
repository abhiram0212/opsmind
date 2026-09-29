import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function createDatabase(filename: string): Database.Database {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
      latency REAL NOT NULL, errorRate REAL NOT NULL, cpu REAL NOT NULL,
      memory REAL NOT NULL, uptime REAL NOT NULL, lastIncident TEXT
    );
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY, incidentNumber TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      description TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL,
      service TEXT NOT NULL, environment TEXT NOT NULL, symptoms TEXT NOT NULL,
      detectedAt TEXT NOT NULL, resolvedAt TEXT, rootCause TEXT, resolution TEXT,
      recoveryTime REAL, aiAssisted INTEGER NOT NULL DEFAULT 0, confidence REAL NOT NULL DEFAULT 0,
      investigation TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS incident_events (
      id TEXT PRIMARY KEY, incidentId TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL, availableAt INTEGER NOT NULL, eventType TEXT NOT NULL,
      message TEXT NOT NULL, source TEXT NOT NULL, severity TEXT NOT NULL, metadata TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY, incidentId TEXT REFERENCES incidents(id) ON DELETE SET NULL,
      type TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, rootCause TEXT NOT NULL,
      successfulActions TEXT NOT NULL, failedActions TEXT NOT NULL,
      lessonsLearned TEXT NOT NULL, services TEXT NOT NULL, tags TEXT NOT NULL,
      confidence REAL NOT NULL, createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runbooks (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, service TEXT NOT NULL,
      severity TEXT NOT NULL, steps TEXT NOT NULL, riskLevel TEXT NOT NULL,
      successRate REAL NOT NULL, usageCount INTEGER NOT NULL, averageRecoveryTime REAL NOT NULL,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_actions (
      id TEXT PRIMARY KEY, incidentId TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      action TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL,
      requiresApproval INTEGER NOT NULL, approvedBy TEXT, executedAt TEXT, result TEXT
    );
  `);
  return db;
}

export const db = createDatabase(resolve(process.env.OPSMIND_DB_PATH ?? 'server/data/opsmind.sqlite'));