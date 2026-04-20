import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/auth';

export async function GET() {
  const resources = await prisma.resource.findMany({
    where: { isActive: true },
    orderBy: { views: 'desc' },
    take: 8,
  });
  return ok(resources);
}
