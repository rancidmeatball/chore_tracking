import express from 'express';
import { prisma } from '../../../lib/prisma.js';

const router = express.Router();

// GET /api/tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        child: true,
        recurrenceTemplate: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
      return res.status(503).json({ error: 'Database not initialized. Please restart the add-on.' });
    }
    res.status(500).json({ error: 'Failed to fetch tasks', details: error?.message });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    const { title, description, dueDate, childId, recurrenceTemplateId, category } = req.body;

    console.log('POST /api/tasks - Creating task:', { title, dueDate, childId, category, recurrenceTemplateId });

    // Helper to normalize a \"due date\" string to a date-only UTC value at midday.
    // This keeps the calendar date stable across timezones (e.g. Pacific vs UTC).
    const normalizeDueDate = (value) => {
      const base = new Date(value);
      const year = base.getUTCFullYear();
      const month = base.getUTCMonth();
      const day = base.getUTCDate();
      return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    };

    if (recurrenceTemplateId) {
      // Don't require childId here - it might come from the template
    } else if (!title || !dueDate || !childId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (recurrenceTemplateId) {
      const template = await prisma.recurrenceTemplate.findUnique({
        where: { id: recurrenceTemplateId },
      });

      if (!template) {
        return res.status(404).json({ error: 'Recurrence template not found' });
      }

      const taskChildId = template.childId || childId;
      console.log(`Creating recurring tasks with template ${recurrenceTemplateId}, childId: ${taskChildId}, frequency: ${template.frequency}`);

      const tasks = [];
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);

      if (template.frequency === 'weekly' && template.daysOfWeek) {
        let daysOfWeek;
        try {
          daysOfWeek = JSON.parse(template.daysOfWeek);
        } catch (e) {
          console.error('Error parsing daysOfWeek:', template.daysOfWeek, e);
          return res.status(400).json({ error: 'Invalid daysOfWeek format in template' });
        }
        
        console.log(`Generating weekly tasks for days: ${daysOfWeek.join(', ')}`);
        let currentDate = new Date(startDate);
        let taskCount = 0;
        
        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay();
          if (daysOfWeek.includes(dayOfWeek)) {
            const taskDate = new Date(currentDate);
            // store as midday to avoid timezone off-by-one
            taskDate.setHours(12, 0, 0, 0);
            tasks.push({
              title,
              description: description || null,
              dueDate: taskDate,
              category: category || 'helping-family',
              childId: taskChildId,
              recurrenceTemplateId,
            });
            taskCount++;
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        console.log(`Generated ${taskCount} weekly tasks`);
      } else if (template.frequency === 'monthly' && template.dayOfMonth) {
        let currentDate = new Date(startDate);
        const today = currentDate.getDate();
        
        if (today <= template.dayOfMonth) {
          currentDate.setDate(template.dayOfMonth);
        } else {
          currentDate.setMonth(currentDate.getMonth() + 1);
          currentDate.setDate(template.dayOfMonth);
        }
        
        for (let i = 0; i < 12 && currentDate <= endDate; i++) {
          const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
          const dayToUse = Math.min(template.dayOfMonth, lastDayOfMonth);
          const taskDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayToUse, 12, 0, 0, 0);
          
          if (taskDate >= startDate && taskDate <= endDate) {
            // Keep at midday (already set above) to avoid timezone issues
            tasks.push({
              title,
              description: description || null,
              dueDate: taskDate,
              category: category || 'helping-family',
              childId: taskChildId,
              recurrenceTemplateId,
            });
          }
          
          currentDate.setMonth(currentDate.getMonth() + 1);
          currentDate.setDate(dayToUse);
        }
      } else {
        const oneTimeDate = normalizeDueDate(dueDate);
        tasks.push({
          title,
          description: description || null,
          dueDate: oneTimeDate,
          childId: taskChildId,
          recurrenceTemplateId,
        });
      }

      if (tasks.length === 0) {
        return res.status(400).json({ error: 'No tasks generated from recurrence template' });
      }

      const createdTasks = await prisma.task.createMany({
        data: tasks,
      });

      console.log(`Created ${createdTasks.count} recurring tasks from template ${recurrenceTemplateId}`);

      const createdTaskIds = await prisma.task.findMany({
        where: {
          recurrenceTemplateId,
          title,
          createdAt: {
            gte: new Date(Date.now() - 10000),
          },
        },
        include: {
          child: true,
          recurrenceTemplate: true,
        },
        orderBy: {
          dueDate: 'asc',
        },
      });

      console.log(`Returning ${createdTaskIds.length} created tasks (expected ${tasks.length})`);
      return res.status(201).json(createdTaskIds);
    } else {
      const task = await prisma.task.create({
        data: {
          title,
          description: description || null,
          dueDate: normalizeDueDate(dueDate),
          category: category || 'helping-family',
          childId,
        },
        include: {
          child: true,
          recurrenceTemplate: true,
        },
      });

      return res.status(201).json(task);
    }
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        child: true,
        recurrenceTemplate: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// PATCH /api/tasks/:id (for partial updates like completion status)
