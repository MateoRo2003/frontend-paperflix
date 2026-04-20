import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/auth';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.resource.update({
    where: { id: Number(params.id) },
    data: { views: { increment: 1 } },
  });
  return ok({ success: true });
}
