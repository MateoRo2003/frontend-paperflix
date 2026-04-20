import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/auth';

export async function GET() {
  const rows = await prisma.resource.findMany({ select: { author: true }, distinct: ['author'], where: { isActive: true } });
  return ok(rows.map(r => r.author).filter(Boolean).sort());
}