router.patch('/:id', async (req, res) => {
  try {
    const { completed, completedAt } = req.body;
    console.log(`PATCH /api/tasks/${req.params.id} - Updating completion:`, { completed, completedAt });

    const updateData = {};
    if (completed !== undefined) {
      updateData.completed = completed;
      updateData.completedAt = completed ? (completedAt ? new Date(completedAt) : new Date()) : null;
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        child: true,
        recurrenceTemplate: true,
      },
    });

    console.log(`Task ${req.params.id} updated: completed=${task.completed}`);
    res.json(task);
  } catch (error) {
    console.error('Error updating task completion:', error);
    res.status(500).json({ error: 'Failed to update task', details: error?.message });
  }
});

// PUT /api/tasks/:id (for full updates)
router.put('/:id', async (req, res) => {
  try {
    const { title, description, dueDate, childId, recurrenceTemplateId, category, completed, completedAt } = req.body;

    console.log(`PUT /api/tasks/${req.params.id} - Updating task:`, { 
      title, 
      dueDate, 
      childId, 
      category,
      hasDueDate: !!dueDate 
    });

    // Helper to normalize a "due date" string to a date-only UTC value at midday.
    const normalizeDueDate = (value) => {
      const base = new Date(value);
      const year = base.getUTCFullYear();
      const month = base.getUTCMonth();
      const day = base.getUTCDate();
      return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    };

    const updateData = {
      ...(title && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(dueDate !== undefined && dueDate !== null && { 
        dueDate: normalizeDueDate(dueDate),
      }),
      ...(childId && { childId }),
      ...(category && { category }),
      ...(recurrenceTemplateId !== undefined && {
        recurrenceTemplateId: recurrenceTemplateId || null,
      }),
      ...(completed !== undefined && { 
        completed,
        completedAt: completed ? (completedAt ? new Date(completedAt) : new Date()) : null,
      }),
    };

    console.log('Update data:', updateData);
    if (dueDate) {
      console.log(`Due date update: ${dueDate} -> ${new Date(dueDate).toISOString()}`);
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        child: true,
        recurrenceTemplate: true,
      },
    });

    console.log(`Task updated successfully. New dueDate: ${task.dueDate}, ISO: ${new Date(task.dueDate).toISOString()}`);
    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task', details: error?.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        recurrenceTemplateId: true,
        dueDate: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const deleteSeries = req.query.deleteSeries === 'true';

    if (deleteSeries && task.recurrenceTemplateId) {
      const deletedCount = await prisma.task.deleteMany({
        where: {
          recurrenceTemplateId: task.recurrenceTemplateId,
          dueDate: {
            gte: task.dueDate,
          },
        },
      });

      console.log(`Deleted ${deletedCount.count} tasks from recurring series`);
      return res.json({ 
        message: `Deleted ${deletedCount.count} task(s) from recurring series`,
        deletedCount: deletedCount.count,
      });
    } else {
      const deletedTask = await prisma.task.delete({
        where: { id: req.params.id },
      });

      console.log(`[DELETE] Successfully deleted task ${req.params.id}: ${deletedTask.title}`);
      return res.json({ message: 'Task deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST /api/tasks/:id/complete
router.post('/:id/complete', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        child: true,
        recurrenceTemplate: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { completed } = req.body;
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const timeDifference = now.getTime() - dueDate.getTime();
    const hoursDifference = Math.round(timeDifference / (1000 * 60 * 60));
    const isOnTime = timeDifference <= 0;
    const isLate = timeDifference > 0;

    const updatedTask = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        completed: completed === true,
        completedAt: completed === true ? now : null,
      },
      include: {
        child: true,
        recurrenceTemplate: true,
      },
    });

    if (completed) {
      console.log('='.repeat(60));
      console.log('TASK COMPLETION TRACKED');
      console.log('='.repeat(60));
      console.log(`Task ID: ${task.id}`);
      console.log(`Task Title: ${task.title}`);
      console.log(`Child: ${task.child.name}`);
      console.log(`Due Date: ${dueDate.toLocaleString()}`);
      console.log(`Completed At: ${now.toLocaleString()}`);
      console.log(`Status: ${isOnTime ? '✅ ON TIME' : `⚠️ LATE by ${hoursDifference} hours`}`);
      if (task.recurrenceTemplate) {
        console.log(`Recurring: Yes (${task.recurrenceTemplate.frequency})`);
      }
      console.log('='.repeat(60));
    } else {
      console.log(`Task "${task.title}" marked as incomplete`);
    }

    res.json({
      ...updatedTask,
      completionDetails: completed ? {
        completedAt: now.toISOString(),
        isOnTime,
        isLate,
        hoursDifference: isLate ? hoursDifference : 0,
        dueDate: dueDate.toISOString(),
      } : null,
    });
  } catch (error) {
    console.error('Error tracking task completion:', error);
    res.status(500).json({ error: 'Failed to track task completion' });
  }
});

