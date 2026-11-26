import { relativeDay } from '@estate/shared';
import type { BuyerSegment, LeadSource, Requirement, Stage, Temperature } from '@estate/shared';
import type { Tone } from '../components/ui';

export type Lead = {
  id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  source: LeadSource;
  ownerId: string | null;
  ownerName: string | null;
  stage: Stage;
  stageChangedAt: string;
  daysInStage: number;
  stale: boolean;
  overdue: boolean;
  /** How ready to buy, 0 to 100 (see leadScore). */
  score: number;
  segment: BuyerSegment;
  temperature: Temperature;
  requirement: Partial<Requirement>;
  summary: string;
  qualified: boolean;
  lostReason?: string;
  lostNote?: string;
  enquiries: { at: string; source: string; message?: string }[];
  lastContactAt?: string;
  nextAction?: { activityId: string; type: string; dueAt: string; title?: string } | null;
  shortlist: { propertyId: string; status: 'suggested' | 'shared' | 'visited' | 'liked' | 'rejected'; note?: string; at: string }[];
  createdAt: string;
};

export type TimelineItem = {
  id: string;
  at: string;
  kind: 'activity' | 'event';
  type: string;
  title: string;
  body?: string;
  by?: string;
  viaAI?: boolean;
  status?: string;
  scheduledAt?: string;
  outcome?: string;
  feedback?: { interest?: string; liked?: string; concerns?: string };
  properties?: { id: string; title: string }[];
};

export const STAGE_TONE: Record<Stage, Tone> = {
  new: 'blue',
  contacted: 'slate',
  qualified: 'brand',
  visit: 'ai',
  negotiation: 'amber',
  booked: 'green',
  lost: 'red',
};

export const TEMP_DOT: Record<Temperature, string> = { hot: 'bg-rose-500', warm: 'bg-amber-400', cold: 'bg-sky-400' };

export const waLink = (phone: string, text = '') => `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const prettyPhone = (p: string) => p.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2');

/** "spoke yesterday", "spoke 16 Nov": lower-case only the relative words. */
export const relLower = (d: string | Date) => relativeDay(d).replace(/^(Today|Tomorrow|Yesterday|\w+day)$|^(\d+ days ago)$/, (m) => m.toLowerCase());
