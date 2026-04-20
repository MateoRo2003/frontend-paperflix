import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { items } = await req.json();
  if (!Array.isArray(items) || items.length === 0) return err('items requeridos');

  let created = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    try {
      await prisma.resource.create({ data: items[i] });
      created++;
    } catch (e: unknown) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : 'Error' });
    }
  }

  return ok({ created, errors });
}
