import { CONTACT_INFO } from '@/lib/constants';

/** Recipient for internal sale notifications; env overrides the public contact fallback. */
export function getSalesNotificationEmail(): string {
  return String(process.env.SALES_NOTIFICATION_EMAIL ?? '').trim() || String(CONTACT_INFO.email ?? '').trim();
}
