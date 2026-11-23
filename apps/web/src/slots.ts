import type { ComponentType } from 'react';
import type { Property } from './lib/property';

/**
 * Places where later modules add panels without editing the page itself,
 * e.g. matching adds "Buyers who fit" to every property page.
 */
export const slots = {
  propertyTop: [] as ComponentType<{ property: Property }>[],
  propertySide: [] as ComponentType<{ property: Property }>[],
};
