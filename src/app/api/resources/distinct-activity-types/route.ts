import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/auth';

export async function GET() {
  const rows = await prisma.resource.findMany({ select: { activityType: true }, distinct: ['activityType'], where: { isActive: true } });
  return ok(rows.map(r => r.activityType).filter(Boolean).sort());
}
