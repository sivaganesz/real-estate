import {
  legalSummary,
  mergeLegalChecks,
  pricePerSqft,
  propertySearchText,
} from '@real-estate/shared';
import type { LegalChecklistItem, PropertyLegalCheck } from '@real-estate/shared';
import { ensureStartingPropertyTypes } from '../modules/propertyTypes/propertyTypes.defaults';
import { PropertySubcategoryModel } from '../modules/propertyTypes/propertyTypes.model';
import { RolesService } from '../modules/roles/roles.service';
import { ImportBatchModel } from '../modules/imports/importBatch.model';
import { PropertyModel } from '../modules/properties/property.model';
import { UserModel } from '../modules/users/user.model';
import type { Migration } from './runner';

/**
 * Every migration, in order. Append new ones; never edit or reorder one that has shipped.
 * `pnpm migrate` applies the pending ones (TRD §7.13).
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    id: '0001-starting-property-types',
    description: 'Starting property types and amenities (previously created at every boot)',
    up: async () => {
      await ensureStartingPropertyTypes();
    },
  },
  {
    id: '0002-roles',
    description:
      'Roles in the database: Admin, Sales Manager, Sales Executive (D4). Super Admin → Admin, Sales Agent → Sales Executive',
    // No down step: after it, former Super Admins and office Admins are both "admin".
    up: async () => {
      await RolesService.ensureSystemRoles();
      await UserModel.updateMany({ role: 'super_admin' }, { $set: { role: 'admin' } });
      await UserModel.updateMany({ role: 'sales_agent' }, { $set: { role: 'sales_executive' } });
    },
  },
  // From here on migrations use the raw collections: they deal with values the current
  // schemas no longer accept.
  {
    id: '0003-property-statuses',
    description:
      'Property statuses v2 (D1): Published → Available, Unpublished → On hold; import option "published" → "available"',
    up: async () => {
      await PropertyModel.collection.updateMany(
        { status: 'published' },
        { $set: { status: 'available' } },
      );
      await PropertyModel.collection.updateMany(
        { status: 'unpublished' },
        { $set: { status: 'on_hold' } },
      );
      await ImportBatchModel.collection.updateMany(
        { importAs: 'published' },
        { $set: { importAs: 'available' } },
      );
    },
    down: async () => {
      const v2Only = await PropertyModel.collection.countDocuments({
        status: { $in: ['under_negotiation', 'reserved'] },
      });
      if (v2Only > 0) {
        throw new Error(
          `${v2Only} properties use statuses v1 doesn't have (Under negotiation, Reserved). Change them first.`,
        );
      }
      await PropertyModel.collection.updateMany(
        { status: 'available' },
        { $set: { status: 'published' } },
      );
      await PropertyModel.collection.updateMany(
        { status: 'on_hold' },
        { $set: { status: 'unpublished' } },
      );
      await ImportBatchModel.collection.updateMany(
        { importAs: 'available' },
        { $set: { importAs: 'published' } },
      );
    },
  },
  {
    id: '0004-property-v2-fields',
    description:
      'Property v2 fields: legal checks from the type checklist, price per sq.ft., legal summary, search text, road and valuation defaults',
    up: async () => {
      const subs = new Map(
        (await PropertySubcategoryModel.collection.find().toArray()).map((s) => [
          String(s._id),
          (s.legalChecklist ?? []) as LegalChecklistItem[],
        ]),
      );
      const cursor = PropertyModel.collection.find({});
      for await (const p of cursor) {
        // Idempotent: checks already on a property are kept as they are.
        const legal = mergeLegalChecks(
          (p.legal ?? []) as PropertyLegalCheck[],
          subs.get(String(p.subcategoryId)) ?? [],
        );
        await PropertyModel.collection.updateOne(
          { _id: p._id },
          {
            $set: {
              legal,
              legalSummary: legalSummary(legal),
              pricePerSqft: pricePerSqft({
                purpose: p.purpose,
                price: p.price ?? { amount: null, basis: 'total' },
                areaSqft: p.area?.sqft,
              }),
              searchText: propertySearchText({
                code: p.code ?? '',
                title: p.title ?? '',
                location: p.location ?? {},
              }),
              'location.roadType': p.location?.roadType ?? '',
              'location.roadWidthFt': p.location?.roadWidthFt ?? null,
              highway: p.highway ?? null,
              nearby: p.nearby ?? [],
              valuation: p.valuation ?? {
                reviewDate: null,
                valuerReport: '',
                notes: '',
                comparables: [],
              },
              archive: p.archive ?? null,
            },
          },
        );
      }
    },
  },
];
