import {
  attributeKeyFromLabel,
  CORE_ATTRIBUTE_KEYS,
  CORE_ATTRIBUTES,
  normalizeLabel,
  TYPES_WITH_OPTIONS,
} from '@real-estate/shared';
import type {
  AddAttribute,
  Amenity,
  AttributeMatch,
  CategoryKey,
  CreateAmenity,
  CreateSubcategory,
  PlacedAttribute,
  PropertyTypes,
  UpdateAmenity,
  UpdateAttribute,
  UpdateSubcategory,
} from '@real-estate/shared';
import { AppError, businessRule, conflict, notFound, validationError } from '../../lib/errors';
import type { FieldChanges } from '../changeLogs/changeLog.service';
import { diffFields, recordChange } from '../changeLogs/changeLog.service';
import type {
  AmenityDoc,
  AttributeDoc,
  CategoryDoc,
  Placement,
  SubcategoryDoc,
} from './propertyTypes.model';
import {
  AmenityModel,
  PropertyAttributeModel,
  PropertyCategoryModel,
  PropertySubcategoryModel,
} from './propertyTypes.model';
import type { PropertyUsage } from './propertyUsage';

/** Where attributes are placed: a category's common attributes, or one subcategory. */
export type AttributeTarget =
  { kind: 'category'; key: CategoryKey } | { kind: 'subcategory'; id: string };

/** Everything a property in one subcategory can hold (see `definitionFor`). */
export interface FormDefinition {
  category: CategoryDoc;
  subcategory: SubcategoryDoc;
  attributes: { attribute: AttributeDoc; required: boolean }[];
  amenities: AmenityDoc[];
}

interface LoadedTarget {
  kind: AttributeTarget['kind'];
  id: string;
  categoryKey: CategoryKey;
  /** For messages: "Residential (common)" or "Villa / House". */
  name: string;
  attributes: Placement[];
}

const DEFINITION_FIELDS = ['label', 'type', 'unit', 'options', 'searchFilter'] as const;

const unique = (ids: string[]) => [...new Set(ids)];

const isDuplicateKeyError = (err: unknown) =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;

/** Unit is only for numbers and options only for dropdown / multi-select. */
function cleanDefinition<
  T extends { type: AttributeDoc['type']; unit?: string | null; options?: string[] },
>(def: T) {
  return {
    ...def,
    unit: def.type === 'number' && def.unit ? def.unit : null,
    options: TYPES_WITH_OPTIONS.includes(def.type) ? (def.options ?? []) : [],
  };
}

/**
 * Settings → Property types & amenities → Categories & attributes.
 * Every change returns the full, updated setup so the page can refresh in one step.
 */
export class PropertyTypesService {
  private readonly usage: PropertyUsage;

  constructor(deps: { usage: PropertyUsage }) {
    this.usage = deps.usage;
  }

  // ---------------------------------------------------------------- read

