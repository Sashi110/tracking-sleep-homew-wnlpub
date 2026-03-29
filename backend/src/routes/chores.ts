import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, asc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

const DEFAULT_CHORES = [
  { title: 'Make bed', emoji: '🛏️', frequency: 'daily' },
  { title: 'Brush teeth', emoji: '🦷', frequency: 'daily' },
  { title: 'Tidy room', emoji: '🧹', frequency: 'daily' },
];

export function registerChoresRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get('/api/chores', {
    schema: {
      description: 'Get chores for the authenticated user',
      tags: ['chores'],
      response: {
        200: {
          description: 'Chores retrieved successfully',
          type: 'object',
          properties: {
            chores: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  userId: { type: 'string' },
                  title: { type: 'string' },
                  emoji: { type: 'string' },
                  frequency: { type: 'string' },
                  completedToday: { type: 'boolean' },
                  lastCompletedAt: { type: ['string', 'null'], format: 'date-time' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching chores');

    let chores = await app.db.select().from(schema.chores)
      .where(eq(schema.chores.userId, session.user.id))
      .orderBy(asc(schema.chores.createdAt));

    if (chores.length === 0) {
      app.logger.info({ userId: session.user.id }, 'No chores found, seeding defaults');

      const defaultChoresValues = DEFAULT_CHORES.map(chore => ({
        ...chore,
        userId: session.user.id,
      }));

      const inserted = await app.db.insert(schema.chores).values(defaultChoresValues).returning();
      chores = inserted;

      app.logger.info({ userId: session.user.id, count: inserted.length }, 'Default chores seeded');
    }

    app.logger.info({ userId: session.user.id, count: chores.length }, 'Chores fetched');
    return { chores };
  });

  app.fastify.post('/api/chores', {
    schema: {
      description: 'Create a new chore',
      tags: ['chores'],
      body: {
        type: 'object',
        required: ['title', 'emoji', 'frequency'],
        properties: {
          title: { type: 'string', description: 'Chore title' },
          emoji: { type: 'string', description: 'Emoji for the chore' },
          frequency: { type: 'string', enum: ['daily', 'weekly'], description: 'Frequency of chore' },
        },
      },
      response: {
        201: {
          description: 'Chore created successfully',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            title: { type: 'string' },
            emoji: { type: 'string' },
            frequency: { type: 'string' },
            completedToday: { type: 'boolean' },
            lastCompletedAt: { type: ['string', 'null'], format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { title: string; emoji: string; frequency: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { title, emoji, frequency } = request.body;
    app.logger.info({ userId: session.user.id, title, frequency }, 'Creating chore');

    const [created] = await app.db.insert(schema.chores).values({
      userId: session.user.id,
      title,
      emoji,
      frequency,
    }).returning();

    app.logger.info({ userId: session.user.id, choreId: created.id }, 'Chore created');
    reply.code(201);
    return created;
  });

  app.fastify.patch('/api/chores/:id', {
    schema: {
      description: 'Update a chore',
      tags: ['chores'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Chore ID' },
        },
      },
      body: {
        type: 'object',
        properties: {
          completedToday: { type: 'boolean', description: 'Mark as completed today' },
          title: { type: 'string', description: 'Chore title' },
          emoji: { type: 'string', description: 'Emoji for the chore' },
          frequency: { type: 'string', description: 'Frequency of chore' },
        },
      },
      response: {
        200: {
          description: 'Chore updated successfully',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            title: { type: 'string' },
            emoji: { type: 'string' },
            frequency: { type: 'string' },
            completedToday: { type: 'boolean' },
            lastCompletedAt: { type: ['string', 'null'], format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        404: {
          description: 'Chore not found',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { completedToday?: boolean; title?: string; emoji?: string; frequency?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const { completedToday, title, emoji, frequency } = request.body;
    app.logger.info({ userId: session.user.id, choreId: id }, 'Updating chore');

    const existing = await app.db.query.chores.findFirst({
      where: eq(schema.chores.id, id),
    });

    if (!existing) {
      app.logger.warn({ userId: session.user.id, choreId: id }, 'Chore not found');
      return reply.status(404).send({ error: 'Chore not found' });
    }

    if (existing.userId !== session.user.id) {
      app.logger.warn({ userId: session.user.id, choreId: id }, 'Ownership check failed');
      return reply.status(404).send({ error: 'Chore not found' });
    }

    let lastCompletedAt = existing.lastCompletedAt;
    if (completedToday === true) {
      lastCompletedAt = new Date();
    }

    const [updated] = await app.db.update(schema.chores)
      .set({
        completedToday: completedToday !== undefined ? completedToday : existing.completedToday,
        lastCompletedAt,
        title: title !== undefined ? title : existing.title,
        emoji: emoji !== undefined ? emoji : existing.emoji,
        frequency: frequency !== undefined ? frequency : existing.frequency,
      })
      .where(eq(schema.chores.id, id))
      .returning();

    app.logger.info({ userId: session.user.id, choreId: id }, 'Chore updated');
    return updated;
  });

  app.fastify.delete('/api/chores/:id', {
    schema: {
      description: 'Delete a chore',
      tags: ['chores'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Chore ID' },
        },
      },
      response: {
        200: {
          description: 'Chore deleted successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        404: {
          description: 'Chore not found',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    app.logger.info({ userId: session.user.id, choreId: id }, 'Deleting chore');

    const existing = await app.db.query.chores.findFirst({
      where: eq(schema.chores.id, id),
    });

    if (!existing) {
      app.logger.warn({ userId: session.user.id, choreId: id }, 'Chore not found');
      return reply.status(404).send({ error: 'Chore not found' });
    }

    if (existing.userId !== session.user.id) {
      app.logger.warn({ userId: session.user.id, choreId: id }, 'Ownership check failed');
      return reply.status(404).send({ error: 'Chore not found' });
    }

    await app.db.delete(schema.chores).where(eq(schema.chores.id, id));

    app.logger.info({ userId: session.user.id, choreId: id }, 'Chore deleted');
    return { success: true };
  });
}
