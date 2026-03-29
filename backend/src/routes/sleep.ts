import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerSleepRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get('/api/sleep', {
    schema: {
      description: 'Get sleep logs for the authenticated user',
      tags: ['sleep'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 14, description: 'Maximum number of logs to return' },
        },
      },
      response: {
        200: {
          description: 'Sleep logs retrieved successfully',
          type: 'object',
          properties: {
            logs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  userId: { type: 'string' },
                  bedtime: { type: 'string', format: 'date-time' },
                  wakeTime: { type: ['string', 'null'], format: 'date-time' },
                  durationMinutes: { type: ['integer', 'null'] },
                  notes: { type: ['string', 'null'] },
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
  }, async (request: FastifyRequest<{ Querystring: { limit?: number } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const pageLimit = request.query.limit || 14;
    app.logger.info({ userId: session.user.id, limit: pageLimit }, 'Fetching sleep logs');

    const logs = await app.db.select().from(schema.sleepLogs)
      .where(eq(schema.sleepLogs.userId, session.user.id))
      .orderBy(desc(schema.sleepLogs.bedtime))
      .limit(pageLimit);

    app.logger.info({ userId: session.user.id, count: logs.length }, 'Sleep logs fetched');
    return { logs };
  });

  app.fastify.post('/api/sleep', {
    schema: {
      description: 'Create a new sleep log',
      tags: ['sleep'],
      body: {
        type: 'object',
        required: ['bedtime'],
        properties: {
          bedtime: { type: 'string', format: 'date-time', description: 'Sleep start time (ISO 8601)' },
          notes: { type: 'string', description: 'Optional notes about sleep' },
        },
      },
      response: {
        201: {
          description: 'Sleep log created successfully',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            bedtime: { type: 'string', format: 'date-time' },
            wakeTime: { type: ['string', 'null'], format: 'date-time' },
            durationMinutes: { type: ['integer', 'null'] },
            notes: { type: ['string', 'null'] },
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
  }, async (request: FastifyRequest<{ Body: { bedtime: string; notes?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { bedtime, notes } = request.body;
    app.logger.info({ userId: session.user.id, bedtime }, 'Creating sleep log');

    const [created] = await app.db.insert(schema.sleepLogs).values({
      userId: session.user.id,
      bedtime: new Date(bedtime),
      notes: notes || null,
    }).returning();

    app.logger.info({ userId: session.user.id, sleepLogId: created.id }, 'Sleep log created');
    reply.code(201);
    return created;
  });

  app.fastify.patch('/api/sleep/:id', {
    schema: {
      description: 'Update a sleep log',
      tags: ['sleep'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Sleep log ID' },
        },
      },
      body: {
        type: 'object',
        properties: {
          wakeTime: { type: 'string', format: 'date-time', description: 'Sleep end time (ISO 8601)' },
          notes: { type: 'string', description: 'Notes about sleep' },
        },
      },
      response: {
        200: {
          description: 'Sleep log updated successfully',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            bedtime: { type: 'string', format: 'date-time' },
            wakeTime: { type: ['string', 'null'], format: 'date-time' },
            durationMinutes: { type: ['integer', 'null'] },
            notes: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        404: {
          description: 'Sleep log not found',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { wakeTime?: string; notes?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const { wakeTime, notes } = request.body;
    app.logger.info({ userId: session.user.id, sleepLogId: id }, 'Updating sleep log');

    const existing = await app.db.query.sleepLogs.findFirst({
      where: eq(schema.sleepLogs.id, id),
    });

    if (!existing) {
      app.logger.warn({ userId: session.user.id, sleepLogId: id }, 'Sleep log not found');
      return reply.status(404).send({ error: 'Sleep log not found' });
    }

    if (existing.userId !== session.user.id) {
      app.logger.warn({ userId: session.user.id, sleepLogId: id }, 'Ownership check failed');
      return reply.status(404).send({ error: 'Sleep log not found' });
    }

    let durationMinutes: number | null = existing.durationMinutes;
    if (wakeTime) {
      const wake = new Date(wakeTime);
      const diffMs = wake.getTime() - existing.bedtime.getTime();
      durationMinutes = Math.floor(diffMs / (1000 * 60));
    }

    const [updated] = await app.db.update(schema.sleepLogs)
      .set({
        wakeTime: wakeTime ? new Date(wakeTime) : existing.wakeTime,
        durationMinutes,
        notes: notes !== undefined ? notes : existing.notes,
      })
      .where(eq(schema.sleepLogs.id, id))
      .returning();

    app.logger.info({ userId: session.user.id, sleepLogId: id }, 'Sleep log updated');
    return updated;
  });

  app.fastify.delete('/api/sleep/:id', {
    schema: {
      description: 'Delete a sleep log',
      tags: ['sleep'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Sleep log ID' },
        },
      },
      response: {
        200: {
          description: 'Sleep log deleted successfully',
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
          description: 'Sleep log not found',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    app.logger.info({ userId: session.user.id, sleepLogId: id }, 'Deleting sleep log');

    const existing = await app.db.query.sleepLogs.findFirst({
      where: eq(schema.sleepLogs.id, id),
    });

    if (!existing) {
      app.logger.warn({ userId: session.user.id, sleepLogId: id }, 'Sleep log not found');
      return reply.status(404).send({ error: 'Sleep log not found' });
    }

    if (existing.userId !== session.user.id) {
      app.logger.warn({ userId: session.user.id, sleepLogId: id }, 'Ownership check failed');
      return reply.status(404).send({ error: 'Sleep log not found' });
    }

    await app.db.delete(schema.sleepLogs).where(eq(schema.sleepLogs.id, id));

    app.logger.info({ userId: session.user.id, sleepLogId: id }, 'Sleep log deleted');
    return { success: true };
  });
}
