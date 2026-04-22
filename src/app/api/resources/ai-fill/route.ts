import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';
import { requireAuth, ok, err } from '@/lib/auth';

async function fetchPageContent(url: string): Promise<{ meta: string; imageUrl: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();

    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]
                 || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i)?.[1] || '';
    const ogDesc  = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]
                 || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i)?.[1]
                 || html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1]
                 || html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i)?.[1] || '';
    const title   = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
    const h1      = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] || '';
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);

    // Try multiple image sources in priority order
    let imageUrl =
      html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ||
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)?.[1] ||
      html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i)?.[1] ||
      html.match(/<meta[^>]+content="([^"]+)"[^>]+name="twitter:image"/i)?.[1] ||
      html.match(/<meta[^>]+property="twitter:image"[^>]+content="([^"]+)"/i)?.[1] ||
      '';

    // If still no image, scan <img> tags for a meaningful one
    if (!imageUrl) {
      const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = imgRegex.exec(html)) !== null) {
        const src = m[1];
        if (
          src &&
          !src.includes('pixel') &&
          !src.includes('track') &&
          !src.includes('favicon') &&
          !/\.(gif|ico|svg)$/i.test(src) &&
          (src.startsWith('http') || src.startsWith('/'))
        ) {
          imageUrl = src.startsWith('/')
            ? `${new URL(url).origin}${src}`
            : src;
          break;
        }
      }
    }

    // Last resort: free screenshot thumbnail service
    if (!imageUrl) {
      imageUrl = `https://image.thum.io/get/width/800/crop/600/${url}`;
    }

    return {
      meta: JSON.stringify({ ogTitle, ogDesc, title, h1, bodyText }),
      imageUrl,
    };
  } catch {
    return {
      meta: '',
      imageUrl: `https://image.thum.io/get/width/800/crop/600/${url}`,
    };
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

  const { meta: pageRaw, imageUrl } = await fetchPageContent(url);

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
      imageUrl,
    });
  } catch (e: any) {
    return err(`Error de IA: ${e?.message || 'desconocido'}`, 500);
  }
}
