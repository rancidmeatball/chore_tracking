import express from 'express';
import { prisma } from '../../../lib/prisma.js';

const router = express.Router();

// GET /api/children
router.get('/', async (req, res) => {
  try {
    console.log('GET /api/children - Fetching children from database...');
    const children = await prisma.child.findMany({
      orderBy: {
        name: 'asc',
      },
    });
    console.log(`GET /api/children - Found ${children.length} children`);
    res.json(children);
  } catch (error) {
    console.error('Error fetching children:', error);
    console.error('Error stack:', error?.stack);
    if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
      return res.status(503).json({ error: 'Database not initialized. Please restart the add-on.' });
    }
    res.status(500).json({ error: 'Failed to fetch children', details: error?.message });
  }
});

// POST /api/children
router.post('/', async (req, res) => {
  try {
    const { name, color, inputBoolean } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const child = await prisma.child.create({
      data: { 
        name,
        color: color || null,
        inputBoolean: inputBoolean || null,
      },
    });

    res.status(201).json(child);
  } catch (error) {
    console.error('Error creating child:', error);
    res.status(500).json({ error: 'Failed to create child' });
  }
});

// GET /api/children/:id
router.get('/:id', async (req, res) => {
  try {
    const child = await prisma.child.findUnique({
      where: { id: req.params.id },
    });

    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    res.json(child);
  } catch (error) {
    console.error('Error fetching child:', error);
    res.status(500).json({ error: 'Failed to fetch child' });
  }
});

// PUT /api/children/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, color, inputBoolean } = req.body;

    const child = await prisma.child.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(color !== undefined && { color: color || null }),
        ...(inputBoolean !== undefined && { inputBoolean: inputBoolean || null }),
      },
    });

    res.json(child);
  } catch (error) {
    console.error('Error updating child:', error);
    res.status(500).json({ error: 'Failed to update child' });
  }
});

// DELETE /api/children/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.child.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Child deleted successfully' });
  } catch (error) {
    console.error('Error deleting child:', error);
    res.status(500).json({ error: 'Failed to delete child' });
  }
});

// PUT /api/children/:id/time
router.put('/:id/time', async (req, res) => {
  try {
    const { minutes } = req.body;

    if (typeof minutes !== 'number') {
      return res.status(400).json({ error: 'Minutes must be a number' });
    }

    const child = await prisma.child.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        timeBalance: true,
      },
    });

    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    const currentBalance = child.timeBalance ?? 0;
    const newBalance = currentBalance + minutes;

    const updatedChild = await prisma.child.update({
      where: { id: req.params.id },
      data: {
        timeBalance: newBalance,
      },
    });

    res.json(updatedChild);
  } catch (error) {
    console.error('Error updating child time:', error);
    res.status(500).json({ error: 'Failed to update child time' });
  }
});

// GET /api/children/:id/time-claims
router.get('/:id/time-claims', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 40, 100);

    const child = await prisma.child.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    const claims = await prisma.timeClaim.findMany({
      where: { childId: id },
      orderBy: { createdAt: 'desc' },
      take: Number.isFinite(limit) && limit > 0 ? limit : 40,
    });

    res.json(claims);
  } catch (error) {
    console.error('Error fetching time claims:', error);
    res.status(500).json({ error: 'Failed to fetch time claims' });
  }
});

// POST /api/children/:id/time-claims — log tech time used and deduct from balance
router.post('/:id/time-claims', async (req, res) => {
  try {
    const { id } = req.params;
    const { minutes, note } = req.body;

    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
      return res.status(400).json({ error: 'Minutes must be a positive number' });
    }
    if (!Number.isInteger(minutes)) {
      return res.status(400).json({ error: 'Minutes must be a whole number' });
    }
    if (note !== undefined && note !== null && typeof note !== 'string') {
      return res.status(400).json({ error: 'Note must be a string' });
    }
    const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 500) : null;
    const noteValue = trimmedNote && trimmedNote.length > 0 ? trimmedNote : null;

    const result = await prisma.$transaction(async (tx) => {
      const child = await tx.child.findUnique({
        where: { id },
        select: { id: true, timeBalance: true },
      });
      if (!child) {
        throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      }

      const currentBalance = child.timeBalance ?? 0;
      const newBalance = currentBalance - minutes;

      const claim = await tx.timeClaim.create({
        data: {
          childId: id,
          minutes,
          note: noteValue,
        },
      });

      const updatedChild = await tx.child.update({
        where: { id },
        data: { timeBalance: newBalance },
      });

      return { claim, child: updatedChild };
    });

    res.status(201).json(result);
  } catch (error) {
    if (error?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Child not found' });
    }
    console.error('Error recording time claim:', error);
    res.status(500).json({ error: 'Failed to record time claim' });
  }
});

export default router;