// GET /api/tasks/completions
router.get('/completions', async (req, res) => {
  try {
    const { subDays } = await import('date-fns');
    const days = parseInt(req.query.days || '30');
    const childId = req.query.childId;
    const startDate = subDays(new Date(), days);

    const where = {
      completed: true,
      completedAt: {
        gte: startDate,
      },
      ...(childId && { childId }),
    };

    const completedTasks = await prisma.task.findMany({
      where,
      include: {
        child: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    const totalCompleted = completedTasks.length;
    const onTimeCount = completedTasks.filter(task => {
      if (!task.completedAt) return false;
      return new Date(task.completedAt) <= new Date(task.dueDate);
    }).length;
    const lateCount = totalCompleted - onTimeCount;

    const byChild = completedTasks.reduce((acc, task) => {
      const childName = task.child.name;
      if (!acc[childName]) {
        acc[childName] = {
          childId: task.child.id,
          childName,
          childColor: task.child.color,
          count: 0,
          onTime: 0,
          late: 0,
        };
      }
      acc[childName].count++;
      if (task.completedAt && new Date(task.completedAt) <= new Date(task.dueDate)) {
        acc[childName].onTime++;
      } else {
        acc[childName].late++;
      }
      return acc;
    }, {});

    const byDate = completedTasks.reduce((acc, task) => {
      if (!task.completedAt) return acc;
      const dateKey = new Date(task.completedAt).toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push({
        id: task.id,
        title: task.title,
        childName: task.child.name,
        completedAt: task.completedAt,
        dueDate: task.dueDate,
        isOnTime: new Date(task.completedAt) <= new Date(task.dueDate),
      });
      return acc;
    }, {});

    res.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        days,
      },
      statistics: {
        totalCompleted,
        onTimeCount,
        lateCount,
        onTimePercentage: totalCompleted > 0 ? Math.round((onTimeCount / totalCompleted) * 100) : 0,
      },
      byChild: Object.values(byChild),
      byDate,
      recentCompletions: completedTasks.slice(0, 20),
    });
  } catch (error) {
    console.error('Error fetching completion statistics:', error);
    res.status(500).json({ error: 'Failed to fetch completion statistics' });
  }
});