  async getAll(): Promise<PropertyTypes> {
    const [categories, subcategories, amenities] = await Promise.all([
      PropertyCategoryModel.find().sort({ order: 1 }).lean<CategoryDoc[]>(),
      PropertySubcategoryModel.find().sort({ order: 1, createdAt: 1 }).lean<SubcategoryDoc[]>(),
      AmenityModel.find().sort({ order: 1, createdAt: 1 }).lean<AmenityDoc[]>(),
    ]);
    const amenityCounts = await this.usage.countByAmenity(amenities.map((a) => a._id));
    const attributeIds = [
      ...categories.flatMap((c) => c.attributes),
      ...subcategories.flatMap((s) => s.attributes),
    ].map((p) => p.attributeId);
    const attributes = await PropertyAttributeModel.find({ _id: { $in: attributeIds } }).lean<
      AttributeDoc[]
    >();
    const byId = new Map(attributes.map((a) => [a._id, a]));
    const counts = await this.usage.countBySubcategory(subcategories.map((s) => s._id));

    // Every place an attribute is used, to show "also in …".
    const places = new Map<string, { placeId: string; name: string }[]>();
    const addPlace = (attributeId: string, placeId: string, name: string) =>
      places.set(attributeId, [...(places.get(attributeId) ?? []), { placeId, name }]);
    for (const c of categories) {
      for (const p of c.attributes) addPlace(p.attributeId, c._id, `${c.name} (common)`);
    }
    for (const s of subcategories)
      for (const p of s.attributes) addPlace(p.attributeId, s._id, s.name);

    const present = (placeId: string, list: Placement[]): PlacedAttribute[] =>
      list.flatMap((p) => {
        const a = byId.get(p.attributeId);
        if (!a) return [];
        return [
          {
            id: a._id,
            key: a.key,
            label: a.label,
            type: a.type,
            unit: a.unit ?? null,
            options: a.options ?? [],
            searchFilter: a.searchFilter ?? false,
            required: p.required ?? false,
            usedIn: (places.get(a._id) ?? [])
              .filter((x) => x.placeId !== placeId)
              .map((x) => x.name),
          },
        ];
      });

    return {
      coreAttributes: CORE_ATTRIBUTES.map((a) => ({ ...a })),
      categories: categories.map((c) => ({
        key: c.key,
        name: c.name,
        isActive: c.isActive,
        commonAttributes: present(c._id, c.attributes),
        subcategories: subcategories
          .filter((s) => s.categoryKey === c.key)
          .map((s) => {
            const propertyCount = counts.get(s._id) ?? 0;
            return {
              id: s._id,
              categoryKey: s.categoryKey,
              name: s.name,
              codePrefix: s.codePrefix,
              purposes: s.purposes,
              isActive: s.isActive,
              propertyCount,
              prefixLocked: propertyCount > 0,
              attributes: present(s._id, s.attributes),
            };
          }),
        amenities: amenities
          .filter((a) => a.categoryKey === c.key)
          .map((a): Amenity => ({
            id: a._id,
            name: a.name,
            icon: a.icon ?? null,
            appliesToAll: a.appliesToAll,
            subcategoryIds: a.subcategoryIds ?? [],
            isActive: a.isActive,
            propertyCount: amenityCounts.get(a._id) ?? 0,
          })),
      })),
    };
  }

  /**
   * What a property in this subcategory can hold: the category's common attributes, then the
   * subcategory's own (in form order, with "required"), and the amenities offered for it.
   */
  async definitionFor(subcategoryId: string): Promise<FormDefinition> {
    const subcategory = await this.findSubcategory(subcategoryId);
    const category = await PropertyCategoryModel.findOne({
      key: subcategory.categoryKey,
    }).lean<CategoryDoc>();
    if (!category) throw notFound('Category not found');
    const placements = [...category.attributes, ...subcategory.attributes];
    const [attributes, amenities] = await Promise.all([
      PropertyAttributeModel.find({ _id: { $in: placements.map((p) => p.attributeId) } }).lean<
        AttributeDoc[]
      >(),
      AmenityModel.find({
        categoryKey: category.key,
        $or: [{ appliesToAll: true }, { subcategoryIds: subcategory._id }],
      })
        .sort({ order: 1 })
        .lean<AmenityDoc[]>(),
    ]);
    const byId = new Map(attributes.map((a) => [a._id, a]));
    return {
      category,
      subcategory,
      attributes: placements.flatMap((p) => {
        const attribute = byId.get(p.attributeId);
        return attribute ? [{ attribute, required: p.required ?? false }] : [];
      }),
      amenities,
    };
  }

  /** Existing attributes whose name contains `q`, so admins reuse instead of duplicating. */
  async searchAttributes(q: string): Promise<AttributeMatch[]> {
    const needle = normalizeLabel(q);
    if (needle.length < 2) return [];
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const [found, categories, subcategories] = await Promise.all([
      PropertyAttributeModel.find({ labelKey: { $regex: escaped } })
        .sort({ labelKey: 1 })
        .limit(8)
        .lean<AttributeDoc[]>(),
      PropertyCategoryModel.find().lean<CategoryDoc[]>(),
      PropertySubcategoryModel.find().lean<SubcategoryDoc[]>(),
    ]);
    const usedIn = (id: string) => [
      ...categories
        .filter((c) => c.attributes.some((p) => p.attributeId === id))
        .map((c) => `${c.name} (common)`),
      ...subcategories
        .filter((s) => s.attributes.some((p) => p.attributeId === id))
        .map((s) => s.name),
    ];
    return found.map((a) => ({ id: a._id, label: a.label, type: a.type, usedIn: usedIn(a._id) }));
  }

