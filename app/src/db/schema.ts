import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const lists = sqliteTable('lists', {
  id: text('id').primaryKey(),
  chatInstance: text('chat_instance').notNull(),
  name: text('name').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull(),
});

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  listId: text('list_id')
    .notNull()
    .references(() => lists.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  completedBy: text('completed_by'),
  createdBy: text('created_by').notNull(),
  category: text('category').default('other'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
