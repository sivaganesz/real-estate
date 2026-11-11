import { DEFAULT_COMPANY_SETTINGS } from './company.defaults';
import { SettingsModel } from './settings.model';

/** Company name for emails and page titles. Falls back to the default before setup. */
export async function getCompanyName(): Promise<string> {
  const doc = await SettingsModel.findOne({ key: 'company' }).lean();
  const name = (doc?.value as { name?: unknown } | undefined)?.name;
  return typeof name === 'string' && name.trim() ? name : DEFAULT_COMPANY_SETTINGS.name;
}
