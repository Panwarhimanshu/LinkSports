import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | undefined | null, fmt = 'MMM dd, yyyy') {
  if (!date) return '—';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '—' : format(d, fmt);
}

export function formatRelativeTime(date: string | Date | undefined | null) {
  if (!date) return '';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '' : formatDistanceToNow(d, { addSuffix: true });
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

export function getPhotoUrl(photo: string | null | undefined): string | null {
  if (!photo) return null;
  // full URLs and inline images (data:/blob:, e.g. photos stored without Cloudinary) are used as-is
  if (/^(https?:|data:|blob:)/.test(photo)) return photo;
  return `${BACKEND_URL}/${photo.replace(/^\/+/, '')}`;
}

export function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function getRoleBadgeColor(role: string) {
  switch (role) {
    case 'athlete': return 'bg-blue-100 text-blue-800';
    case 'coach': return 'bg-blue-100 text-blue-800';
    case 'professional': return 'bg-blue-100 text-blue-800';
    case 'organization': return 'bg-orange-100 text-orange-800';
    case 'admin': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export function getListingTypeBadge(type: string) {
  switch (type) {
    case 'trial': return { label: 'Trial', color: 'bg-blue-100 text-blue-800' };
    case 'event': return { label: 'Event', color: 'bg-blue-100 text-blue-800' };
    case 'tournament': return { label: 'Tournament', color: 'bg-blue-100 text-blue-800' };
    case 'admission': return { label: 'Admission', color: 'bg-orange-100 text-orange-800' };
    default: return { label: type, color: 'bg-gray-100 text-gray-800' };
  }
}

export function getStatusBadge(status: string) {
  switch (status) {
    case 'published': return { label: 'Active', color: 'bg-blue-100 text-blue-800' };
    case 'pending': return { label: 'Under Review', color: 'bg-orange-100 text-orange-800' };
    case 'draft': return { label: 'Draft', color: 'bg-gray-100 text-gray-800' };
    case 'closed': return { label: 'Closed', color: 'bg-red-100 text-red-800' };
    case 'completed': return { label: 'Completed', color: 'bg-blue-100 text-blue-800' };
    case 'cancelled': return { label: 'Cancelled', color: 'bg-red-100 text-red-800' };
    case 'applied': return { label: 'Applied', color: 'bg-blue-100 text-blue-800' };
    case 'shortlisted': return { label: 'Shortlisted', color: 'bg-blue-100 text-blue-800' };
    case 'rejected': return { label: 'Not Selected', color: 'bg-red-100 text-red-800' };
    default: return { label: status, color: 'bg-gray-100 text-gray-800' };
  }
}

export const SPORTS_LIST = [
  'Cricket', 'Football', 'Basketball', 'Tennis', 'Badminton', 'Volleyball',
  'Hockey', 'Kabaddi', 'Wrestling', 'Boxing', 'Athletics', 'Swimming',
  'Cycling', 'Archery', 'Shooting', 'Weightlifting', 'Gymnastics',
  'Table Tennis', 'Squash', 'Golf', 'Rowing', 'Sailing', 'Equestrian',
  'Judo', 'Taekwondo', 'Fencing', 'Triathlon', 'Rugby', 'Handball',
  'Kho Kho', 'Mallakhamb', 'Yoga Sports', 'Other',
];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh',
];

/** A link that is safe to put in href: http(s) only. Blocks javascript:, data: and similar, returns '' otherwise. */
export function safeHref(url?: string | null): string {
  if (!url) return '';
  try {
    const u = new URL(String(url).trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch {
    return '';
  }
}
