/**
 * Standalone script to run the RadarZap web dashboard locally.
 * Connects to MongoDB + Redis then starts DashboardService on port 3001.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register start-dashboard.ts
 */

import { DatabaseManager } from '@/database/DatabaseManager';
import { RedisManager } from '@/cache/RedisManager';
import { DashboardService } from '@/services/web-dashboard/DashboardService';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('StartDashboard');

async function main() {
  logger.info('Connecting to MongoDB...');
  await DatabaseManager.getInstance().connect();
  logger.info('✅ MongoDB connected');

  logger.info('Connecting to Redis...');
  await RedisManager.getInstance().connect();
  logger.info('✅ Redis connected');

  const dashboard = DashboardService.getInstance(3001);
  await dashboard.start();
}

main().catch((err) => {
  console.error('Failed to start dashboard:', err);
  process.exit(1);
});
