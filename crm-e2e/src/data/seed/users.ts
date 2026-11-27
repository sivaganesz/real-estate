/** The seven demo users (foundation-plan §6.2). Fictional people; phones are valid-looking Indian mobiles, emails @example.com. */
import type { User } from '@/domain/types'
import type { Clock } from './dates'

export const ADMIN_ID = 'u-admin'
export const MANAGER_ID = 'u-rohit'
export const ARJUN = 'u-arjun'
export const SNEHA = 'u-sneha'
export const VIKRAM = 'u-vikram'
export const FARHAN = 'u-farhan'
export const KAVYA = 'u-kavya'
/** The three executives the profile switcher offers (Farhan is on leave, Kavya is deactivated). */
export const SWITCHABLE_EXECUTIVES = [ARJUN, SNEHA, VIKRAM]

export function seedUsers(c: Clock): User[] {
  return [
    {
      id: ADMIN_ID, name: 'Meera Iyer', role: 'admin', email: 'meera.iyer@example.com', phone: '+919840012301',
      status: 'active', availability: 'available', languages: ['English', 'Tamil', 'Hindi'],
      cities: ['Bengaluru', 'Chennai', 'Hyderabad', 'Pune', 'Mumbai', 'NCR'], propertyFocus: ['residential', 'commercial', 'land'],
      joinedAt: c.day(-900),
    },
    {
      id: MANAGER_ID, name: 'Rohit Khanna', role: 'manager', email: 'rohit.khanna@example.com', phone: '+919811023402',
      status: 'active', availability: 'available', languages: ['English', 'Hindi'],
      cities: ['Bengaluru', 'Chennai', 'Hyderabad', 'Pune', 'Mumbai', 'NCR'], propertyFocus: ['residential', 'commercial', 'land'],
      targets: { calls: 1500, siteVisits: 55, bookings: 8, revenue: 90_000_000 },
      joinedAt: c.day(-720),
    },
    {
      id: ARJUN, name: 'Arjun Mehta', role: 'executive', managerId: MANAGER_ID, email: 'arjun.mehta@example.com', phone: '+919845012345',
      status: 'active', availability: 'available', languages: ['English', 'Hindi', 'Kannada'],
      cities: ['Bengaluru'], propertyFocus: ['residential'],
      targets: { calls: 600, siteVisits: 20, bookings: 3, revenue: 35_000_000 },
      joinedAt: c.day(-540),
    },
    {
      id: SNEHA, name: 'Sneha Reddy', role: 'executive', managerId: MANAGER_ID, email: 'sneha.reddy@example.com', phone: '+919849056781',
      status: 'active', availability: 'available', languages: ['English', 'Telugu', 'Tamil'],
      cities: ['Hyderabad', 'Chennai'], propertyFocus: ['residential', 'commercial'],
      targets: { calls: 500, siteVisits: 18, bookings: 3, revenue: 30_000_000 },
      joinedAt: c.day(-480),
    },
    {
      id: VIKRAM, name: 'Vikram Singh', role: 'executive', managerId: MANAGER_ID, email: 'vikram.singh@example.com', phone: '+919822034567',
      status: 'active', availability: 'inVisit', languages: ['English', 'Hindi', 'Marathi'],
      cities: ['Pune', 'Mumbai', 'NCR'], propertyFocus: ['residential'],
      targets: { calls: 500, siteVisits: 18, bookings: 2, revenue: 30_000_000 },
      joinedAt: c.day(-400),
    },
    {
      id: FARHAN, name: 'Farhan Qureshi', role: 'executive', managerId: MANAGER_ID, email: 'farhan.qureshi@example.com', phone: '+919867045612',
      status: 'active', availability: 'onLeave', leaveUntil: c.day(3), languages: ['English', 'Hindi', 'Urdu'],
      cities: ['Mumbai', 'NCR'], propertyFocus: ['residential'],
      targets: { calls: 400, siteVisits: 15, bookings: 2, revenue: 20_000_000 },
      joinedAt: c.day(-300),
    },
    {
      id: KAVYA, name: 'Kavya Joshi', role: 'executive', managerId: MANAGER_ID, email: 'kavya.joshi@example.com', phone: '+918879023456',
      status: 'deactivated', deactivatedAt: c.ago(5, 'days'), availability: 'available', languages: ['English', 'Marathi'],
      cities: ['Pune'], propertyFocus: ['residential'],
      joinedAt: c.day(-260),
    },
  ]
}
