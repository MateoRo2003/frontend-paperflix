import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

export async function GET() {
  return ok(await prisma.slide.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const data = await req.json();
  if (!data.title) return err('title requerido');
  return ok(await prisma.slide.create({ data }), 201);
}
