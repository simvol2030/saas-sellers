/**
 * Settings API - Site Settings management
 *
 * Manages site-wide settings stored in SiteSetting model.
 * All routes require authentication and site context.
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite } from '../middleware/site.js';

const settings = new Hono();

// Apply auth and site middleware to all routes
settings.use('*', authMiddleware);
settings.use('*', editorOrAdmin);
settings.use('*', siteMiddleware);
settings.use('*', requireSite);

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const updateSettingSchema = z.object({
  value: z.any(), // Can be any JSON value
});

const bulkUpdateSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().min(1),
      value: z.any(),
      group: z.string().optional(),
    })
  ),
});

// ==========================================
// ROUTES
// ==========================================

// GET /api/admin/settings - Get all settings
settings.get('/', async (c) => {
  const siteId = c.get('siteId');

  try {
    const allSettings = await prisma.siteSetting.findMany({
      where: { siteId },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });

    // Transform to key-value object grouped by group
    const grouped: Record<string, Record<string, any>> = {};

    for (const setting of allSettings) {
      if (!grouped[setting.group]) {
        grouped[setting.group] = {};
      }
      try {
        grouped[setting.group][setting.key] = JSON.parse(setting.value);
      } catch {
        grouped[setting.group][setting.key] = setting.value;
      }
    }

    return c.json({ settings: grouped });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return c.json({ error: 'Failed to fetch settings' }, 500);
  }
});

// GET /api/admin/settings/:group - Get settings by group
settings.get('/:group', async (c) => {
  const siteId = c.get('siteId');

  try {
    const group = c.req.param('group');

    const groupSettings = await prisma.siteSetting.findMany({
      where: { siteId, group },
      orderBy: { key: 'asc' },
    });

    // Transform to key-value object
    const result: Record<string, any> = {};
    for (const setting of groupSettings) {
      try {
        result[setting.key] = JSON.parse(setting.value);
      } catch {
        result[setting.key] = setting.value;
      }
    }

    return c.json({ group, settings: result });
  } catch (error) {
    console.error('Error fetching settings group:', error);
    return c.json({ error: 'Failed to fetch settings' }, 500);
  }
});

// PUT /api/admin/settings/:key - Update single setting
settings.put('/:key', zValidator('json', updateSettingSchema), async (c) => {
  const siteId = c.get('siteId');

  try {
    const key = c.req.param('key');
    const { value } = c.req.valid('json');

    // Determine group from key prefix (e.g., "header.logo" -> "header")
    const group = key.includes('.') ? key.split('.')[0] : 'general';

    const setting = await prisma.siteSetting.upsert({
      where: { siteId_key: { siteId, key } },
      update: {
        value: JSON.stringify(value),
        group,
      },
      create: {
        key,
        value: JSON.stringify(value),
        group,
        siteId,
      },
    });

    return c.json({
      key: setting.key,
      value: JSON.parse(setting.value),
      group: setting.group,
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    return c.json({ error: 'Failed to update setting' }, 500);
  }
});

// POST /api/admin/settings/bulk - Bulk update settings
settings.post('/bulk', zValidator('json', bulkUpdateSchema), async (c) => {
  const siteId = c.get('siteId');

  try {
    const { settings: updates } = c.req.valid('json');

    // Use transaction for atomic updates
    const results = await prisma.$transaction(
      updates.map((update) => {
        const group = update.group || (update.key.includes('.') ? update.key.split('.')[0] : 'general');
        return prisma.siteSetting.upsert({
          where: { siteId_key: { siteId, key: update.key } },
          update: {
            value: JSON.stringify(update.value),
            group,
          },
          create: {
            key: update.key,
            value: JSON.stringify(update.value),
            group,
            siteId,
          },
        });
      })
    );

    return c.json({
      message: 'Settings updated successfully',
      count: results.length,
    });
  } catch (error) {
    console.error('Error bulk updating settings:', error);
    return c.json({ error: 'Failed to update settings' }, 500);
  }
});

// DELETE /api/admin/settings/:key - Delete a setting
settings.delete('/:key', async (c) => {
  const siteId = c.get('siteId');

  try {
    const key = c.req.param('key');

    const existing = await prisma.siteSetting.findUnique({
      where: { siteId_key: { siteId, key } },
    });

    if (!existing) {
      return c.json({ error: 'Setting not found' }, 404);
    }

    await prisma.siteSetting.delete({
      where: { siteId_key: { siteId, key } },
    });

    return c.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Error deleting setting:', error);
    return c.json({ error: 'Failed to delete setting' }, 500);
  }
});

export default settings;
