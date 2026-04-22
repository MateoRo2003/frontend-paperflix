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
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] || '';
    const title   = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
    const h1      = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] || '';
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500);

    return JSON.stringify({
      ogTitle, ogDesc, ogImage, title, h1, bodyText,
    });
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

Genera un JSON con exactamente estos campos:
- "title": Título conciso del recurso en español (máx 80 caracteres). Si el og:title está en español y es bueno, úsalo mejorado.
- "description": 1-2 oraciones en español para docentes: qué aprenden los alumnos y cómo se usa (máx 220 caracteres).
- "author": Nombre de la plataforma/creador (ej: "Wordwall", "Khan Academy", "Educarchile", "Phet Colorado"). Extráelo del dominio.
- "activityTypeSuggestion": Uno de los tipos de actividad disponibles que mejor se ajuste al recurso, o "" si no estás seguro.

Responde SOLO con el JSON válido, sin markdown ni texto adicional.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return err('La IA no devolvió un JSON válido');

    const parsed = JSON.parse(jsonMatch[0]);
    const VALID_TYPES = ['Introductoria', 'De desarrollo', 'De cierre', 'Herramienta'];

    return ok({
      title:                  typeof parsed.title === 'string'                  ? parsed.title.trim()                  : '',
      description:            typeof parsed.description === 'string'            ? parsed.description.trim()            : '',
      author:                 typeof parsed.author === 'string'                 ? parsed.author.trim()                 : '',
      activityTypeSuggestion: VALID_TYPES.includes(parsed.activityTypeSuggestion) ? parsed.activityTypeSuggestion      : '',
      imageUrl:               typeof pageData.ogImage === 'string'              ? pageData.ogImage.trim()              : '',
    });
  } catch (e: any) {
    return err(`Error de IA: ${e?.message || 'desconocido'}`, 500);
  }
}
