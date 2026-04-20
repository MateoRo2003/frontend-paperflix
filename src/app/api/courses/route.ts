import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

export async function GET() {
  return ok(await prisma.course.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const data = await req.json();
  if (!data.name) return err('name requerido');
  return ok(await prisma.course.create({ data }), 201);
}
