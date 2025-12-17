/**
 * Theme API - Theme Customization management
 *
 * Manages CSS variable overrides stored in ThemeOverride model.
 * All routes require authentication.
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { authMiddleware } from '../middleware/auth';

const theme = new Hono();

// Apply auth middleware to all routes
theme.use('*', authMiddleware);

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const createOverrideSchema = z.object({
  name: z.string().min(1), // e.g., "colors.light.primary"
  value: z.string().min(1), // CSS value
  isActive: z.boolean().default(true),
});

const updateOverrideSchema = createOverrideSchema.partial();

const bulkOverridesSchema = z.object({
  overrides: z.array(
    z.object({
      name: z.string().min(1),
      value: z.string().min(1),
      isActive: z.boolean().optional(),
    })
  ),
});

// ==========================================
// ROUTES
// ==========================================

// GET /api/admin/theme - Get all theme overrides
theme.get('/', async (c) => {
  try {
    const overrides = await prisma.themeOverride.findMany({
      orderBy: { name: 'asc' },
    });

    // Group by prefix (e.g., "colors.light.primary" -> "colors.light")
    const grouped: Record<string, Record<string, string>> = {};
    const flat: Record<string, string> = {};

    for (const override of overrides) {
      if (override.isActive) {
        flat[override.name] = override.value;

        // Also group for UI
        const parts = override.name.split('.');
        if (parts.length >= 2) {
          const groupKey = parts.slice(0, -1).join('.');
          const varName = parts[parts.length - 1];
          if (!grouped[groupKey]) {
            grouped[groupKey] = {};
          }
          grouped[groupKey][varName] = override.value;
        }
      }
    }

    return c.json({
      overrides: flat, // Flat key-value for CSS generation
      grouped, // Grouped for UI
      all: overrides, // Full records for admin
    });
  } catch (error) {
    console.error('Error fetching theme overrides:', error);
    return c.json({ error: 'Failed to fetch theme overrides' }, 500);
  }
});

// GET /api/admin/theme/css - Get CSS variables string
theme.get('/css', async (c) => {
  try {
    const overrides = await prisma.themeOverride.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    // Generate CSS variables
    const lightVars: string[] = [];
    const darkVars: string[] = [];

    for (const override of overrides) {
      const cssVarName = override.name.replace(/\./g, '-');
      const cssLine = `--${cssVarName}: ${override.value};`;

      if (override.name.startsWith('colors.dark.') || override.name.startsWith('dark.')) {
        darkVars.push(cssLine);
      } else {
        lightVars.push(cssLine);
      }
    }

    const css = `
:root {
  ${lightVars.join('\n  ')}
}

[data-theme="dark"] {
  ${darkVars.join('\n  ')}
}
`.trim();

    c.header('Content-Type', 'text/css');
    return c.text(css);
  } catch (error) {
    console.error('Error generating theme CSS:', error);
    return c.json({ error: 'Failed to generate theme CSS' }, 500);
  }
});

// POST /api/admin/theme - Create new override
theme.post('/', zValidator('json', createOverrideSchema), async (c) => {
  try {
    const data = c.req.valid('json');

    const override = await prisma.themeOverride.create({
      data,
    });

    return c.json(override, 201);
  } catch (error: any) {
    console.error('Error creating theme override:', error);
    if (error.code === 'P2002') {
      return c.json({ error: 'Override with this name already exists' }, 400);
    }
    return c.json({ error: 'Failed to create theme override' }, 500);
  }
});

// PUT /api/admin/theme/:id - Update override
theme.put('/:id', zValidator('json', updateOverrideSchema), async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');

    if (isNaN(id)) {
      return c.json({ error: 'Invalid override ID' }, 400);
    }

    const existing = await prisma.themeOverride.findUnique({
      where: { id },
    });

    if (!existing) {
      return c.json({ error: 'Override not found' }, 404);
    }

    const override = await prisma.themeOverride.update({
      where: { id },
      data,
    });

    return c.json(override);
  } catch (error) {
    console.error('Error updating theme override:', error);
    return c.json({ error: 'Failed to update theme override' }, 500);
  }
});

// POST /api/admin/theme/bulk - Bulk upsert overrides
theme.post('/bulk', zValidator('json', bulkOverridesSchema), async (c) => {
  try {
    const { overrides } = c.req.valid('json');

    // Use transaction for atomic updates
    const results = await prisma.$transaction(
      overrides.map((override) =>
        prisma.themeOverride.upsert({
          where: { name: override.name },
          update: {
            value: override.value,
            isActive: override.isActive ?? true,
          },
          create: {
            name: override.name,
            value: override.value,
            isActive: override.isActive ?? true,
          },
        })
      )
    );

    return c.json({
      message: 'Theme overrides updated successfully',
      count: results.length,
    });
  } catch (error) {
    console.error('Error bulk updating theme overrides:', error);
    return c.json({ error: 'Failed to update theme overrides' }, 500);
  }
});

// DELETE /api/admin/theme/:id - Delete override
theme.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    if (isNaN(id)) {
      return c.json({ error: 'Invalid override ID' }, 400);
    }

    const existing = await prisma.themeOverride.findUnique({
      where: { id },
    });

    if (!existing) {
      return c.json({ error: 'Override not found' }, 404);
    }

    await prisma.themeOverride.delete({
      where: { id },
    });

    return c.json({ message: 'Override deleted successfully' });
  } catch (error) {
    console.error('Error deleting theme override:', error);
    return c.json({ error: 'Failed to delete theme override' }, 500);
  }
});

// POST /api/admin/theme/reset - Reset all overrides
theme.post('/reset', async (c) => {
  try {
    await prisma.themeOverride.deleteMany({});

    return c.json({ message: 'All theme overrides have been reset' });
  } catch (error) {
    console.error('Error resetting theme overrides:', error);
    return c.json({ error: 'Failed to reset theme overrides' }, 500);
  }
});

export default theme;