  // ---------------------------------------------------------------- subcategories

  async createSubcategory(actorId: string, input: CreateSubcategory): Promise<PropertyTypes> {
    await this.activeCategory(input.categoryKey);
    await this.assertSubcategoryUnique(input.categoryKey, input.name, input.codePrefix);
    const last = await PropertySubcategoryModel.findOne({ categoryKey: input.categoryKey })
      .sort({ order: -1 })
      .lean<SubcategoryDoc>();
    let created;
    try {
      created = await PropertySubcategoryModel.create({
        ...input,
        nameKey: normalizeLabel(input.name),
        order: (last?.order ?? -1) + 1,
        attributes: [],
        createdBy: actorId,
        updatedBy: actorId,
      });
    } catch (err) {
      if (isDuplicateKeyError(err))
        throw conflict('That name or code prefix is already used.', 'DUPLICATE');
      throw err;
    }
    await recordChange({
      actorId,
      entity: 'propertyType',
      entityId: created._id,
      action: 'subcategory_created',
      changes: { name: [null, input.name], codePrefix: [null, input.codePrefix] },
    });
    return this.getAll();
  }

  async updateSubcategory(
    actorId: string,
    id: string,
    input: UpdateSubcategory,
  ): Promise<PropertyTypes> {
    const before = await this.findSubcategory(id);
    await this.activeCategory(before.categoryKey);
    const next = { ...before, ...input };
    if (input.codePrefix !== undefined && input.codePrefix !== before.codePrefix) {
      const count = (await this.usage.countBySubcategory([id])).get(id) ?? 0;
      if (count > 0) {
        throw new AppError(
          422,
          'PREFIX_LOCKED',
          `The code prefix can't change: ${count} properties already use RE-${before.codePrefix}-…`,
        );
      }
    }
    await this.assertSubcategoryUnique(before.categoryKey, next.name, next.codePrefix, id);

    const changes = diffFields(
      before as unknown as Record<string, unknown>,
      next as unknown as Record<string, unknown>,
      ['name', 'codePrefix', 'purposes', 'isActive'],
    );
    if (Object.keys(changes).length === 0) return this.getAll();
    try {
      await PropertySubcategoryModel.updateOne(
        { _id: id },
        {
          $set: {
            ...input,
            ...(input.name ? { nameKey: normalizeLabel(input.name) } : {}),
            updatedBy: actorId,
          },
        },
      );
    } catch (err) {
      if (isDuplicateKeyError(err))
        throw conflict('That name or code prefix is already used.', 'DUPLICATE');
      throw err;
    }
    await recordChange({
      actorId,
      entity: 'propertyType',
      entityId: id,
      action: 'subcategory_updated',
      changes,
    });
    return this.getAll();
  }

  /** Only a subcategory with no properties can be deleted; otherwise deactivate it. */
  async deleteSubcategory(actorId: string, id: string): Promise<PropertyTypes> {
    const sub = await this.findSubcategory(id);
    await this.activeCategory(sub.categoryKey);
    const count = (await this.usage.countBySubcategory([id])).get(id) ?? 0;
    if (count > 0) {
      throw businessRule(
        `"${sub.name}" has ${count} properties, so it can't be deleted. Deactivate it instead.`,
      );
    }
    await PropertySubcategoryModel.deleteOne({ _id: id });
    await AmenityModel.updateMany({ subcategoryIds: id }, { $pull: { subcategoryIds: id } });
    for (const p of sub.attributes) await this.deleteIfUnused(p.attributeId);
    await recordChange({
      actorId,
      entity: 'propertyType',
      entityId: id,
      action: 'subcategory_deleted',
      changes: { name: [sub.name, null] },
    });
    return this.getAll();
  }

  // ---------------------------------------------------------------- attributes

