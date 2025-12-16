import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db';

const users = new Hono();

// Validation schema
const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().optional()
});

// GET /api/users - Get all users
users.get('/', async (c) => {
  try {
    const allUsers = await prisma.user.findMany();
    return c.json(allUsers);
  } catch (error) {
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// GET /api/users/:id - Get user by ID
users.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    if (isNaN(id)) {
      return c.json({ error: 'Invalid user ID' }, 400);
    }

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(user);
  } catch (error) {
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// POST /api/users - Create a new user
users.post('/', zValidator('json', createUserSchema), async (c) => {
  try {
    const validated = c.req.valid('json');

    const user = await prisma.user.create({
      data: {
        email: validated.email,
        name: validated.name
      }
    });

    return c.json(user, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

export default users;
