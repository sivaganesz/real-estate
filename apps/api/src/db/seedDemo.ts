import { createPropertyBodySchema, legalSummary } from '@real-estate/shared';
import type { CreatePropertyBody } from '@real-estate/shared';
import sharp from 'sharp';
import type { Logger } from '../lib/logger';
import type { StorageProvider } from '../lib/storage';
import { PropertyMediaService } from '../modules/properties/media.service';
import { PropertiesService } from '../modules/properties/properties.service';
import { PropertyModel } from '../modules/properties/property.model';
import type { PropertyDoc } from '../modules/properties/property.model';
import { propertyUsage } from '../modules/properties/propertyUsage';
import {
  AmenityModel,
  PropertySubcategoryModel,
} from '../modules/propertyTypes/propertyTypes.model';
import { PropertyTypesService } from '../modules/propertyTypes/propertyTypes.service';
import { newId } from './ids';
import demo from './demo/wireframe-properties.json';

type DemoProperty = (typeof demo)[number];

/**
 * Area pincodes for the wireframe's sample localities (the samples have none, and a
 * pincode is needed to be Available). All demo data is fictional.
 */
const PINCODES: Record<string, string> = {
  Madurai: '625001',
  Chennai: '600042',
  Coimbatore: '641004',
  Tiruchirappalli: '620018',
};
const LOCALITY_PINCODES: Record<string, string> = {
  'Sholinganallur (OMR)': '600119',
  Velachery: '600042',
  Vadavalli: '641041',
  Peelamedu: '641004',
  'Thillai Nagar': '620018',
};

/** A plain labelled photo, so the demo listings meet the "at least one photo" rule. */
async function placeholderPhoto(title: string, n: number): Promise<Buffer> {
  const hues = [215, 160, 30, 280, 0, 190];
  const hue = hues[(title.length + n) % hues.length];
  const safe = title.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},45%,62%)"/><stop offset="1" stop-color="hsl(${hue},45%,38%)"/>
    </linearGradient></defs>
    <rect width="1200" height="800" fill="url(#g)"/>
    <text x="60" y="700" font-family="Segoe UI, Arial" font-size="54" fill="white" font-weight="600">${safe}</text>
    <text x="60" y="760" font-family="Segoe UI, Arial" font-size="30" fill="white" opacity="0.85">Sample photo ${n} · demo data</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

/**
 * Loads the wireframe's 12 sample properties (PRD v2 PROP-13) into a development database
 * with catalogue v2, so the team sees the same examples as in the wireframe. Skips titles
 * that already exist. Refused in production.
 */
export async function seedDemo(deps: {
  nodeEnv: string;
  actorId: string;
  storage: StorageProvider;
  logger: Logger;
}): Promise<{ created: string[]; skipped: string[] }> {
  if (deps.nodeEnv === 'production') {
    throw new Error('seed:demo is for development and test databases only.');
  }
  const propertyTypes = new PropertyTypesService({ usage: propertyUsage });
  const properties = new PropertiesService({ propertyTypes, storage: deps.storage });
  const media = new PropertyMediaService({
    properties,
    storage: deps.storage,
    logger: deps.logger,
  });
  const subs = new Map(
    (await PropertySubcategoryModel.find().lean()).map((s) => [s.codePrefix, s]),
  );
  const amenities = await AmenityModel.find().lean();
  const created: string[] = [];
  const skipped: string[] = [];

  for (const p of demo as DemoProperty[]) {
    const sub = subs.get(p.codePrefix);
    if (!sub) {
      throw new Error(
        `Property type ${p.codePrefix} not found. Load catalogue v2 first: pnpm db:reset-catalogue --yes`,
      );
    }
    if (await PropertyModel.exists({ title: p.title })) {
      skipped.push(p.title);
      continue;
    }
    const amenityIds = amenities
      .filter(
        (a) => a.categoryKey === sub.categoryKey && (p.amenities as string[]).includes(a.name),
      )
      .filter((a) => a.appliesToAll || (a.subcategoryIds as string[]).includes(String(sub._id)))
      .map((a) => a._id);
    const body: CreatePropertyBody = {
      subcategoryId: sub._id,
      title: p.title,
      purpose: p.purpose as CreatePropertyBody['purpose'],
      price: p.price as CreatePropertyBody['price'],
      area: p.area as CreatePropertyBody['area'],
      location: {
        ...(p.location as NonNullable<CreatePropertyBody['location']>),
        pincode: LOCALITY_PINCODES[p.location.locality] ?? PINCODES[p.location.city] ?? '',
      },
      attributeValues: p.attributeValues as unknown as CreatePropertyBody['attributeValues'],
      amenityIds,
    };
    // Through the same schema as the API, so demo data is validated like real input.
    const property = await properties.create(deps.actorId, createPropertyBodySchema.parse(body));

    for (let n = 1; n <= Math.min(p.photos, 2); n++) {
      const buffer = await placeholderPhoto(p.title, n);
      await media.upload(deps.actorId, property.id, 'image', {
        buffer,
        originalname: `${p.wireframeId.toLowerCase()}-${n}.jpg`,
        size: buffer.length,
      });
    }

    // Detail-tab data from the wireframe (their own editors arrive in R1.4–R1.6).
    const stored = (await PropertyModel.findById(property.id).lean<PropertyDoc>())!;
    const byKey = new Map(p.legal.map((c) => [c.key, c]));
    const legal = (stored.legal ?? []).map((c) => {
      const w = byKey.get(c.key);
      return w
        ? {
            ...c,
            status: w.status as 'not_collected' | 'pending' | 'verified',
            verifiedBy: w.verifiedBy,
            date: w.date,
            note: w.note,
          }
        : c;
    });
    const listedAt = new Date(`${p.listedAt}T09:00:00+05:30`);
    await PropertyModel.updateOne(
      { _id: property.id },
      {
        $set: {
          legal,
          legalSummary: legalSummary(legal),
          highway: p.highway,
          nearby: p.nearby.map((n) => ({ _id: newId(), ...n })),
          valuation: {
            ...p.valuation,
            comparables: p.valuation.comparables.map((c) => ({ _id: newId(), ...c })),
          },
          status: p.status,
          publishedAt: listedAt,
          statusChangedAt: listedAt,
        },
      },
    );
    created.push(`${property.code} ${p.title}`);
  }
  return { created, skipped };
}
