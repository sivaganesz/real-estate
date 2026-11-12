import {
  canChangeStatus,
  CLOSED_STATUS_FOR,
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUSES,
  PURPOSE_LABELS,
  toSqft,
} from '@real-estate/shared';
import type {
  BulkStatusResult,
  CreateProperty,
  ListPropertiesQuery,
  LocationSuggestion,
  PageMeta,
  Property,
  PropertyHistoryEntry,
  PropertyListItem,
  PropertyStatus,
  PropertyStatusCounts,
  UpdateProperty,
} from '@real-estate/shared';
import { AppError, businessRule, notFound, validationError } from '../../lib/errors';
import type { ErrorDetail } from '../../lib/errors';
import { pageMeta, pageSkip, parseSort } from '../../lib/http';
import type { StorageProvider } from '../../lib/storage';
import { ChangeLogModel } from '../changeLogs/changeLog.model';
import { diffFields, recordChange } from '../changeLogs/changeLog.service';
import type { SubcategoryDoc } from '../propertyTypes/propertyTypes.model';
import { PropertySubcategoryModel } from '../propertyTypes/propertyTypes.model';
import type { FormDefinition, PropertyTypesService } from '../propertyTypes/propertyTypes.service';
import { UserModel } from '../users/user.model';
import type { MediaDoc, PropertyDoc } from './property.model';
import { nextPropertyCode, PropertyModel, sortMedia } from './property.model';
import {
  checkAmenities,
  checkExtraAttributes,
  checkPurpose,
  checkRemovedAttributes,
  mergeAttributeValues,
  publishIssues,
} from './propertyRules';

const SORTABLE = ['updatedAt', 'createdAt', 'price.amount', 'area.sqft', 'title', 'code'] as const;
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactly = (text: string) => new RegExp(`^${escapeRegex(text)}$`, 'i');
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

/** The fields compared for the change history. Attribute values are listed one by one. */
function snapshot(
  p: Pick<
    PropertyDoc,
    | 'title'
    | 'purpose'
    | 'subcategoryId'
    | 'price'
    | 'rental'
    | 'area'
    | 'location'
    | 'isFeatured'
    | 'amenityIds'
    | 'extraAttributes'
    | 'removedAttributeKeys'
    | 'attributeValues'
  >,
) {
  const flat: Record<string, unknown> = {
    title: p.title,
    purpose: p.purpose,
    subcategoryId: p.subcategoryId,
    price: p.price,
    rental: p.rental ?? null,
    area: p.area ?? null,
    location: p.location,
    isFeatured: p.isFeatured,
    amenityIds: p.amenityIds,
    extraAttributes: p.extraAttributes,
    removedAttributeKeys: p.removedAttributeKeys ?? [],
  };
  for (const [key, value] of Object.entries(p.attributeValues ?? {}))
    flat[`attributes.${key}`] = value;
  return flat;
}

function changesBetween(before: Record<string, unknown>, after: Record<string, unknown>) {
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const normalized = (o: Record<string, unknown>) =>
    Object.fromEntries(fields.map((f) => [f, o[f] === undefined ? null : o[f]]));
  return diffFields(normalized(before), normalized(after), fields);
}

/**
 * Properties (Phase 2.2): create as Draft, edit, list with search and filters, status
 * changes with the publish rules, duplicate, archive and change history.
 */
export class PropertiesService {
  private readonly propertyTypes: PropertyTypesService;
  private readonly storage: StorageProvider;

  constructor(deps: { propertyTypes: PropertyTypesService; storage: StorageProvider }) {
    this.propertyTypes = deps.propertyTypes;
    this.storage = deps.storage;
  }

  // ---------------------------------------------------------------- read