  async addAttribute(
    actorId: string,
    target: AttributeTarget,
    input: AddAttribute,
  ): Promise<PropertyTypes> {
    const place = await this.loadTarget(target);
    let attribute: AttributeDoc;
    let createdNow = false;

    if (input.source === 'existing') {
      const found = await PropertyAttributeModel.findById(input.attributeId).lean<AttributeDoc>();
      if (!found) throw notFound('That attribute no longer exists.');
      attribute = found;
      await this.assertNotPlacedInCategory(place, attribute);
    } else {
      const existing = await PropertyAttributeModel.findOne({
        labelKey: normalizeLabel(input.label),
      }).lean<AttributeDoc>();
      if (existing) {
        throw conflict(
          `An attribute called "${existing.label}" already exists. Use the existing one instead.`,
          'ATTRIBUTE_EXISTS',
        );
      }
      const def = cleanDefinition(input);
      try {
        const doc = await PropertyAttributeModel.create({
          key: await this.uniqueKey(input.label),
          label: def.label,
          labelKey: normalizeLabel(def.label),
          type: def.type,
          unit: def.unit,
          options: def.options,
          searchFilter: def.searchFilter,
          createdBy: actorId,
          updatedBy: actorId,
        });
        attribute = doc.toObject() as unknown as AttributeDoc;
        createdNow = true;
      } catch (err) {
        if (isDuplicateKeyError(err)) {
          throw conflict(
            `An attribute called "${input.label}" already exists.`,
            'ATTRIBUTE_EXISTS',
          );
        }
        throw err;
      }
    }

    const placement = { attributeId: attribute._id, required: input.required };
    const result = await this.updateTarget(
      place,
      { _id: place.id, 'attributes.attributeId': { $ne: attribute._id } },
      { $push: { attributes: placement }, $set: { updatedBy: actorId } },
    );
    if (result.modifiedCount === 0) {
      if (createdNow) await PropertyAttributeModel.deleteOne({ _id: attribute._id });
      throw conflict(`"${attribute.label}" is already added to ${place.name}.`, 'ALREADY_ADDED');
    }
    await recordChange({
      actorId,
      entity: 'propertyType',
      entityId: place.id,
      action: 'attribute_added',
      changes: { [attribute.key]: [null, { label: attribute.label, required: input.required }] },
    });
    return this.getAll();
  }

  async updateAttribute(
    actorId: string,
    target: AttributeTarget,
    attributeId: string,
    input: UpdateAttribute,
  ): Promise<PropertyTypes> {
    const place = await this.loadTarget(target);
    const placement = place.attributes.find((p) => p.attributeId === attributeId);
    if (!placement) throw notFound(`That attribute isn't used in ${place.name}.`);
    const before = await PropertyAttributeModel.findById(attributeId).lean<AttributeDoc>();
    if (!before) throw notFound('That attribute no longer exists.');

    const next = cleanDefinition({
      label: input.label ?? before.label,
      type: input.type ?? before.type,
      unit: input.unit !== undefined ? input.unit : before.unit,
      options: input.options ?? before.options,
      searchFilter: input.searchFilter ?? before.searchFilter,
    });
    if (TYPES_WITH_OPTIONS.includes(next.type) && next.options.length === 0) {
      throw validationError([{ path: 'body.options', message: 'Add at least one option' }]);
    }
    const lower = next.options.map((o) => o.toLowerCase());
    const twice = next.options.find((o, i) => lower.indexOf(o.toLowerCase()) !== i);
    if (twice)
      throw validationError([{ path: 'body.options', message: `"${twice}" is listed twice` }]);

    if (next.type !== before.type && (await this.usage.isAttributeUsed(before.key))) {
      throw new AppError(
        422,
        'TYPE_LOCKED',
        `The value type of "${before.label}" can't change because properties already have values for it.`,
      );
    }
    if (next.label !== before.label) {
      const clash = await PropertyAttributeModel.exists({
        labelKey: normalizeLabel(next.label),
        _id: { $ne: attributeId },
      });
      if (clash)
        throw conflict(`An attribute called "${next.label}" already exists.`, 'ATTRIBUTE_EXISTS');
    }

    const changes: FieldChanges = diffFields(
      before as unknown as Record<string, unknown>,
      next as unknown as Record<string, unknown>,
      DEFINITION_FIELDS,
    );
    if (Object.keys(changes).length > 0) {
      try {
        await PropertyAttributeModel.updateOne(
          { _id: attributeId },
          { $set: { ...next, labelKey: normalizeLabel(next.label), updatedBy: actorId } },
        );
      } catch (err) {
        if (isDuplicateKeyError(err)) {
          throw conflict(`An attribute called "${next.label}" already exists.`, 'ATTRIBUTE_EXISTS');
        }
        throw err;
      }
    }
    if (input.required !== undefined && input.required !== placement.required) {
      await this.updateTarget(
        place,
        { _id: place.id, 'attributes.attributeId': attributeId },
        { $set: { 'attributes.$.required': input.required, updatedBy: actorId } },
      );
      changes.required = [placement.required, input.required];
    }
    if (Object.keys(changes).length > 0) {
      await recordChange({
        actorId,
        entity: 'propertyType',
        entityId: place.id,
        action: 'attribute_updated',
        changes: Object.fromEntries(
          Object.entries(changes).map(([field, diff]) => [`${before.key}.${field}`, diff]),
        ),
      });
    }
    return this.getAll();
  }