// Helper to normalize an incoming date (which may be an ISO string)
// to a date-only value in UTC at midday (12:00 UTC) so we can safely use startOfDay/endOfDay
// without Pacific vs UTC causing off-by-one issues.
// This matches how tasks are stored (midday UTC).
function getUtcDateOnly(dateString) {
  const base = new Date(dateString);
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const day = base.getUTCDate();
  // Return midday UTC to match task storage format
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

// POST /api/tasks/award-tech-time
router.post('/award-tech-time', async (req, res) => {
  try {
    const { startOfDay, endOfDay } = await import('date-fns');
    const { childId, date } = req.body;

    if (!childId) {
      return res.status(400).json({ error: 'childId is required' });
    }

    const checkDate = date ? getUtcDateOnly(date) : getUtcDateOnly(new Date().toISOString());
    const start = startOfDay(checkDate);
    const end = endOfDay(checkDate);

    const tasks = await prisma.task.findMany({
      where: {
        childId,
        dueDate: {
          gte: start,
          lte: end,
        },
      },
    });

    const helpingFamilyTasks = tasks.filter(t => t.category === 'helping-family');
    const enrichmentTasks = tasks.filter(t => t.category === 'enrichment');

    const hasBothCategories = helpingFamilyTasks.length > 0 && enrichmentTasks.length > 0;
    const bothComplete = 
      hasBothCategories &&
      helpingFamilyTasks.every(t => t.completed) &&
      enrichmentTasks.every(t => t.completed);

    if (!bothComplete) {
      return res.status(400).json({ 
        error: 'Both categories must be completed to award tech time',
        helpingFamily: {
          total: helpingFamilyTasks.length,
          completed: helpingFamilyTasks.filter(t => t.completed).length,
        },
        enrichment: {
          total: enrichmentTasks.length,
          completed: enrichmentTasks.filter(t => t.completed).length,
        },
      });
    }

    const existingAward = await prisma.techTimeAward.findUnique({
      where: {
        childId_awardDate: {
          childId,
          awardDate: start,
        },
      },
    });

    if (existingAward) {
      return res.status(400).json({ 
        error: 'Tech time already awarded for this date',
        message: `Tech time was already awarded on ${checkDate.toLocaleDateString()}`,
        existingAward: {
          id: existingAward.id,
          awardDate: existingAward.awardDate,
          minutes: existingAward.minutes,
        },
      });
    }

    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { timeBalance: true, name: true },
    });

    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    const newBalance = (child.timeBalance || 0) + 60;

    await prisma.$transaction([
      prisma.child.update({
        where: { id: childId },
        data: {
          timeBalance: newBalance,
        },
      }),
      prisma.techTimeAward.create({
        data: {
          childId,
          awardDate: start,
          minutes: 60,
        },
      }),
    ]);

    console.log(`[TECH TIME] ✅ Awarded 1 hour (60 min) to ${child.name} for completing both categories on ${checkDate.toLocaleDateString()}`);
    console.log(`[TECH TIME] New balance: ${newBalance} minutes (${Math.round(newBalance / 60 * 10) / 10} hours)`);

    res.json({
      success: true,
      message: `Awarded 1 hour of tech time to ${child.name}`,
      newBalance,
      previousBalance: child.timeBalance || 0,
      date: checkDate.toISOString(),
    });
  } catch (error) {
    console.error('Error awarding tech time:', error);
    res.status(500).json({ error: 'Failed to award tech time' });
  }
});