  async list(query: ListPropertiesQuery): Promise<{ items: PropertyListItem[]; meta: PageMeta }> {
    const filter: Record<string, unknown> = {
      status: query.status ?? { $ne: 'archived' },
    };
    if (query.categoryKey) filter.categoryKey = query.categoryKey;
    if (query.subcategoryId) filter.subcategoryId = query.subcategoryId;
    if (query.purpose) filter.purpose = query.purpose;
    if (query.featured !== undefined) filter.isFeatured = query.featured;
    if (query.city) filter['location.city'] = exactly(query.city);
    if (query.locality) filter['location.locality'] = exactly(query.locality);
    if (query.pincode) filter['location.pincode'] = query.pincode;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter['price.amount'] = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    }
    if (query.q) {
      const contains = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = ['code', 'title', 'location.city', 'location.locality', 'location.pincode'].map(
        (field) => ({ [field]: contains }),
      );
    }
    const sort = parseSort(query.sort, SORTABLE, { updatedAt: -1 });
    const [docs, total] = await Promise.all([
      PropertyModel.find(filter)
        .sort({ ...sort, _id: -1 })
        .skip(pageSkip(query.page, query.limit))
        .limit(query.limit)
        .lean<PropertyDoc[]>(),
      PropertyModel.countDocuments(filter),
    ]);
    const names = await this.subcategoryNames(docs.map((d) => d.subcategoryId));
    return {
      items: docs.map((d) => ({
        id: d._id,
        code: d.code,
        title: d.title,
        categoryKey: d.categoryKey,
        subcategoryId: d.subcategoryId,
        subcategoryName: names.get(d.subcategoryId) ?? '',
        purpose: d.purpose,
        price: d.price,
        area: d.area ?? null,
        location: {
          city: d.location.city,
          locality: d.location.locality,
          pincode: d.location.pincode,
        },
        coverUrl: this.coverUrl(d.media ?? []),
        status: d.status,
        isFeatured: d.isFeatured,
        updatedAt: d.updatedAt.toISOString(),
      })),
      meta: pageMeta(total, query.page, query.limit),
    };
  }

  /** Numbers for the status tabs. "all" leaves out archived properties, like the list. */
  async statusCounts(): Promise<PropertyStatusCounts> {
    const rows = await PropertyModel.aggregate<{ _id: PropertyStatus; n: number }>([
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]);
    const counts = Object.fromEntries(PROPERTY_STATUSES.map((s) => [s, 0])) as PropertyStatusCounts;
    for (const r of rows) counts[r._id] = r.n;
    counts.all = PROPERTY_STATUSES.filter((s) => s !== 'archived').reduce(
      (sum, s) => sum + counts[s],
      0,
    );
    return counts;
  }

  async get(id: string): Promise<Property> {
    return this.toResponse(await this.find(id));
  }

  async history(id: string): Promise<PropertyHistoryEntry[]> {
    await this.find(id);
    const logs = await ChangeLogModel.find({ entity: 'property', entityId: id })
      .sort({ at: -1 })
      .limit(200)
      .lean<
        {
          _id: string;
          action: string;
          changes?: Record<string, [unknown, unknown]>;
          at: Date;
          actorId?: string;
        }[]
      >();
    const users = await this.userNames(logs.map((l) => l.actorId));
    return logs.map((l) => ({
      id: l._id,
      action: l.action,
      changes: l.changes ?? null,
      at: l.at.toISOString(),
      by: l.actorId && users.has(l.actorId) ? { id: l.actorId, name: users.get(l.actorId)! } : null,
    }));
  }

  /** Values already used (e.g. cities), most used first, so admins keep spellings consistent. */
  async locationSuggestions(
    field: 'state' | 'city' | 'locality' | 'pincode',
    q: string,
    city?: string,
  ): Promise<LocationSuggestion[]> {
    const path = `location.${field}`;
    const match: Record<string, unknown> = {
      [path]: q ? new RegExp(`^${escapeRegex(q)}`, 'i') : { $ne: '' },
    };
    if (city && field !== 'city' && field !== 'state') match['location.city'] = exactly(city);
    const rows = await PropertyModel.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $match: { [path]: { $ne: '' } } },
      {
        $group: {
          _id: { $toLower: `$${path}` },
          value: { $first: `$${path}` },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, value: 1 } },
      { $limit: 10 },
      { $project: { _id: '$value', count: 1 } },
    ]);
    return rows.map((r) => ({ value: r._id, count: r.count }));
  }

  // ---------------------------------------------------------------- write

  /**
   * The problems `create` would report for this input, without saving anything (used by
   * bulk import to check every row first). Empty = it can be saved.
   */
  async problemsForNew(input: CreateProperty, definition?: FormDefinition): Promise<ErrorDetail[]> {
    try {
      const def = definition ?? (await this.propertyTypes.definitionFor(input.subcategoryId));
      this.assertCanList(def);
      this.checkInput(def, input, {}, []);
      return [];
    } catch (err) {
      if (err instanceof AppError)
        return err.details?.length ? err.details : [{ path: '', message: err.message }];
      throw err;
    }
  }

  async create(actorId: string, input: CreateProperty): Promise<Property> {
    const definition = await this.propertyTypes.definitionFor(input.subcategoryId);
    this.assertCanList(definition);
    const values = this.checkInput(definition, input, {}, []);
    const code = await nextPropertyCode(definition.subcategory.codePrefix);
    const now = new Date();
    const doc = await PropertyModel.create({
      code,
      categoryKey: definition.category.key,
      subcategoryId: definition.subcategory._id,
      title: input.title,
      purpose: input.purpose,
      price: input.price,
      rental: input.purpose === 'sale' ? null : input.rental,
      area: input.area ? { ...input.area, sqft: toSqft(input.area.value, input.area.unit) } : null,
      location: input.location,
      attributeValues: values.attributeValues,
      extraAttributes: values.extraAttributes,
      removedAttributeKeys: values.removedAttributeKeys,
      amenityIds: values.amenityIds,
      status: 'draft',
      isFeatured: input.isFeatured,
      statusChangedAt: now,
      createdBy: actorId,
      updatedBy: actorId,
    });
    await recordChange({
      actorId,
      entity: 'property',
      entityId: doc._id,
      action: 'created',
      changes: { code: [null, code], title: [null, input.title] },
    });
    return this.get(doc._id);
  }

  async update(actorId: string, id: string, input: UpdateProperty): Promise<Property> {
    const before = await this.find(id);
    if (before.status === 'archived') {
      throw businessRule("Archived properties can't be edited. Restore it as a draft first.");
    }
    const subcategoryChanged =
      input.subcategoryId !== undefined && input.subcategoryId !== before.subcategoryId;
    const definition = await this.propertyTypes.definitionFor(
      input.subcategoryId ?? before.subcategoryId,
    );
    if (subcategoryChanged) this.assertCanList(definition);

    const purpose = input.purpose ?? before.purpose;
    const values = this.checkInput(
      definition,
      {
        purpose,
        attributeValues: input.attributeValues ?? {},
        extraAttributes: input.extraAttributes ?? before.extraAttributes,
        removedAttributeKeys: input.removedAttributeKeys ?? before.removedAttributeKeys ?? [],
        // After a subcategory change, amenities it doesn't offer are dropped.
        amenityIds:
          input.amenityIds ??
          before.amenityIds.filter((a) => definition.amenities.some((x) => x._id === a)),
      },
      before.attributeValues ?? {},
      before.amenityIds,
    );

    const next: PropertyDoc = {
      ...before,
      categoryKey: definition.category.key,
      subcategoryId: definition.subcategory._id,
      title: input.title ?? before.title,
      purpose,
      price: input.price ?? before.price,
      rental: purpose === 'sale' ? null : input.rental !== undefined ? input.rental : before.rental,
      area:
        input.area === undefined
          ? before.area
          : input.area && { ...input.area, sqft: toSqft(input.area.value, input.area.unit) },
      location: input.location ?? before.location,
      attributeValues: values.attributeValues,
      extraAttributes: values.extraAttributes,
      removedAttributeKeys: values.removedAttributeKeys,
      amenityIds: values.amenityIds,
      isFeatured: input.isFeatured ?? before.isFeatured,
    };

    // A published property must stay complete: it is visible to the AI agent.
    if (before.status === 'published') {
      const issues = publishIssues(definition, next);
      if (issues.length > 0) {
        throw new AppError(
          422,
          'PUBLISH_BLOCKED',
          'This property is published, so these details are needed. Unpublish it first to save it incomplete.',
          issues,
        );
      }
    }

    const changes = changesBetween(snapshot(before), snapshot(next));
    if (Object.keys(changes).length === 0) return this.toResponse(before, definition);
    await PropertyModel.updateOne(
      { _id: id },
      {
        $set: {
          categoryKey: next.categoryKey,
          subcategoryId: next.subcategoryId,
          title: next.title,
          purpose: next.purpose,
          price: next.price,
          rental: next.rental,
          area: next.area,
          location: next.location,
          attributeValues: next.attributeValues,
          extraAttributes: next.extraAttributes,
          removedAttributeKeys: next.removedAttributeKeys,
          amenityIds: next.amenityIds,
          isFeatured: next.isFeatured,
          updatedBy: actorId,
        },
      },
    );
    if (changes.subcategoryId) {
      changes.subcategoryId = [
        (await this.subcategoryNames([before.subcategoryId])).get(before.subcategoryId) ??
          before.subcategoryId,
        definition.subcategory.name,
      ];
    }
    await recordChange({ actorId, entity: 'property', entityId: id, action: 'updated', changes });
    return this.get(id);
  }

  async changeStatus(actorId: string, id: string, to: PropertyStatus): Promise<Property> {
    const before = await this.find(id);
    if (before.status === to) return this.toResponse(before);
    if (!canChangeStatus(before.status, to, before.purpose)) {
      const closing: readonly PropertyStatus[] = ['sold', 'rented', 'leased'];
      throw businessRule(
        closing.includes(to) && CLOSED_STATUS_FOR[before.purpose] !== to
          ? `A property for ${PURPOSE_LABELS[before.purpose]} is marked ${PROPERTY_STATUS_LABELS[CLOSED_STATUS_FOR[before.purpose]]}, not ${PROPERTY_STATUS_LABELS[to]}.`
          : `A ${PROPERTY_STATUS_LABELS[before.status]} property can't be marked ${PROPERTY_STATUS_LABELS[to]}.`,
      );
    }
    if (to === 'published') {
      const definition = await this.propertyTypes.definitionFor(before.subcategoryId);
      this.assertCanList(definition);
      const issues = publishIssues(definition, before);
      if (issues.length > 0) {
        throw new AppError(
          422,
          'PUBLISH_BLOCKED',
          'Fill in the missing details before publishing.',
          issues,
        );
      }
    }
    const now = new Date();
    await PropertyModel.updateOne(
      { _id: id, status: before.status },
      {
        $set: {
          status: to,
          statusChangedAt: now,
          updatedBy: actorId,
          ...(to === 'published' && !before.publishedAt ? { publishedAt: now } : {}),
        },
      },
    );
    await recordChange({
      actorId,
      entity: 'property',
      entityId: id,
      action: to === 'archived' ? 'archived' : 'status_changed',
      changes: { status: [before.status, to] },
    });
    return this.get(id);
  }

  /** Changes the status of several properties; each one that can't change says why. */
  async bulkStatus(actorId: string, ids: string[], to: PropertyStatus): Promise<BulkStatusResult> {
    const result: BulkStatusResult = { updated: [], failed: [] };
    for (const id of new Set(ids)) {
      try {
        const p = await this.changeStatus(actorId, id, to);
        result.updated.push({ id, code: p.code });
      } catch (err) {
        const doc = await PropertyModel.findById(id).select('code').lean<{ code: string }>();
        const reason =
          err instanceof AppError
            ? err.code === 'PUBLISH_BLOCKED' && err.details?.length
              ? err.details.map((d) => d.message).join('; ')
              : err.message
            : 'Something went wrong';
        result.failed.push({ id, code: doc?.code ?? null, reason });
      }
    }
    return result;
  }

  /** A copy as a new Draft with a new code (photos are not copied). */
  async duplicate(actorId: string, id: string): Promise<Property> {
    const source = await this.find(id);
    const definition = await this.propertyTypes.definitionFor(source.subcategoryId);
    this.assertCanList(definition);
    const code = await nextPropertyCode(definition.subcategory.codePrefix);
    const copyTitle = `${source.title} (copy)`.slice(0, 150);
    const doc = await PropertyModel.create({
      code,
      categoryKey: source.categoryKey,
      subcategoryId: source.subcategoryId,
      title: copyTitle,
      purpose: source.purpose,
      price: source.price,
      rental: source.rental,
      area: source.area,
      location: source.location,
      attributeValues: source.attributeValues,
      extraAttributes: source.extraAttributes,
      removedAttributeKeys: source.removedAttributeKeys ?? [],
      amenityIds: source.amenityIds,
      media: [],
      status: 'draft',
      isFeatured: false,
      statusChangedAt: new Date(),
      createdBy: actorId,
      updatedBy: actorId,
    });
    await recordChange({
      actorId,
      entity: 'property',
      entityId: doc._id,
      action: 'duplicated',
      changes: { code: [source.code, code] },
    });
    return this.get(doc._id);
  }

  // ---------------------------------------------------------------- helpers

  private async find(id: string): Promise<PropertyDoc> {
    const doc = await PropertyModel.findById(id).lean<PropertyDoc>();
    if (!doc) throw notFound('Property not found');
    return doc;
  }

  /** New listings need an active category and subcategory. */
  private assertCanList(definition: FormDefinition): void {
    if (!definition.category.isActive) {
      throw businessRule(
        `${definition.category.name} is set up later. For now, only Residential properties can be added.`,
      );
    }
    if (!definition.subcategory.isActive) {
      throw businessRule(
        `${definition.subcategory.name} is inactive. Activate it in Settings first.`,
      );
    }
  }

  /** Checks purpose, attribute values, extra attributes and amenities together. */
  private checkInput(
    definition: FormDefinition,
    input: Pick<
      CreateProperty,
      'purpose' | 'attributeValues' | 'extraAttributes' | 'amenityIds' | 'removedAttributeKeys'
    >,
    storedValues: PropertyDoc['attributeValues'],
    tickedAmenities: string[],
  ) {
    const errors: ErrorDetail[] = [...checkPurpose(definition, input.purpose)];
    const removed = checkRemovedAttributes(definition, input.removedAttributeKeys);
    const attributes = mergeAttributeValues(definition, storedValues, input.attributeValues);
    const extras = checkExtraAttributes(definition, input.extraAttributes);
    const amenities = checkAmenities(definition, input.amenityIds, tickedAmenities);
    errors.push(...removed.errors, ...attributes.errors, ...extras.errors, ...amenities.errors);
    if (errors.length > 0) throw validationError(errors);
    // Removing an attribute from the property clears its value.
    for (const key of removed.values) delete attributes.values[key];
    return {
      attributeValues: attributes.values,
      extraAttributes: extras.values,
      amenityIds: amenities.values,
      removedAttributeKeys: removed.values,
    };
  }

  private async toResponse(doc: PropertyDoc, known?: FormDefinition): Promise<Property> {
    const definition = known ?? (await this.propertyTypes.definitionFor(doc.subcategoryId));
    const shown = new Set(definition.attributes.map((a) => a.attribute.key));
    const users = await this.userNames([doc.createdBy ?? undefined, doc.updatedBy ?? undefined]);
    const ref = (id?: string | null) => (id && users.has(id) ? { id, name: users.get(id)! } : null);
    return {
      id: doc._id,
      code: doc.code,
      categoryKey: doc.categoryKey,
      subcategoryId: doc.subcategoryId,
      subcategoryName: definition.subcategory.name,
      title: doc.title,
      purpose: doc.purpose,
      price: doc.price,
      rental: doc.rental ?? null,
      area: doc.area ?? null,
      location: { ...doc.location, mapPin: doc.location.mapPin ?? null },
      attributeValues: doc.attributeValues ?? {},
      hiddenAttributeKeys: Object.keys(doc.attributeValues ?? {}).filter((k) => !shown.has(k)),
      extraAttributes: doc.extraAttributes ?? [],
      removedAttributeKeys: doc.removedAttributeKeys ?? [],
      amenityIds: doc.amenityIds ?? [],
      media: sortMedia(doc.media ?? []).map((m) => ({
        id: m._id,
        kind: m.kind,
        url: this.storage.publicUrl(m.path),
        thumbUrl: m.thumbPath ? this.storage.publicUrl(m.thumbPath) : null,
        mediumUrl: m.mediumPath ? this.storage.publicUrl(m.mediumPath) : null,
        originalName: m.originalName ?? '',
        mime: m.mime ?? '',
        sizeBytes: m.sizeBytes ?? 0,
        isCover: m.isCover,
      })),
      status: doc.status,
      isFeatured: doc.isFeatured,
      publishIssues: publishIssues(definition, doc),
      publishedAt: iso(doc.publishedAt),
      statusChangedAt: iso(doc.statusChangedAt)!,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      createdBy: ref(doc.createdBy),
      updatedBy: ref(doc.updatedBy),
    };
  }

  /** The cover photo's small version, for list rows. */
  private coverUrl(media: MediaDoc[]): string | null {
    const cover = media.find((m) => m.isCover && m.kind === 'image');
    if (!cover) return null;
    return this.storage.publicUrl(cover.thumbPath ?? cover.path);
  }

  private async subcategoryNames(ids: string[]): Promise<Map<string, string>> {
    const subs = await PropertySubcategoryModel.find({ _id: { $in: [...new Set(ids)] } })
      .select('name')
      .lean<Pick<SubcategoryDoc, '_id' | 'name'>[]>();
    return new Map(subs.map((s) => [s._id, s.name]));
  }

  private async userNames(ids: (string | undefined)[]): Promise<Map<string, string>> {
    const wanted = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    if (wanted.length === 0) return new Map();
    const users = await UserModel.find({ _id: { $in: wanted } })
      .select('name')
      .lean<{ _id: string; name: string }[]>();
    return new Map(users.map((u) => [u._id, u.name]));
  }
}
