import express from 'express';
import { prisma } from '../../../lib/prisma.js';

const router = express.Router();

// GET /api/children
router.get('/', async (req, res) => {
  try {
    const children = await prisma.child.findMany({
      orderBy: {
        name: 'asc',
      },
    });
    res.json(children);
  } catch (error) {
    console.error('Error fetching children:', error);
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

export default router;