// POST /api/tasks/revoke-tech-time
// Used when a task is un-completed after tech time was already awarded.
// This subtracts the award and removes the TechTimeAward record for that day.
router.post('/revoke-tech-time', async (req, res) => {
  try {
    const { startOfDay, endOfDay } = await import('date-fns');
    const { childId, date } = req.body;

    if (!childId) {
      return res.status(400).json({ error: 'childId is required' });
    }

    const checkDate = date ? getUtcDateOnly(date) : new Date();
    const start = startOfDay(checkDate);
    const end = endOfDay(checkDate);

    const existingAward = await prisma.techTimeAward.findUnique({
      where: {
        childId_awardDate: {
          childId,
          awardDate: start,
        },
      },
    });

    if (!existingAward) {
      return res.status(400).json({
        error: 'No tech time award found for this date',
      });
    }

    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { timeBalance: true, name: true },
    });

    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    const previousBalance = child.timeBalance || 0;
    const newBalance = Math.max(0, previousBalance - (existingAward.minutes || 60));

    await prisma.$transaction([
      prisma.child.update({
        where: { id: childId },
        data: {
          timeBalance: newBalance,
        },
      }),
      prisma.techTimeAward.delete({
        where: { id: existingAward.id },
      }),
    ]);

    console.log(`[TECH TIME] ❌ Revoked ${existingAward.minutes || 60} minutes from ${child.name} for ${checkDate.toLocaleDateString()}`);
    console.log(`[TECH TIME] New balance: ${newBalance} minutes (${Math.round(newBalance / 60 * 10) / 10} hours)`);

    res.json({
      success: true,
      message: `Revoked ${existingAward.minutes || 60} minutes of tech time from ${child.name}`,
      newBalance,
      previousBalance,
      date: checkDate.toISOString(),
    });
  } catch (error) {
    console.error('Error revoking tech time:', error);
    res.status(500).json({ error: 'Failed to revoke tech time' });
  }
});

