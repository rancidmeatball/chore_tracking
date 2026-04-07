import express from 'express';
import { prisma } from '../../../lib/prisma.js';

const router = express.Router();

/** Minutes granted per category per day (helping + enrichment can each earn separately). */
const HALF_AWARD_MINUTES = 30;
const AWARD_CATEGORY_HELPING = 'helping-family';
const AWARD_CATEGORY_ENRICHMENT = 'enrichment';
const AWARD_CATEGORY_LEGACY = 'legacy';

async function findTechAward(childId, awardDateStart, awardCategory) {
  return prisma.techTimeAward.findUnique({
    where: {
      childId_awardDate_awardCategory: {
        childId,
        awardDate: awardDateStart,
        awardCategory,
      },
    },
  });
}

/** Remove awards that no longer match completed work (split categories + legacy combined rows). */
async function revokeIneligibleAwardsForChild(childData, start, end) {
  const childId = childData.childId;
  const hasH = childData.helpingFamily.total > 0;
  const hasE = childData.enrichment.total > 0;
  const helpingEligible = hasH && childData.helpingFamily.completed > 0;
  const enrichmentEligible = hasE && childData.enrichment.completed > 0;
  const bothComplete =
    hasH && hasE && helpingEligible && enrichmentEligible;

  const awards = await prisma.techTimeAward.findMany({
    where: {
      childId,
      awardDate: { gte: start, lte: end },
    },
  });

  for (const award of awards) {
    let shouldRevoke = false;
    if (award.awardCategory === AWARD_CATEGORY_LEGACY) {
      shouldRevoke = !bothComplete;
    } else if (award.awardCategory === AWARD_CATEGORY_HELPING) {
      shouldRevoke = !helpingEligible;
    } else if (award.awardCategory === AWARD_CATEGORY_ENRICHMENT) {
      shouldRevoke = !enrichmentEligible;
    }

    if (!shouldRevoke) continue;

    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { timeBalance: true, name: true },
    });
    if (!child) continue;

    const previousBalance = child.timeBalance || 0;
    const mins = award.minutes || HALF_AWARD_MINUTES;
    const newBalance = Math.max(0, previousBalance - mins);

    await prisma.$transaction([
      prisma.child.update({
        where: { id: childId },
        data: { timeBalance: newBalance },
      }),
      prisma.techTimeAward.delete({
        where: { id: award.id },
      }),
    ]);

    console.log(
      `[AWARD-SYNC] Revoked ${mins} min (${award.awardCategory}) from ${child.name}. Balance ${previousBalance} → ${newBalance}`,
    );
  }
}

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
      // Normalize the due date to midday UTC to avoid timezone issues
      const normalizedDueDate = normalizeDueDate(dueDate);
      console.log(`[POST /api/tasks] Normalizing dueDate: ${dueDate} -> ${normalizedDueDate.toISOString()}`);
      
      const task = await prisma.task.create({
        data: {
          title,
          description: description || null,
          dueDate: normalizedDueDate,
          category: category || 'helping-family',
          childId,
        },
        include: {
          child: true,
          recurrenceTemplate: true,
        },
      });

      console.log(`[POST /api/tasks] Created task ${task.id} with dueDate: ${task.dueDate.toISOString()}`);
      return res.status(201).json(task);
    }
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// IMPORTANT: Specific routes must come BEFORE parameterized routes like /:id
// Otherwise /check-daily-completion gets matched by /:id

