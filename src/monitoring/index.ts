/**
 * Health Monitor Entry Point
 * Runs periodic health checks and exposes a simple HTTP status endpoint
 */
import http from 'http';
import { HealthMonitor } from './HealthMonitor';
import { DatabaseManager } from '@/database/DatabaseManager';
import { RedisManager } from '@/cache/RedisManager';

const PORT = process.env.HEALTH_MONITOR_PORT || 3002;

async function main() {
  console.log('🚀 Starting Health Monitor...');

  // Connect to infrastructure
  const dbManager = DatabaseManager.getInstance();
  const redisManager = RedisManager.getInstance();

  try {
    await dbManager.connect();
    console.log('✅ Database connected');
  } catch (e) {
    console.warn('⚠️ Database connection failed, continuing without DB checks');
  }

  try {
    await redisManager.connect();
    console.log('✅ Redis connected');
  } catch (e) {
    console.warn('⚠️ Redis connection failed, continuing without Redis checks');
  }

  // Setup health monitor
  const monitor = HealthMonitor.getInstance();
  monitor.registerDefaultChecks();

  monitor.registerCheck('database', async () => dbManager.isConnected());
  monitor.registerCheck('redis', async () => redisManager.isConnected());

  // Check other services via HTTP
  const services = (process.env.SERVICES_TO_MONITOR || 'api-gateway').split(',');
  for (const service of services) {
    monitor.registerCheck(service.trim(), monitor.createExternalAPICheck(
      service.trim(),
      `http://${service.trim()}:3000/health`
    ));
  }

  monitor.startMonitoring(Number(process.env.CHECK_INTERVAL) || 60000);

  // Simple HTTP server for health monitor's own health check
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      const summary = await monitor.getHealthSummary();
      res.writeHead(summary.status === 'unhealthy' ? 503 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(summary));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(PORT, () => {
    console.log(`✅ Health Monitor running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    monitor.stopMonitoring();
    server.close(() => process.exit(0));
  });
}

main().catch(err => {
  console.error('❌ Health Monitor failed to start:', err);
  process.exit(1);
});