// GET /api/tasks/check-daily-completion
router.get('/check-daily-completion', async (req, res) => {
  try {
    const { startOfDay, endOfDay } = await import('date-fns');
    const dateParam = req.query.date;

    // If a date is provided, normalize it. If not, use "today" but strip time
    // so we consistently check a single calendar day.
    let checkDate;
    if (dateParam) {
      // Frontend sent a date - normalize it to UTC midday
      checkDate = getUtcDateOnly(dateParam);
    } else {
      // No date param (old frontend code) - use today at UTC midday
      const now = new Date();
      checkDate = getUtcDateOnly(now.toISOString());
      console.log(`[CHECK-DAILY] WARNING: No date parameter provided, using today: ${checkDate.toISOString()}`);
    }

    console.log(`[CHECK-DAILY] Checking completion for date: ${checkDate.toISOString()}, param: ${dateParam || 'none (using today)'}`);

    const start = startOfDay(checkDate);
    const end = endOfDay(checkDate);
    
    console.log(`[CHECK-DAILY] Date range: ${start.toISOString()} to ${end.toISOString()}`);

    const tasks = await prisma.task.findMany({
      where: {
        dueDate: {
          gte: start,
          lte: end,
        },
      },
      include: {
        child: {
          select: {
            id: true,
            name: true,
            timeBalance: true,
            inputBoolean: true,
          },
        },
      },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.completed).length;
    const allComplete = totalTasks > 0 && completedTasks === totalTasks;
    
    console.log(`[CHECK-DAILY] Found ${totalTasks} tasks, ${completedTasks} completed`);
    
    // Log task details for debugging
    if (tasks.length > 0) {
      console.log(`[CHECK-DAILY] Task details:`);
      tasks.forEach(t => {
        console.log(`  - ${t.id}: ${t.title} (${t.category}), child: ${t.child.name}, completed: ${t.completed}, dueDate: ${t.dueDate.toISOString()}`);
      });
    } else {
      console.log(`[CHECK-DAILY] WARNING: No tasks found for date range ${start.toISOString()} to ${end.toISOString()}`);
    }

    const techTimeRewards = [];
    const tasksByChild = tasks.reduce((acc, task) => {
      if (!acc[task.childId]) {
        acc[task.childId] = {
          childId: task.childId,
          childName: task.child.name,
          helpingFamily: { total: 0, completed: 0 },
          enrichment: { total: 0, completed: 0 },
        };
      }
      const childTasks = acc[task.childId];
      if (task.category === 'helping-family') {
        childTasks.helpingFamily.total++;
        if (task.completed) childTasks.helpingFamily.completed++;
      } else if (task.category === 'enrichment') {
        childTasks.enrichment.total++;
        if (task.completed) childTasks.enrichment.completed++;
      }
      return acc;
    }, {});
    
    console.log(`[CHECK-DAILY] Tasks by child breakdown:`, JSON.stringify(tasksByChild, null, 2));

    for (const childData of Object.values(tasksByChild)) {
      const hasHelpingFamily = childData.helpingFamily.total > 0;
      const hasEnrichment = childData.enrichment.total > 0;
      const bothComplete = 
        hasHelpingFamily && 
        hasEnrichment && 
        childData.helpingFamily.completed === childData.helpingFamily.total &&
        childData.enrichment.completed === childData.enrichment.total;

      console.log(`[CHECK-DAILY] Child ${childData.childName}: hasHelpingFamily=${hasHelpingFamily} (${childData.helpingFamily.completed}/${childData.helpingFamily.total}), hasEnrichment=${hasEnrichment} (${childData.enrichment.completed}/${childData.enrichment.total}), bothComplete=${bothComplete}`);

      if (bothComplete) {
        console.log(`[CHECK-DAILY] ✅ Child ${childData.childName} has both categories complete!`);
        // Check if tech time was already awarded for this date
        const existingAward = await prisma.techTimeAward.findUnique({
          where: {
            childId_awardDate: {
              childId: childData.childId,
              awardDate: start,
            },
          },
        });

        console.log(`[CHECK-DAILY] Tech time award exists: ${!!existingAward} for ${childData.childName} (awardDate: ${start.toISOString()})`);

        techTimeRewards.push({
          childId: childData.childId,
          childName: childData.childName,
          awarded: !!existingAward,
        });
      } else {
        console.log(`[CHECK-DAILY] ❌ Child ${childData.childName} does NOT have both categories complete`);
      }
    }

    const childCompletions = [];
    for (const childData of Object.values(tasksByChild)) {
      const childTasks = tasks.filter(t => t.childId === childData.childId);
      const childTotal = childTasks.length;
      const childCompleted = childTasks.filter(t => t.completed).length;
      const childAllComplete = childTotal > 0 && childCompleted === childTotal;
      const childInputBoolean = childTasks.length > 0 ? childTasks[0].child.inputBoolean : null;
      
      childCompletions.push({
        childId: childData.childId,
        childName: childData.childName,
        inputBoolean: childInputBoolean,
        allComplete: childAllComplete,
      });
    }

    res.json({
      date: checkDate.toISOString(),
      totalTasks,
      completedTasks,
      allComplete,
      techTimeRewards,
      childCompletions,
      categoryBreakdown: Object.values(tasksByChild).map(child => ({
        childId: child.childId,
        childName: child.childName,
        helpingFamily: child.helpingFamily,
        enrichment: child.enrichment,
        bothComplete: 
          child.helpingFamily.total > 0 && 
          child.enrichment.total > 0 && 
          child.helpingFamily.completed === child.helpingFamily.total &&
          child.enrichment.completed === child.enrichment.total,
      })),
    });
  } catch (error) {
    console.error('Error checking daily completion:', error);
    res.status(500).json({ error: 'Failed to check daily completion' });
  }
});

export default router;
