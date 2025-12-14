import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import { prisma } from './lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Import API routes
import tasksRoutes from './src/server/routes/tasks.js';
import childrenRoutes from './src/server/routes/children.js';
import recurrenceTemplatesRoutes from './src/server/routes/recurrence-templates.js';
import homeAssistantRoutes from './src/server/routes/home-assistant.js';
import healthRoutes from './src/server/routes/health.js';

// API routes
app.use('/api/tasks', tasksRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/recurrence-templates', recurrenceTemplatesRoutes);
app.use('/api/home-assistant', homeAssistantRoutes);
app.use('/health', healthRoutes);

// Serve static files from Vite build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')));
  
  // Serve index.html for all non-API routes (SPA routing)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
