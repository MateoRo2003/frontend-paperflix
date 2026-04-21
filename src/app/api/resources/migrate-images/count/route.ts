import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const all = await prisma.resource.findMany({
    select: { id: true, imageUrl: true, linkUrl: true },
  });

  let pending = 0;
  let alreadyWebp = 0;
  let noImage = 0;
  let noImageWithUrl = 0;

  for (const r of all) {
    if (!r.imageUrl) {
      if (r.linkUrl) noImageWithUrl++;
      else noImage++;
    } else if (r.imageUrl.includes(SUPABASE_URL)) {
      alreadyWebp++;
    } else {
      pending++;
    }
  }

  return ok({ total: all.length, pending, alreadyWebp, noImage, noImageWithUrl });
}
