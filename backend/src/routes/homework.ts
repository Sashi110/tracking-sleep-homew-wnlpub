import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, asc, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerHomeworkRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get('/api/homework', {
    schema: {
      description: 'Get homework items for the authenticated user',
      tags: ['homework'],
      querystring: {
        type: 'object',
        properties: {
          completed: { type: 'boolean', description: 'Filter by completion status' },
        },
      },
      response: {
        200: {
          description: 'Homework items retrieved successfully',
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  userId: { type: 'string' },
                  subject: { type: 'string' },
                  title: { type: 'string' },
                  dueDate: { type: 'string', format: 'date' },
                  completed: { type: 'boolean' },
                  completedAt: { type: ['string', 'null'], format: 'date-time' },
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
  }, async (request: FastifyRequest<{ Querystring: { completed?: boolean } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, completed: request.query.completed }, 'Fetching homework items');

    const conditions = [eq(schema.homeworkItems.userId, session.user.id)];
    if (request.query.completed !== undefined) {
      conditions.push(eq(schema.homeworkItems.completed, request.query.completed));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    const items = await app.db.select().from(schema.homeworkItems)
      .where(whereClause)
      .orderBy(asc(schema.homeworkItems.dueDate));

    app.logger.info({ userId: session.user.id, count: items.length }, 'Homework items fetched');
    return { items };
  });

  app.fastify.post('/api/homework', {
    schema: {
      description: 'Create a new homework item',
      tags: ['homework'],
      body: {
        type: 'object',
        required: ['subject', 'title', 'dueDate'],
        properties: {
          subject: { type: 'string', description: 'Subject of homework' },
          title: { type: 'string', description: 'Homework title' },
          dueDate: { type: 'string', format: 'date', description: 'Due date (YYYY-MM-DD)' },
        },
      },
      response: {
        201: {
          description: 'Homework item created successfully',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            subject: { type: 'string' },
            title: { type: 'string' },
            dueDate: { type: 'string', format: 'date' },
            completed: { type: 'boolean' },
            completedAt: { type: ['string', 'null'], format: 'date-time' },
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
  }, async (request: FastifyRequest<{ Body: { subject: string; title: string; dueDate: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { subject, title, dueDate } = request.body;
    app.logger.info({ userId: session.user.id, subject, title, dueDate }, 'Creating homework item');

    const [created] = await app.db.insert(schema.homeworkItems).values({
      userId: session.user.id,
      subject,
      title,
      dueDate,
    }).returning();

    app.logger.info({ userId: session.user.id, homeworkId: created.id }, 'Homework item created');
    reply.code(201);
    return created;
  });

  app.fastify.patch('/api/homework/:id', {
    schema: {
      description: 'Update a homework item',
      tags: ['homework'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Homework item ID' },
        },
      },
      body: {
        type: 'object',
        properties: {
          completed: { type: 'boolean', description: 'Mark as completed or incomplete' },
          subject: { type: 'string', description: 'Subject of homework' },
          title: { type: 'string', description: 'Homework title' },
          dueDate: { type: 'string', format: 'date', description: 'Due date (YYYY-MM-DD)' },
        },
      },
      response: {
        200: {
          description: 'Homework item updated successfully',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            subject: { type: 'string' },
            title: { type: 'string' },
            dueDate: { type: 'string', format: 'date' },
            completed: { type: 'boolean' },
            completedAt: { type: ['string', 'null'], format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        404: {
          description: 'Homework item not found',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { completed?: boolean; subject?: string; title?: string; dueDate?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const { completed, subject, title, dueDate } = request.body;
    app.logger.info({ userId: session.user.id, homeworkId: id }, 'Updating homework item');

    const existing = await app.db.query.homeworkItems.findFirst({
      where: eq(schema.homeworkItems.id, id),
    });

    if (!existing) {
      app.logger.warn({ userId: session.user.id, homeworkId: id }, 'Homework item not found');
      return reply.status(404).send({ error: 'Homework item not found' });
    }

    if (existing.userId !== session.user.id) {
      app.logger.warn({ userId: session.user.id, homeworkId: id }, 'Ownership check failed');
      return reply.status(404).send({ error: 'Homework item not found' });
    }

    let completedAt = existing.completedAt;
    if (completed !== undefined) {
      completedAt = completed ? new Date() : null;
    }

    const [updated] = await app.db.update(schema.homeworkItems)
      .set({
        completed: completed !== undefined ? completed : existing.completed,
        completedAt,
        subject: subject !== undefined ? subject : existing.subject,
        title: title !== undefined ? title : existing.title,
        dueDate: dueDate !== undefined ? dueDate : existing.dueDate,
      })
      .where(eq(schema.homeworkItems.id, id))
      .returning();

    app.logger.info({ userId: session.user.id, homeworkId: id }, 'Homework item updated');
    return updated;
  });

  app.fastify.delete('/api/homework/:id', {
    schema: {
      description: 'Delete a homework item',
      tags: ['homework'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Homework item ID' },
        },
      },
      response: {
        200: {
          description: 'Homework item deleted successfully',
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
          description: 'Homework item not found',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    app.logger.info({ userId: session.user.id, homeworkId: id }, 'Deleting homework item');

    const existing = await app.db.query.homeworkItems.findFirst({
      where: eq(schema.homeworkItems.id, id),
    });

    if (!existing) {
      app.logger.warn({ userId: session.user.id, homeworkId: id }, 'Homework item not found');
      return reply.status(404).send({ error: 'Homework item not found' });
    }

    if (existing.userId !== session.user.id) {
      app.logger.warn({ userId: session.user.id, homeworkId: id }, 'Ownership check failed');
      return reply.status(404).send({ error: 'Homework item not found' });
    }

    await app.db.delete(schema.homeworkItems).where(eq(schema.homeworkItems.id, id));

    app.logger.info({ userId: session.user.id, homeworkId: id }, 'Homework item deleted');
    return { success: true };
  });
}
