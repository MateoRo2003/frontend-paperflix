import { NextRequest } from 'next/server';
import { ok, err } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return err('url requerida');

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();

    const title = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]
      || html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
    const description = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]
      || html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] || '';
    const imageUrl = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] || '';

    return ok({ title: title.trim(), description: description.trim(), imageUrl });
  } catch {
    return ok({ title: '', description: '', imageUrl: '' });
  }
}
