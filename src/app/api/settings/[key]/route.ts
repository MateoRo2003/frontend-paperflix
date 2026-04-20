import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { key: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { value } = await req.json();
  const setting = await prisma.setting.upsert({
    where: { key: params.key },
    update: { value },
    create: { key: params.key, value },
  });
  return ok(setting);
}
