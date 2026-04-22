import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAuth, ok, err } from '@/lib/auth';

async function fetchPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PaperFlix/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();

    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] || '';
    const ogDesc  = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]
                 || html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] || '';
    const title   = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
    const h1      = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] || '';
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500);

    return [
      ogTitle  ? `og:title: ${ogTitle}` : '',
      title    ? `title: ${title}` : '',
      h1       ? `h1: ${h1}` : '',
      ogDesc   ? `description meta: ${ogDesc}` : '',
      bodyText ? `page text: ${bodyText}` : '',
    ].filter(Boolean).join('\n');
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  if (!process.env.GEMINI_API_KEY) {
    return err('GEMINI_API_KEY no configurada en el servidor', 500);
  }

  const { url, title, description, author } = await req.json();
  if (!url) return err('url requerida');

  const pageContent = await fetchPageContent(url);

  const prompt = `Eres un asistente para PaperFlix, una plataforma educativa chilena para docentes de educación básica y media.

Analiza el siguiente recurso educativo y genera metadata en español para catalogarlo.

URL: ${url}
${pageContent ? `\nContenido extraído de la página:\n${pageContent}` : ''}
${title ? `\nTítulo actual: ${title}` : ''}
${description ? `\nDescripción actual: ${description}` : ''}
${author ? `\nAutor actual: ${author}` : ''}

Genera un JSON con exactamente estos campos:
- "title": Título conciso y descriptivo del recurso educativo en español (máx 80 caracteres).
- "description": Descripción de 1-2 oraciones en español para docentes. Qué aprenden los estudiantes y cómo se usa (máx 220 caracteres).
- "author": Nombre de la plataforma o creador (ej: "Wordwall", "Khan Academy", "Educarchile").

Responde SOLO con el JSON válido, sin markdown ni explicaciones adicionales.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return err('La IA no devolvió un JSON válido');

    const parsed = JSON.parse(jsonMatch[0]);
    return ok({
      title:       typeof parsed.title === 'string'       ? parsed.title.trim()       : '',
      description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
      author:      typeof parsed.author === 'string'      ? parsed.author.trim()      : '',
    });
  } catch (e: any) {
    return err(`Error de IA: ${e?.message || 'desconocido'}`, 500);
  }
}
