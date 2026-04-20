import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const status = req.nextUrl.searchParams.get('status');
  return ok(await prisma.suggestion.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
  }));
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  if (!data.title) return err('title requerido');
  return ok(await prisma.suggestion.create({ data }), 201);
}
