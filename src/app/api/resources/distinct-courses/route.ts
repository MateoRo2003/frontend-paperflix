import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/auth';

export async function GET() {
  const rows = await prisma.resource.findMany({ select: { course: true }, distinct: ['course'], where: { isActive: true } });
  return ok(rows.map(r => r.course).filter(Boolean).sort());
}