// GET /api/tasks/check-daily-completion
router.get('/check-daily-completion', async (req, res) => {
  try {
    console.log(`[CHECK-DAILY] ===== ENTRY POINT =====`);
    console.log(`[CHECK-DAILY] Request received at ${new Date().toISOString()}`);
    console.log(`[CHECK-DAILY] Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
    console.log(`[CHECK-DAILY] Request URL: ${req.url}`);
    console.log(`[CHECK-DAILY] Original URL: ${req.originalUrl}`);
    console.log(`[CHECK-DAILY] Query string from URL: ${req.url.split('?')[1] || 'NONE'}`);
    console.log(`[CHECK-DAILY] Query params object:`, req.query);
    console.log(`[CHECK-DAILY] Raw date param:`, req.query.date);
    console.log(`[CHECK-DAILY] All query keys:`, Object.keys(req.query));
    
    const { startOfDay, endOfDay } = await import('date-fns');
    const dateParam = req.query.date;

    // If a date is provided, normalize it. If not, try to infer from recent tasks
    let checkDate;
    if (dateParam && dateParam !== 'undefined' && dateParam !== 'null' && dateParam !== '') {
      // Frontend sent a date - normalize it to UTC midday
      console.log(`[CHECK-DAILY] Date parameter provided: ${dateParam}`);
      checkDate = getUtcDateOnly(dateParam);
      console.log(`[CHECK-DAILY] Normalized to: ${checkDate.toISOString()}`);
    } else {
      // No date param - try to find the most recent task update to infer the date
      console.log(`[CHECK-DAILY] ⚠️ WARNING: No date parameter provided`);
      console.log(`[CHECK-DAILY] Attempting to infer date from most recently updated task...`);
      
      const recentTask = await prisma.task.findFirst({
        where: {
          completed: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 1,
      });
      
      if (recentTask) {
        const taskDate = new Date(recentTask.dueDate);
        checkDate = getUtcDateOnly(taskDate.toISOString());
        console.log(`[CHECK-DAILY] Using date from most recent task: ${checkDate.toISOString()} (task: ${recentTask.title})`);
      } else {
        // Fallback to today
        const now = new Date();
        checkDate = getUtcDateOnly(now.toISOString());
        console.log(`[CHECK-DAILY] No recent tasks found, using today: ${checkDate.toISOString()}`);
      }
    }

    console.log(`[CHECK-DAILY] Checking completion for date: ${checkDate.toISOString()}, param: ${dateParam || 'none (using today)'}`);

    const start = startOfDay(checkDate);
    const end = endOfDay(checkDate);
    
    console.log(`[CHECK-DAILY] Date range: ${start.toISOString()} to ${end.toISOString()}`);
    console.log(`[CHECK-DAILY] Searching for tasks with dueDate between ${start.toISOString()} and ${end.toISOString()}`);

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
      const helpingEligible =
        hasHelpingFamily && childData.helpingFamily.completed > 0;
      const enrichmentEligible =
        hasEnrichment && childData.enrichment.completed > 0;
      const bothComplete =
        hasHelpingFamily &&
        hasEnrichment &&
        helpingEligible &&
        enrichmentEligible;

      const legacyAward = await findTechAward(
        childData.childId,
        start,
        AWARD_CATEGORY_LEGACY,
      );
      const helpAward = await findTechAward(
        childData.childId,
        start,
        AWARD_CATEGORY_HELPING,
      );
      const enrichAward = await findTechAward(
        childData.childId,
        start,
        AWARD_CATEGORY_ENRICHMENT,
      );

      const needHelp =
        helpingEligible && !helpAward && !legacyAward;
      const needEnrich =
        enrichmentEligible && !enrichAward && !legacyAward;
      const hasPendingAward = needHelp || needEnrich;

      console.log(
        `[CHECK-DAILY] Child ${childData.childName}: helping ${childData.helpingFamily.completed}/${childData.helpingFamily.total} (eligible=${helpingEligible}), enrichment ${childData.enrichment.completed}/${childData.enrichment.total} (eligible=${enrichmentEligible}), bothComplete=${bothComplete}, pendingAward=${hasPendingAward}`,
      );

      if (hasPendingAward) {
        const rewardDate = checkDate.toISOString();
        techTimeRewards.push({
          childId: childData.childId,
          childName: childData.childName,
          awarded: false,
          date: rewardDate,
        });
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

    const responseData = {
      date: checkDate.toISOString(),
      totalTasks,
      completedTasks,
      allComplete,
      techTimeRewards,
      childCompletions,
      categoryBreakdown: Object.values(tasksByChild).map((child) => ({
        childId: child.childId,
        childName: child.childName,
        helpingFamily: child.helpingFamily,
        enrichment: child.enrichment,
        helpingCategoryComplete:
          child.helpingFamily.total > 0 && child.helpingFamily.completed > 0,
        enrichmentCategoryComplete:
          child.enrichment.total > 0 && child.enrichment.completed > 0,
        bothComplete:
          child.helpingFamily.total > 0 &&
          child.enrichment.total > 0 &&
          child.helpingFamily.completed > 0 &&
          child.enrichment.completed > 0,
      })),
    };

    // Auto-revoke awards that no longer match completion (per category + legacy)
    for (const childData of Object.values(tasksByChild)) {
      try {
        await revokeIneligibleAwardsForChild(childData, start, end);
      } catch (autoRevokeErr) {
        console.error(`[CHECK-DAILY] ❌ AUTO-REVOKE ERROR:`, autoRevokeErr);
      }
    }
    
    console.log(`[CHECK-DAILY] Response techTimeRewards:`, JSON.stringify(responseData.techTimeRewards, null, 2));
    console.log(`[CHECK-DAILY] Response categoryBreakdown:`, JSON.stringify(responseData.categoryBreakdown, null, 2));
    console.log(`[CHECK-DAILY] Response date:`, responseData.date);
    res.json(responseData);
  } catch (error) {
    console.error('[CHECK-DAILY] Error checking daily completion:', error);
    res.status(500).json({ error: 'Failed to check daily completion' });
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

    // If task doesn't exist, it might already be deleted (race condition)
    // Return success to prevent error messages
    if (!task) {
      console.log(`[DELETE] Task ${req.params.id} not found - may already be deleted`);
      return res.json({ message: 'Task already deleted or not found' });
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
    console.log(`[TECH TIME] ===== AWARD ENTRY POINT =====`);
    console.log(`[TECH TIME] Request body:`, req.body);
    const { startOfDay, endOfDay } = await import('date-fns');
    const { childId, date } = req.body;

    if (!childId) {
      console.log(`[TECH TIME] ❌ Missing childId`);
      return res.status(400).json({ error: 'childId is required' });
    }

    console.log(`[TECH TIME] childId: ${childId}, date from request: ${date}`);
    
    // Check if the date looks like a current timestamp (likely wrong from frontend)
    // If it's within the last hour, it's probably wrong - infer from most recent task instead
    let checkDate;
    if (date) {
      const providedDate = new Date(date);
      const now = new Date();
      const hoursDiff = Math.abs(now - providedDate) / (1000 * 60 * 60);
      
      // If the date is within the last 2 hours, it's probably a current timestamp (wrong)
      if (hoursDiff < 2) {
        console.log(`[TECH TIME] ⚠️ Date looks like current timestamp (${hoursDiff.toFixed(2)} hours ago), inferring from most recent task...`);
        // Find the most recently updated task for this child
        const recentTask = await prisma.task.findFirst({
          where: { childId },
          orderBy: { updatedAt: 'desc' },
        });
        
        if (recentTask) {
          const taskDate = new Date(recentTask.dueDate);
          const year = taskDate.getUTCFullYear();
          const month = taskDate.getUTCMonth();
          const day = taskDate.getUTCDate();
          checkDate = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
          console.log(`[TECH TIME] ✅ Using date from most recent task: ${checkDate.toISOString()} (task: ${recentTask.title})`);
        } else {
          console.log(`[TECH TIME] ⚠️ No recent task found, using provided date`);
          checkDate = getUtcDateOnly(date);
        }
      } else {
        checkDate = getUtcDateOnly(date);
        console.log(`[TECH TIME] ✅ Using provided date: ${checkDate.toISOString()}`);
      }
    } else {
      checkDate = getUtcDateOnly(new Date().toISOString());
      console.log(`[TECH TIME] ⚠️ No date provided, using today`);
    }
    
    const start = startOfDay(checkDate);
    const end = endOfDay(checkDate);
    console.log(`[TECH TIME] Final checkDate: ${checkDate.toISOString()}, start: ${start.toISOString()}, end: ${end.toISOString()}`);

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

    console.log(`[TECH TIME] Found ${tasks.length} tasks: ${helpingFamilyTasks.length} helping-family, ${enrichmentTasks.length} enrichment`);
    console.log(`[TECH TIME] Helping-family completed: ${helpingFamilyTasks.filter(t => t.completed).length}/${helpingFamilyTasks.length}`);
    console.log(`[TECH TIME] Enrichment completed: ${enrichmentTasks.filter(t => t.completed).length}/${enrichmentTasks.length}`);

    const hasH = helpingFamilyTasks.length > 0;
    const hasE = enrichmentTasks.length > 0;
    const helpingEligible =
      hasH && helpingFamilyTasks.some((t) => t.completed);
    const enrichmentEligible =
      hasE && enrichmentTasks.some((t) => t.completed);

    const legacyAward = await findTechAward(childId, start, AWARD_CATEGORY_LEGACY);
    const helpAward = await findTechAward(childId, start, AWARD_CATEGORY_HELPING);
    const enrichAward = await findTechAward(childId, start, AWARD_CATEGORY_ENRICHMENT);

    console.log(
      `[TECH TIME] eligible helping=${helpingEligible}, enrichment=${enrichmentEligible}, legacy=${!!legacyAward}`,
    );

    const categoriesToGrant = [];
    if (!legacyAward) {
      if (helpingEligible && !helpAward) {
        categoriesToGrant.push(AWARD_CATEGORY_HELPING);
      }
      if (enrichmentEligible && !enrichAward) {
        categoriesToGrant.push(AWARD_CATEGORY_ENRICHMENT);
      }
    }

    if (categoriesToGrant.length === 0) {
      console.log(`[TECH TIME] ❌ No category awards pending for this date`);
      return res.status(400).json({
        error: 'No tech time to award for this date',
        helpingFamily: {
          total: helpingFamilyTasks.length,
          completed: helpingFamilyTasks.filter((t) => t.completed).length,
        },
        enrichment: {
          total: enrichmentTasks.length,
          completed: enrichmentTasks.filter((t) => t.completed).length,
        },
        helpingEligible,
        enrichmentEligible,
        legacyExists: !!legacyAward,
      });
    }

    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { timeBalance: true, name: true },
    });

    if (!child) {
      console.log(`[TECH TIME] ❌ Child not found: ${childId}`);
      return res.status(404).json({ error: 'Child not found' });
    }

    const previousBalance = child.timeBalance || 0;
    const totalDelta = categoriesToGrant.length * HALF_AWARD_MINUTES;
    const newBalance = previousBalance + totalDelta;

    const txOps = [
      prisma.child.update({
        where: { id: childId },
        data: { timeBalance: newBalance },
      }),
      ...categoriesToGrant.map((awardCategory) =>
        prisma.techTimeAward.create({
          data: {
            childId,
            awardDate: start,
            minutes: HALF_AWARD_MINUTES,
            awardCategory,
          },
        }),
      ),
    ];

    await prisma.$transaction(txOps);

    const awards = categoriesToGrant.map((c) => ({
      category: c,
      minutes: HALF_AWARD_MINUTES,
    }));

    console.log(
      `[TECH TIME] ✅ Awarded ${totalDelta} min to ${child.name}:`,
      awards,
    );

    res.json({
      success: true,
      message: `Awarded ${totalDelta} minutes of tech time to ${child.name}`,
      newBalance,
      previousBalance,
      minutesAdded: totalDelta,
      awards,
      date: checkDate.toISOString(),
      childName: child.name,
    });
  } catch (error) {
    console.error('[TECH TIME] ❌ Error awarding tech time:', error);
    console.error('[TECH TIME] Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to award tech time', details: error.message });
  }
});

// POST /api/tasks/revoke-tech-time
// Used when a task is un-completed after tech time was already awarded.
// This subtracts the award and removes the TechTimeAward record for that day.
router.post('/revoke-tech-time', async (req, res) => {
  try {
    console.log('[REVOKE] ===== ENTRY POINT =====');
    console.log('[REVOKE] Request body:', req.body);
    const { startOfDay, endOfDay } = await import('date-fns');
    const { childId, date } = req.body;

    if (!childId) {
      console.log('[REVOKE] ❌ Missing childId');
      return res.status(400).json({ error: 'childId is required' });
    }

    console.log(`[REVOKE] childId: ${childId}, date from request: ${date}`);
    
    // Check if the date looks like a current timestamp (likely wrong from frontend)
    // If it's within the last hour, it's probably wrong - infer from most recent task instead
    let checkDate;
    if (date) {
      const providedDate = new Date(date);
      const now = new Date();
      const hoursDiff = Math.abs(now - providedDate) / (1000 * 60 * 60);
      
      // If the date is within the last 2 hours, it's probably a current timestamp (wrong)
      if (hoursDiff < 2) {
        console.log(`[REVOKE] ⚠️ Date looks like current timestamp (${hoursDiff.toFixed(2)} hours ago), inferring from most recent task...`);
        // Find the most recently updated task for this child
        const recentTask = await prisma.task.findFirst({
          where: { childId },
          orderBy: { updatedAt: 'desc' },
        });
        
        if (recentTask) {
          const taskDate = new Date(recentTask.dueDate);
          const year = taskDate.getUTCFullYear();
          const month = taskDate.getUTCMonth();
          const day = taskDate.getUTCDate();
          checkDate = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
          console.log(`[REVOKE] ✅ Using date from most recent task: ${checkDate.toISOString()} (task: ${recentTask.title})`);
        } else {
          console.log(`[REVOKE] ⚠️ No recent task found, using provided date`);
          checkDate = getUtcDateOnly(date);
        }
      } else {
        checkDate = getUtcDateOnly(date);
        console.log(`[REVOKE] ✅ Using provided date: ${checkDate.toISOString()}`);
      }
    } else {
      checkDate = getUtcDateOnly(new Date().toISOString());
      console.log(`[REVOKE] ⚠️ No date provided, using today`);
    }
    
    const start = startOfDay(checkDate);
    const end = endOfDay(checkDate);
    console.log(`[REVOKE] Final checkDate: ${checkDate.toISOString()}, start: ${start.toISOString()}, end: ${end.toISOString()}`);

    const tasksForDay = await prisma.task.findMany({
      where: {
        childId,
        dueDate: { gte: start, lte: end },
      },
      include: {
        child: { select: { name: true } },
      },
    });

    if (tasksForDay.length === 0) {
      return res.status(400).json({
        error: 'No tasks for this date',
        message: 'Cannot sync awards without tasks on that day',
      });
    }

    const childData = {
      childId,
      childName: tasksForDay[0].child.name,
      helpingFamily: { total: 0, completed: 0 },
      enrichment: { total: 0, completed: 0 },
    };
    for (const t of tasksForDay) {
      if (t.category === 'helping-family') {
        childData.helpingFamily.total++;
        if (t.completed) childData.helpingFamily.completed++;
      } else if (t.category === 'enrichment') {
        childData.enrichment.total++;
        if (t.completed) childData.enrichment.completed++;
      }
    }

    const before = await prisma.child.findUnique({
      where: { id: childId },
      select: { timeBalance: true, name: true },
    });
    if (!before) {
      return res.status(404).json({ error: 'Child not found' });
    }

    await revokeIneligibleAwardsForChild(childData, start, end);

    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { timeBalance: true, name: true },
    });

    res.json({
      success: true,
      message: 'Synced tech time awards for this date',
      newBalance: child.timeBalance,
      previousBalance: before.timeBalance,
      childName: child.name,
      date: checkDate.toISOString(),
    });
  } catch (error) {
    console.error('Error revoking tech time:', error);
    res.status(500).json({ error: 'Failed to revoke tech time' });
  }
});

export default router;