  /**
   * Removes an attribute from one place. Properties keep any values they already have.
   * The attribute itself is deleted once nothing uses it.
   */
  async removeAttribute(
    actorId: string,
    target: AttributeTarget,
    attributeId: string,
  ): Promise<PropertyTypes> {
    const place = await this.loadTarget(target);
    if (!place.attributes.some((p) => p.attributeId === attributeId)) {
      throw notFound(`That attribute isn't used in ${place.name}.`);
    }
    const attribute = await PropertyAttributeModel.findById(attributeId).lean<AttributeDoc>();
    await this.updateTarget(
      place,
      { _id: place.id },
      { $pull: { attributes: { attributeId } }, $set: { updatedBy: actorId } },
    );
    await this.deleteIfUnused(attributeId);
    await recordChange({
      actorId,
      entity: 'propertyType',
      entityId: place.id,
      action: 'attribute_removed',
      changes: { [attribute?.key ?? attributeId]: [attribute?.label ?? attributeId, null] },
    });
    return this.getAll();
  }

  // ---------------------------------------------------------------- amenities

  async createAmenity(
    actorId: string,
    categoryKey: CategoryKey,
    input: CreateAmenity,
  ): Promise<PropertyTypes> {
    await this.activeCategory(categoryKey);
    const subcategoryIds = input.appliesToAll ? [] : unique(input.subcategoryIds);
    await this.assertAmenityValid(categoryKey, input.name, subcategoryIds);
    const last = await AmenityModel.findOne({ categoryKey }).sort({ order: -1 }).lean<AmenityDoc>();
    let created;
    try {
      created = await AmenityModel.create({
        categoryKey,
        name: input.name,
        nameKey: normalizeLabel(input.name),
        icon: input.icon,
        appliesToAll: input.appliesToAll,
        subcategoryIds,
        isActive: input.isActive,
        order: (last?.order ?? -1) + 1,
        createdBy: actorId,
        updatedBy: actorId,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw conflict(`There is already an amenity called "${input.name}".`, 'DUPLICATE_NAME');
      }
      throw err;
    }
    await recordChange({
      actorId,
      entity: 'propertyType',
      entityId: created._id,
      action: 'amenity_created',
      changes: { name: [null, input.name] },
    });
    return this.getAll();
  }

  async updateAmenity(actorId: string, id: string, input: UpdateAmenity): Promise<PropertyTypes> {
    const before = await this.findAmenity(id);
    await this.activeCategory(before.categoryKey);
    const appliesToAll = input.appliesToAll ?? before.appliesToAll;
    const next = {
      name: input.name ?? before.name,
      icon: input.icon !== undefined ? input.icon : (before.icon ?? null),
      appliesToAll,
      subcategoryIds: appliesToAll ? [] : unique(input.subcategoryIds ?? before.subcategoryIds),
      isActive: input.isActive ?? before.isActive,
    };
    if (!next.appliesToAll && next.subcategoryIds.length === 0) {
      throw validationError([
        { path: 'body.subcategoryIds', message: 'Choose at least one subcategory, or "All"' },
      ]);
    }
    await this.assertAmenityValid(before.categoryKey, next.name, next.subcategoryIds, id);

    const changes = diffFields(
      { ...before, icon: before.icon ?? null } as unknown as Record<string, unknown>,
      next as unknown as Record<string, unknown>,
      ['name', 'icon', 'appliesToAll', 'subcategoryIds', 'isActive'],
    );
    if (Object.keys(changes).length === 0) return this.getAll();
    try {
      await AmenityModel.updateOne(
        { _id: id },
        { $set: { ...next, nameKey: normalizeLabel(next.name), updatedBy: actorId } },
      );
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw conflict(`There is already an amenity called "${next.name}".`, 'DUPLICATE_NAME');
      }
      throw err;
    }
    await recordChange({
      actorId,
      entity: 'propertyType',
      entityId: id,
      action: 'amenity_updated',
      changes,
    });
    return this.getAll();
  }

