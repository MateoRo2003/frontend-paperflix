import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

async function downloadAndUpload(remoteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(remoteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg';
    const buffer = Buffer.from(await res.arrayBuffer());
    const filename = `resources/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from('uploads')
      .upload(filename, buffer, { contentType, upsert: false });

    if (error) return null;

    const { data } = supabase.storage.from('uploads').getPublicUrl(filename);
    return data.publicUrl;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const p = req.nextUrl.searchParams;
  const offset = Number(p.get('offset') || 0);
  const limit = Number(p.get('limit') || 10);

  const resources = await prisma.resource.findMany({
    where: {
      imageUrl: { not: null },
      NOT: { imageUrl: { contains: SUPABASE_URL } },
    },
    select: { id: true, imageUrl: true, title: true },
    skip: offset,
    take: limit,
  });

  let converted = 0;
  let skipped = 0;
  let failed = 0;
  const errors: { id: number; title: string; reason: string }[] = [];

  for (const r of resources) {
    if (!r.imageUrl) { skipped++; continue; }
    const uploaded = await downloadAndUpload(r.imageUrl);
    if (uploaded) {
      await prisma.resource.update({ where: { id: r.id }, data: { imageUrl: uploaded } });
      converted++;
    } else {
      failed++;
      errors.push({ id: r.id, title: r.title, reason: 'No se pudo descargar la imagen' });
    }
  }

  const remaining = await prisma.resource.count({
    where: {
      imageUrl: { not: null },
      NOT: { imageUrl: { contains: SUPABASE_URL } },
    },
  });

  return ok({ processed: resources.length, skipped, converted, failed, errors, done: remaining === 0 });
}
