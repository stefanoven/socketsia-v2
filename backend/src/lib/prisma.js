/**
 * Singleton PrismaClient instance.
 * Import from here in all services to reuse the connection pool.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
