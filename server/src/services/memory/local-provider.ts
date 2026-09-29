import type Database from 'better-sqlite3';
import type { Incident, Memory } from '../../types/domain';
import { parseJson, rankMemories, type MemoryMatch } from './similarity';

export class LocalMemoryProvider {
  constructor(private readonly database: Database.Database) {}

  search(incident: Incident): MemoryMatch[] {
    const rows = this.database.prepare('SELECT * FROM memories').all() as Array<Record<string, unknown>>;
    const memories: Memory[] = rows.map((row) => ({
      ...(row as unknown as Omit<Memory, 'successfulActions' | 'failedActions' | 'lessonsLearned' | 'services' | 'tags' | 'confidence' | 'createdAt'>),
      successfulActions: parseJson<string[]>(String(row.successfulActions)),
      failedActions: parseJson<string[]>(String(row.failedActions)),
      lessonsLearned: parseJson<string[]>(String(row.lessonsLearned)),
      services: parseJson<string[]>(String(row.services)),
      tags: parseJson<string[]>(String(row.tags)),
      confidence: Number(row.confidence), createdAt: String(row.createdAt),
    }));
    return rankMemories(incident, memories);
  }
}