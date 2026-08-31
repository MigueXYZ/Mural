import {
  User,
  Users,
  Shield,
  MapPin,
  Castle,
  Building,
  Skull,
  Search,
  Sparkles,
  Sword,
  Crown,
  BookOpen,
  Scroll,
  Flame,
  Eye,
  Ghost,
  Key,
  Compass,
  FileText,
  Dices,
  HelpCircle,
} from 'lucide-svelte';

export interface IconOption {
  id: string;
  name: string;
  component: any;
  category: 'general' | 'character' | 'organization' | 'location' | 'mystery';
}

export const ICON_OPTIONS: IconOption[] = [
  { id: 'user', name: 'Personagem', component: User, category: 'character' },
  { id: 'users', name: 'Grupo / Aliados', component: Users, category: 'character' },
  { id: 'crown', name: 'Líder / Nobreza', component: Crown, category: 'character' },
  { id: 'sword', name: 'Guerreiro / Ameaça', component: Sword, category: 'character' },
  { id: 'shield', name: 'Facção / Guarda', component: Shield, category: 'organization' },
  { id: 'building', name: 'Instituição', component: Building, category: 'organization' },
  { id: 'map-pin', name: 'Localização', component: MapPin, category: 'location' },
  { id: 'castle', name: 'Fortaleza / Base', component: Castle, category: 'location' },
  { id: 'compass', name: 'Região / Exploração', component: Compass, category: 'location' },
  { id: 'skull', name: 'Perigo Mortal / Vilão', component: Skull, category: 'mystery' },
  { id: 'ghost', name: 'Sobrenatural / Mistério', component: Ghost, category: 'mystery' },
  { id: 'eye', name: 'Vigilância / Segredo', component: Eye, category: 'mystery' },
  { id: 'search', name: 'Pista / Investigação', component: Search, category: 'mystery' },
  { id: 'key', name: 'Chave / Revelação', component: Key, category: 'mystery' },
  { id: 'file-text', name: 'Nota / Caderno', component: FileText, category: 'general' },
  { id: 'dices', name: 'Tabela de Dados', component: Dices, category: 'general' },
  { id: 'book-open', name: 'Tomo / Documento', component: BookOpen, category: 'general' },
  { id: 'scroll', name: 'Pergaminho / Contrato', component: Scroll, category: 'general' },
  { id: 'flame', name: 'Fogo / Caos', component: Flame, category: 'general' },
  { id: 'sparkles', name: 'Magia / Artefacto', component: Sparkles, category: 'general' },
];

export const ICON_MAP: Record<string, any> = Object.fromEntries(
  ICON_OPTIONS.map((item) => [item.id, item.component])
);

export function getEntityIcon(iconId?: string, type?: string) {
  if (iconId && ICON_MAP[iconId]) {
    return ICON_MAP[iconId];
  }
  switch (type) {
    case 'npc':
      return User;
    case 'faction':
      return Shield;
    case 'location':
      return MapPin;
    case 'secret':
      return Skull;
    case 'clue':
      return Search;
    case 'note':
      return FileText;
    case 'table':
      return Dices;
    default:
      return HelpCircle;
  }
}
