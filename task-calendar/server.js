import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import cors from 'cors';
import { prisma } from './lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

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
  const distPath = join(__dirname, 'dist');
  console.log(`Setting up static file serving from: ${distPath}`);
  
  app.use(express.static(distPath, {
    index: false, // Don't serve index.html automatically, we'll handle it explicitly
    extensions: ['html', 'js', 'css', 'json', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico']
  }));
  
  // Serve index.html for all non-API routes (SPA routing)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    const indexPath = join(distPath, 'index.html');
    console.log(`Serving index.html for path: ${req.path}`);
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error(`Error serving index.html:`, err);
        res.status(500).send('Error loading page');
      }
    });
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  console.log(`404: API route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'API route not found' });
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Verify dist directory exists before starting
if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, 'dist');
  const indexPath = join(distPath, 'index.html');
  
  console.log('Checking for dist directory...');
  console.log('__dirname:', __dirname);
  console.log('distPath:', distPath);
  
  if (!existsSync(distPath)) {
    console.error(`ERROR: dist directory not found at ${distPath}`);
    console.error('Current __dirname:', __dirname);
    console.error('Listing current directory:');
    try {
      const files = readdirSync(__dirname);
      console.error('Files in __dirname:', files);
    } catch (e) {
      console.error('Error listing directory:', e.message);
    }
    process.exit(1);
  }
  
  if (!existsSync(indexPath)) {
    console.error(`ERROR: dist/index.html not found at ${indexPath}`);
    console.error('Dist directory contents:');
    try {
      const files = readdirSync(distPath);
      console.error('Files in dist:', files);
    } catch (e) {
      console.error('Error listing dist directory:', e.message);
    }
    process.exit(1);
  }
  
  console.log(`✓ Dist directory found at ${distPath}`);
  console.log(`✓ index.html found at ${indexPath}`);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Server accessible at http://0.0.0.0:${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`✓ Serving static files from ${join(__dirname, 'dist')}`);
  }
});

export default app;
