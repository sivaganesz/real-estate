import type { AmenityIcon as AmenityIconName } from '@real-estate/shared';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpDownIcon,
  BabyIcon,
  Building2Icon,
  CctvIcon,
  CircleDashedIcon,
  CloudRainIcon,
  DropletsIcon,
  DumbbellIcon,
  FenceIcon,
  FlameIcon,
  LightbulbIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StoreIcon,
  SunIcon,
  TreesIcon,
  WavesIcon,
  WifiIcon,
  ZapIcon,
  CarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<AmenityIconName, LucideIcon> = {
  'shield-check': ShieldCheckIcon,
  cctv: CctvIcon,
  fence: FenceIcon,
  car: CarIcon,
  zap: ZapIcon,
  'arrow-up-down': ArrowUpDownIcon,
  waves: WavesIcon,
  dumbbell: DumbbellIcon,
  baby: BabyIcon,
  trees: TreesIcon,
  'building-2': Building2Icon,
  'cloud-rain': CloudRainIcon,
  droplets: DropletsIcon,
  lightbulb: LightbulbIcon,
  route: RouteIcon,
  wifi: WifiIcon,
  flame: FlameIcon,
  sun: SunIcon,
  store: StoreIcon,
  sparkles: SparklesIcon,
};

/** The amenity's icon in a small tile; a dashed circle when it has none. */
export function AmenityIcon({
  icon,
  className,
}: {
  icon: AmenityIconName | null;
  className?: string;
}) {
  const Icon = icon ? ICONS[icon] : CircleDashedIcon;
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-8 flex-none items-center justify-center rounded-lg bg-muted text-foreground',
        !icon && 'text-muted-foreground',
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}
