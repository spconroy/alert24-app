// lib/prisma.js
// Prisma client utility for Alert24 App
// Ensures a single instance in development

import { PrismaClient } from '../app/generated/prisma';

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

export default prisma; 