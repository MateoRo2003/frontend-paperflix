import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const admin = await prisma.admin.findUnique({
    where: { id: Number(auth.payload!.sub) },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  return ok(admin);
}
