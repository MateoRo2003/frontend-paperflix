import {
  BookOpen, Calculator, FlaskConical, Globe, Microscope, Atom,
  Compass, Map, Dumbbell, Palette, Music, Languages, Code, Film,
  Monitor, Lightbulb, Layers, Star, Award, Heart, type LucideIcon,
} from 'lucide-react';

export const SUBJECT_ICONS: { name: string; label: string; Icon: LucideIcon }[] = [
  { name: 'BookOpen',     label: 'Libro',        Icon: BookOpen },
  { name: 'Calculator',   label: 'Calculadora',  Icon: Calculator },
  { name: 'FlaskConical', label: 'Ciencias',     Icon: FlaskConical },
  { name: 'Globe',        label: 'Geografía',    Icon: Globe },
  { name: 'Microscope',   label: 'Microscopio',  Icon: Microscope },
  { name: 'Atom',         label: 'Física',       Icon: Atom },
  { name: 'Compass',      label: 'Geometría',    Icon: Compass },
  { name: 'Map',          label: 'Mapa',         Icon: Map },
  { name: 'Dumbbell',     label: 'Ed. Física',   Icon: Dumbbell },
  { name: 'Palette',      label: 'Arte',         Icon: Palette },
  { name: 'Music',        label: 'Música',       Icon: Music },
  { name: 'Languages',    label: 'Idioma',       Icon: Languages },
  { name: 'Code',         label: 'Tecnología',   Icon: Code },
  { name: 'Film',         label: 'Cine',         Icon: Film },
  { name: 'Monitor',      label: 'Digital',      Icon: Monitor },
  { name: 'Lightbulb',    label: 'Ideas',        Icon: Lightbulb },
  { name: 'Layers',       label: 'Materias',     Icon: Layers },
  { name: 'Star',         label: 'Destacado',    Icon: Star },
  { name: 'Award',        label: 'Logros',       Icon: Award },
  { name: 'Heart',        label: 'Bienestar',    Icon: Heart },
];

interface Props {
  icon?: string | null;
  color: string;
  size?: number;
  fallback?: string;
}

export function SubjectIcon({ icon, color, size = 20, fallback }: Props) {
  if (icon?.trim().startsWith('<')) {
    return (
      <span
        dangerouslySetInnerHTML={{ __html: icon }}
        style={{ width: size, height: size, display: 'flex', color, alignItems: 'center', justifyContent: 'center' }}
      />
    );
  }
  const found = SUBJECT_ICONS.find(i => i.name === icon);
  if (found) return <found.Icon size={size} color={color} />;
  if (fallback) return <span style={{ color }}>{fallback}</span>;
  return null;
}
