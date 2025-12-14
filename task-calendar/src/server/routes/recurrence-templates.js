import express from 'express';
import { prisma } from '../../lib/prisma.js';

const router = express.Router();

// GET /api/recurrence-templates
router.get('/', async (req, res) => {
  try {
    const templates = await prisma.recurrenceTemplate.findMany({
      include: {
        child: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
    const parsedTemplates = templates.map(template => ({
      ...template,
      daysOfWeek: template.daysOfWeek ? JSON.parse(template.daysOfWeek) : null,
    }));
    res.json(parsedTemplates);
  } catch (error) {
    console.error('Error fetching recurrence templates:', error);
    res.status(500).json({ error: 'Failed to fetch recurrence templates' });
  }
});

// POST /api/recurrence-templates
router.post('/', async (req, res) => {
  try {
    const { name, description, frequency, daysOfWeek, dayOfMonth, dueDate, childId } = req.body;

    if (!name || !frequency || !childId) {
      return res.status(400).json({ error: 'Name, frequency, and child are required' });
    }

    if (frequency === 'weekly' && (!daysOfWeek || daysOfWeek.length === 0)) {
      return res.status(400).json({ error: 'At least one day of week is required for weekly frequency' });
    }

    if (frequency === 'monthly' && (dayOfMonth === undefined || dayOfMonth < 1 || dayOfMonth > 31)) {
      return res.status(400).json({ error: 'dayOfMonth is required for monthly frequency (must be 1-31)' });
    }

    if (frequency === 'one-time' && !dueDate) {
      return res.status(400).json({ error: 'dueDate is required for one-time frequency' });
    }

    const template = await prisma.recurrenceTemplate.create({
      data: {
        name,
        description: description || null,
        frequency,
        daysOfWeek: frequency === 'weekly' ? JSON.stringify(daysOfWeek) : null,
        dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
        dueDate: frequency === 'one-time' && dueDate ? new Date(dueDate) : null,
        childId: childId || null,
      },
      include: {
        child: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const response = {
      ...template,
      daysOfWeek: template.daysOfWeek ? JSON.parse(template.daysOfWeek) : null,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating recurrence template:', error);
    const errorMessage = error?.message || 'Failed to create recurrence template';
    res.status(500).json({ error: errorMessage, details: error?.code || 'UNKNOWN_ERROR' });
  }
});

// GET /api/recurrence-templates/:id
router.get('/:id', async (req, res) => {
  try {
    const template = await prisma.recurrenceTemplate.findUnique({
      where: { id: req.params.id },
      include: {
        child: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const response = {
      ...template,
      daysOfWeek: template.daysOfWeek ? JSON.parse(template.daysOfWeek) : null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// PUT /api/recurrence-templates/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, description, frequency, daysOfWeek, dayOfMonth, dueDate, childId } = req.body;

    const template = await prisma.recurrenceTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(frequency && { frequency }),
        ...(daysOfWeek !== undefined && {
          daysOfWeek: frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0 
            ? JSON.stringify(daysOfWeek) 
            : null,
        }),
        ...(dayOfMonth !== undefined && {
          dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
        }),
        ...(dueDate !== undefined && {
          dueDate: frequency === 'one-time' && dueDate ? new Date(dueDate) : null,
        }),
        ...(childId !== undefined && { childId: childId || null }),
      },
      include: {
        child: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const response = {
      ...template,
      daysOfWeek: template.daysOfWeek ? JSON.parse(template.daysOfWeek) : null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating template:', error);
    const errorMessage = error?.message || 'Failed to update template';
    res.status(500).json({ error: errorMessage, details: error?.code || 'UNKNOWN_ERROR' });
  }
});

// DELETE /api/recurrence-templates/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.recurrenceTemplate.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
