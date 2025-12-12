#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || '/data/task-calendar.db';

// Create data directory if needed
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database if it doesn't exist
if (!fs.existsSync(dbPath)) {
  console.log('Initializing database...');
  try {
    execSync('npx prisma db push', {
      cwd: '/app',
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: `file:${dbPath}`
      }
    });
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  }
} else {
  console.log('Database already exists');
}

