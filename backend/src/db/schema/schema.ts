import { pgTable, uuid, text, timestamp, integer, boolean, date } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

export const sleepLogs = pgTable('sleep_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  bedtime: timestamp('bedtime', { withTimezone: true }).notNull(),
  wakeTime: timestamp('wake_time', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const homeworkItems = pgTable('homework_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  title: text('title').notNull(),
  dueDate: date('due_date').notNull(),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chores = pgTable('chores', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  emoji: text('emoji').notNull(),
  frequency: text('frequency').notNull(),
  completedToday: boolean('completed_today').notNull().default(false),
  lastCompletedAt: timestamp('last_completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
