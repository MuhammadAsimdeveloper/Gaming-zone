import {
  Brain,
  Compass,
  Gauge,
  GraduationCap,
  Joystick,
  Puzzle,
  Sparkles,
  Sprout,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryIconKey } from '../../data/categories';

const iconMap: Record<CategoryIconKey, LucideIcon> = {
  joystick: Joystick,
  gauge: Gauge,
  puzzle: Puzzle,
  compass: Compass,
  trophy: Trophy,
  brain: Brain,
  sprout: Sprout,
  swords: Swords,
  sparkles: Sparkles,
  users: Users,
  graduation: GraduationCap,
};

export function CategoryIcon({ icon, className }: { icon: CategoryIconKey; className?: string }) {
  const Icon = iconMap[icon];
  return <Icon className={className} aria-hidden="true" />;
}
