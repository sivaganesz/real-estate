import { Bus, GraduationCap, Hospital, Milestone, School, ShoppingBag, ShoppingBasket, Store, TrainFront, TramFront, type LucideIcon } from 'lucide-react';
import type { PlaceCategory, PlaceKind } from '@estate/shared';

/** An icon for each kind of nearby place (team explorer and buyer share page). */
export const KIND_ICON: Record<PlaceKind, LucideIcon> = {
  bus: Bus,
  train: TrainFront,
  metro: TramFront,
  road: Milestone,
  school: School,
  college: GraduationCap,
  hospital: Hospital,
  shop: ShoppingBasket,
  mall: ShoppingBag,
  market: Store,
};

export const CATEGORY_ICON: Record<PlaceCategory, LucideIcon> = { commute: Bus, schools: GraduationCap, hospitals: Hospital, shopping: ShoppingBasket };
