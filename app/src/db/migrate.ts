import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, rawDb } from './index';

migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations applied successfully');
rawDb.close();
