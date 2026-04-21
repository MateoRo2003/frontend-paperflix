import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function downloadAndUploadImage(remoteUrl: string): Promise<string | null> {
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { items } = await req.json();
  if (!Array.isArray(items) || items.length === 0) return err('items requeridos');

  let created = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    try {
      const item = { ...items[i] };

      // If imageUrl is a remote URL (not already in our storage), download and upload it
      if (item.imageUrl && typeof item.imageUrl === 'string' &&
          item.imageUrl.startsWith('http') && !item.imageUrl.includes(SUPABASE_URL)) {
        const uploaded = await downloadAndUploadImage(item.imageUrl);
        item.imageUrl = uploaded ?? undefined;
      }

      await prisma.resource.create({ data: item });
      created++;
    } catch (e: unknown) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : 'Error' });
    }
  }

  return ok({ created, errors });
}
