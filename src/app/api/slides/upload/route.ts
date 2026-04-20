import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, ok, err } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return err('file requerido');

  const ext = file.name.split('.').pop() || 'webp';
  const filename = `slides/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from('uploads')
    .upload(filename, buffer, { contentType: file.type, upsert: false });

  if (error) return err(error.message, 500);

  const { data } = supabase.storage.from('uploads').getPublicUrl(filename);
  return ok({ url: data.publicUrl });
}
