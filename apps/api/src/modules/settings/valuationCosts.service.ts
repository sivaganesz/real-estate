import { DEFAULT_VALUATION_COSTS } from '@real-estate/shared';
import type { ValuationCosts, ValuationCostsBody } from '@real-estate/shared';
import { withTransaction } from '../../db/transaction';
import { versionConflict } from '../../db/versionPlugin';
import { diffFields, recordChange } from '../changeLogs/changeLog.service';
import { SettingsModel } from './settings.model';

const KEY = 'valuationCosts';
const FIELDS = ['stampDutyPct', 'registrationPct', 'otherPct'] as const;

interface StoredDoc {
  _id: string;
  value: Partial<ValuationCostsBody>;
  updatedAt?: Date;
  version?: number;
}

/** Settings → Cost assumptions (PRD v2 SET-04): read by anyone who views properties. */
export class ValuationCostsService {
  private load() {
    return SettingsModel.findOne({ key: KEY }).lean<StoredDoc>();
  }

  private toResponse(doc: StoredDoc | null): ValuationCosts {
    return {
      ...DEFAULT_VALUATION_COSTS,
      ...doc?.value,
      updatedAt: doc?.updatedAt ? doc.updatedAt.toISOString() : null,
      version: doc?.version ?? 0,
    };
  }

  async get(): Promise<ValuationCosts> {
    return this.toResponse(await this.load());
  }

  /** `expectedVersion` (If-Match) rejects a save based on an outdated copy with 409. */
  async update(
    actorId: string,
    input: ValuationCostsBody,
    expectedVersion: number,
  ): Promise<ValuationCosts> {
    const before = await this.load();
    const readVersion = before?.version ?? 0;
    if (expectedVersion !== readVersion) throw versionConflict(readVersion);
    const after = await withTransaction(async () => {
      let saved: StoredDoc | null;
      try {
        saved = await SettingsModel.findOneAndUpdate(
          before ? { _id: before._id, version: readVersion } : { key: KEY },
          { $set: { value: input, updatedBy: actorId } },
          { upsert: !before, returnDocument: 'after' },
        ).lean<StoredDoc>();
      } catch (err) {
        if ((err as { code?: number }).code === 11000) throw versionConflict(readVersion + 1);
        throw err;
      }
      if (!saved) throw versionConflict(readVersion + 1);
      const changes = diffFields(
        { ...DEFAULT_VALUATION_COSTS, ...before?.value },
        input as unknown as Record<string, unknown>,
        FIELDS,
      );
      if (Object.keys(changes).length > 0) {
        await recordChange({
          actorId,
          entity: 'settings',
          entityId: saved._id,
          action: 'valuation_costs_updated',
          changes,
        });
      }
      return saved;
    });
    return this.toResponse(after);
  }
}