  /** Only an amenity no property has ticked can be deleted; otherwise deactivate it. */
  async deleteAmenity(actorId: string, id: string): Promise<PropertyTypes> {
    const amenity = await this.findAmenity(id);
    await this.activeCategory(amenity.categoryKey);
    const count = (await this.usage.countByAmenity([id])).get(id) ?? 0;
    if (count > 0) {
      throw businessRule(
        `"${amenity.name}" is ticked on ${count} properties, so it can't be deleted. Deactivate it instead.`,
      );
    }
    await AmenityModel.deleteOne({ _id: id });
    await recordChange({
      actorId,
      entity: 'propertyType',
      entityId: id,
      action: 'amenity_deleted',
      changes: { name: [amenity.name, null] },
    });
    return this.getAll();
  }

  /** Saves the checklist order. `ids` must list every amenity of the category exactly once. */
  async reorderAmenities(
    actorId: string,
    categoryKey: CategoryKey,
    ids: string[],
  ): Promise<PropertyTypes> {
    await this.activeCategory(categoryKey);
    const current = await AmenityModel.find({ categoryKey })
      .select('_id')
      .lean<{ _id: string }[]>();
    const known = new Set(current.map((a) => a._id));
    const complete =
      ids.length === known.size &&
      new Set(ids).size === ids.length &&
      ids.every((x) => known.has(x));
    if (!complete) {
      throw conflict('The amenity list has changed. Reload the page and try again.', 'STALE_ORDER');
    }
    await AmenityModel.bulkWrite(
      ids.map((_id, order) => ({
        updateOne: { filter: { _id }, update: { $set: { order, updatedBy: actorId } } },
      })),
    );
    await recordChange({
      actorId,
      entity: 'propertyType',
      entityId: categoryKey,
      action: 'amenities_reordered',
    });
    return this.getAll();
  }

  // ---------------------------------------------------------------- helpers

  private async findAmenity(id: string): Promise<AmenityDoc> {
    const amenity = await AmenityModel.findById(id).lean<AmenityDoc>();
    if (!amenity) throw notFound('Amenity not found');
    return amenity;
  }

  /** Unique name in the category; the chosen subcategories must belong to it. */
  private async assertAmenityValid(
    categoryKey: CategoryKey,
    name: string,
    subcategoryIds: string[],
    exceptId?: string,
  ): Promise<void> {
    const others = exceptId ? { _id: { $ne: exceptId } } : {};
    if (await AmenityModel.exists({ categoryKey, nameKey: normalizeLabel(name), ...others })) {
      throw conflict(`There is already an amenity called "${name}".`, 'DUPLICATE_NAME');
    }
    if (subcategoryIds.length === 0) return;
    const found = await PropertySubcategoryModel.countDocuments({
      _id: { $in: subcategoryIds },
      categoryKey,
    });
    if (found !== subcategoryIds.length) {
      throw validationError([
        {
          path: 'body.subcategoryIds',
          message: 'Some subcategories no longer exist. Reload the page.',
        },
      ]);
    }
  }

  private async activeCategory(key: CategoryKey): Promise<CategoryDoc> {
    const category = await PropertyCategoryModel.findOne({ key }).lean<CategoryDoc>();
    if (!category) throw notFound('Category not found');
    if (!category.isActive) {
      throw businessRule(
        `${category.name} is set up later. For now, only Residential can be changed.`,
      );
    }
    return category;
  }

  private async findSubcategory(id: string): Promise<SubcategoryDoc> {
    const sub = await PropertySubcategoryModel.findById(id).lean<SubcategoryDoc>();
    if (!sub) throw notFound('Subcategory not found');
    return sub;
  }

