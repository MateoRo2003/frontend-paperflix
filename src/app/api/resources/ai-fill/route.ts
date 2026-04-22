import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';
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
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] || '';
    const title   = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
    const h1      = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] || '';
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);

    return JSON.stringify({ ogTitle, ogDesc, ogImage, title, h1, bodyText });
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  if (!process.env.GROQ_API_KEY) {
    return err('GROQ_API_KEY no configurada en el servidor', 500);
  }

  const { url } = await req.json();
  if (!url) return err('url requerida');

  const pageRaw = await fetchPageContent(url);
  let pageData: any = {};
  try { pageData = JSON.parse(pageRaw); } catch { }

  const prompt = `Eres un asistente para PaperFlix, plataforma educativa chilena para docentes de básica y media.

Analiza este recurso educativo y genera metadata en español.

URL: ${url}
Datos extraídos de la página:
${pageRaw || '(no se pudo acceder a la página)'}

Tipos de actividad disponibles: "Introductoria", "De desarrollo", "De cierre", "Herramienta"

Responde SOLO con un JSON válido con estos campos:
{
  "title": "Título conciso del recurso en español (máx 80 caracteres)",
  "description": "1-2 oraciones para docentes: qué aprenden los alumnos y cómo se usa (máx 220 caracteres)",
  "author": "Nombre de la plataforma/creador (ej: Wordwall, Khan Academy, Educarchile)",
  "activityTypeSuggestion": "Uno de los tipos disponibles o cadena vacía si no estás seguro"
}`;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente especializado en catalogar recursos educativos. Respondes siempre con JSON válido y nada más.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });

    const text = completion.choices[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return err('La IA no devolvió un JSON válido');

    const parsed = JSON.parse(jsonMatch[0]);
    const VALID_TYPES = ['Introductoria', 'De desarrollo', 'De cierre', 'Herramienta'];

    return ok({
      title:                  typeof parsed.title === 'string'                  ? parsed.title.trim()       : '',
      description:            typeof parsed.description === 'string'            ? parsed.description.trim() : '',
      author:                 typeof parsed.author === 'string'                 ? parsed.author.trim()      : '',
      activityTypeSuggestion: VALID_TYPES.includes(parsed.activityTypeSuggestion) ? parsed.activityTypeSuggestion : '',
      imageUrl:               typeof pageData.ogImage === 'string'              ? pageData.ogImage.trim()   : '',
    });
  } catch (e: any) {
    return err(`Error de IA: ${e?.message || 'desconocido'}`, 500);
  }
}
