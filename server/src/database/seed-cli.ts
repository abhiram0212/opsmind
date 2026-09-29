import 'dotenv/config';
import { db } from './db';
import { seedDatabase } from './seed';

seedDatabase(db);
console.log(`Seeded ${Number((db.prepare('SELECT COUNT(*) AS count FROM incidents').get() as { count: number }).count)} incidents and ${Number((db.prepare('SELECT COUNT(*) AS count FROM memories').get() as { count: number }).count)} memories.`);
db.close();