  private async loadTarget(target: AttributeTarget): Promise<LoadedTarget> {
    if (target.kind === 'category') {
      const c = await this.activeCategory(target.key);
      return {
        kind: 'category',
        id: c._id,
        categoryKey: c.key,
        name: `${c.name} (common)`,
        attributes: c.attributes,
      };
    }
    const s = await this.findSubcategory(target.id);
    await this.activeCategory(s.categoryKey);
    return {
      kind: 'subcategory',
      id: s._id,
      categoryKey: s.categoryKey,
      name: s.name,
      attributes: s.attributes,
    };
  }

  /** Runs one update on the target's document (a category or a subcategory). */
  private updateTarget(
    place: LoadedTarget,
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ) {
    return place.kind === 'category'
      ? PropertyCategoryModel.updateOne(filter, update)
      : PropertySubcategoryModel.updateOne(filter, update);
  }

  /**
   * An attribute appears once per property form: it can't be both a common attribute and a
   * subcategory attribute in the same category, or twice in one place.
   */
  private async assertNotPlacedInCategory(
    place: LoadedTarget,
    attribute: AttributeDoc,
  ): Promise<void> {
    const has = (list: Placement[]) => list.some((p) => p.attributeId === attribute._id);
    if (has(place.attributes)) {
      throw conflict(`"${attribute.label}" is already added to ${place.name}.`, 'ALREADY_ADDED');
    }
    const category = await PropertyCategoryModel.findOne({
      key: place.categoryKey,
    }).lean<CategoryDoc>();
    if (place.kind === 'subcategory') {
      if (category && has(category.attributes)) {
        throw conflict(
          `"${attribute.label}" is already a common attribute for ${category.name}, so every subcategory has it.`,
          'ALREADY_ADDED',
        );
      }
      return;
    }
    const subs = await PropertySubcategoryModel.find({
      categoryKey: place.categoryKey,
      'attributes.attributeId': attribute._id,
    })
      .sort({ order: 1, createdAt: 1 })
      .lean<SubcategoryDoc[]>();
    if (subs.length > 0) {
      throw conflict(
        `${subs.map((s) => s.name).join(' and ')} already ${subs.length > 1 ? 'have' : 'has'} "${attribute.label}". Remove it there first, then add it as a common attribute.`,
        'ALREADY_ADDED',
      );
    }
  }

  private async assertSubcategoryUnique(
    categoryKey: CategoryKey,
    name: string,
    codePrefix: string,
    exceptId?: string,
  ): Promise<void> {
    const others = exceptId ? { _id: { $ne: exceptId } } : {};
    if (
      await PropertySubcategoryModel.exists({
        categoryKey,
        nameKey: normalizeLabel(name),
        ...others,
      })
    ) {
      throw conflict(`There is already a subcategory called "${name}".`, 'DUPLICATE_NAME');
    }
    const prefixOwner = await PropertySubcategoryModel.findOne({
      codePrefix,
      ...others,
    }).lean<SubcategoryDoc>();
    if (prefixOwner) {
      throw conflict(
        `The code prefix ${codePrefix} is already used by "${prefixOwner.name}".`,
        'DUPLICATE_PREFIX',
      );
    }
  }

  /** "Road width" → "road_width"; "road_width_2" if taken. Core keys (title, price…) are reserved. */
  private async uniqueKey(label: string): Promise<string> {
    const base = attributeKeyFromLabel(label);
    for (let n = 1; ; n++) {
      const key = n === 1 ? base : `${base}_${n}`;
      if (CORE_ATTRIBUTE_KEYS.includes(key)) continue;
      if (!(await PropertyAttributeModel.exists({ key }))) return key;
    }
  }

  private async deleteIfUnused(attributeId: string): Promise<void> {
    const placed =
      (await PropertyCategoryModel.exists({ 'attributes.attributeId': attributeId })) ||
      (await PropertySubcategoryModel.exists({ 'attributes.attributeId': attributeId }));
    if (placed) return;
    const attribute = await PropertyAttributeModel.findById(attributeId).lean<AttributeDoc>();
    if (attribute && !(await this.usage.isAttributeUsed(attribute.key))) {
      await PropertyAttributeModel.deleteOne({ _id: attributeId });
    }
  }
}
