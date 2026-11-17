import { zodResolver } from '@hookform/resolvers/zod';
import { valuationCostsBodySchema } from '@real-estate/shared';
import type { ValuationCosts } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/forms/FormField';
import { Note } from '@/components/patterns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsNav } from '@/features/settings/SettingsNav';
import { useUpdateValuationCosts, useValuationCosts } from '@/features/settings/api';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

const SAMPLE_PRICE = 2_800_000;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Inputs are text; the schema needs numbers. */
const formSchema = z.object({
  stampDutyPct: z.coerce.number(),
  registrationPct: z.coerce.number(),
  otherPct: z.coerce.number(),
});
type FormInput = z.input<typeof formSchema>;

const toForm = (c: ValuationCosts): FormInput => ({
  stampDutyPct: c.stampDutyPct,
  registrationPct: c.registrationPct,
  otherPct: c.otherPct,
});

/**
 * Settings → Cost assumptions (PRD v2 SET-04, wireframe "Transaction cost assumptions").
 * Used for the illustrative cost breakdown on each property's Pricing & valuation tab.
 */
export function CostAssumptionsPage() {
  const costs = useValuationCosts();
  const update = useUpdateValuationCosts();
  const form = useForm<FormInput, unknown, z.output<typeof valuationCostsBodySchema>>({
    resolver: zodResolver(formSchema.pipe(valuationCostsBodySchema)),
    defaultValues: { stampDutyPct: 7, registrationPct: 4, otherPct: 1 },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const watched = useWatch({
    control: form.control,
    name: ['stampDutyPct', 'registrationPct', 'otherPct'],
  });
  const [stamp = 0, reg = 0, other = 0] = watched.map((v) => Number(v) || 0);

  useEffect(() => {
    if (costs.data && !form.formState.isDirty) form.reset(toForm(costs.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costs.data?.version]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!costs.data) return;
    try {
      const saved = await update.mutateAsync({ ...values, version: costs.data.version });
      form.reset(toForm(saved));
      toast.success('Cost assumptions saved');
    } catch {
      // Shown in the alert.
    }
  });

  const total = SAMPLE_PRICE * (1 + (stamp + reg + other) / 100);

  return (
    <>
      <SettingsNav
        actions={
          <>
            <Button
              variant="outline"
              disabled={!isDirty}
              onClick={() => costs.data && form.reset(toForm(costs.data))}
            >
              Cancel
            </Button>
            <Button form="cost-form" type="submit" disabled={!isDirty || isSubmitting}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              Save changes
            </Button>
          </>
        }
      />
      {costs.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : costs.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(costs.error)}</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader>
              <CardTitle>Transaction cost assumptions</CardTitle>
              <CardDescription>
                Used to show buyers an estimated total cost on each property&apos;s Pricing &amp;
                valuation tab.
                {costs.data.updatedAt && ` Last saved ${formatDateTime(costs.data.updatedAt)}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                id="cost-form"
                onSubmit={onSubmit}
                className="grid gap-4 sm:grid-cols-3"
                noValidate
              >
                {update.error && (
                  <Alert variant="destructive" className="sm:col-span-3">
                    <AlertDescription>{errorMessage(update.error)}</AlertDescription>
                  </Alert>
                )}
                <FormField
                  id="cost-stamp"
                  label="Stamp duty (%)"
                  error={errors.stampDutyPct?.message}
                >
                  <Input
                    id="cost-stamp"
                    type="number"
                    step="0.1"
                    min={0}
                    {...form.register('stampDutyPct')}
                  />
                </FormField>
                <FormField
                  id="cost-reg"
                  label="Registration fee (%)"
                  error={errors.registrationPct?.message}
                >
                  <Input
                    id="cost-reg"
                    type="number"
                    step="0.1"
                    min={0}
                    {...form.register('registrationPct')}
                  />
                </FormField>
                <FormField id="cost-other" label="Other costs (%)" error={errors.otherPct?.message}>
                  <Input
                    id="cost-other"
                    type="number"
                    step="0.1"
                    min={0}
                    {...form.register('otherPct')}
                  />
                </FormField>
              </form>
              <Note tone="amber" className="mt-4">
                Illustrative only. Confirm the current state rates and the guideline value before
                quoting figures to customers.
              </Note>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Example</CardTitle>
              <CardDescription>
                A property with an asking price of {inr(SAMPLE_PRICE)}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-1.5 text-sm">
              {[
                ['Asking price', SAMPLE_PRICE],
                [`Stamp duty (${stamp}%)`, (SAMPLE_PRICE * stamp) / 100],
                [`Registration (${reg}%)`, (SAMPLE_PRICE * reg) / 100],
                [`Other costs (${other}%)`, (SAMPLE_PRICE * other) / 100],
              ].map(([label, amount]) => (
                <div key={label as string} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="tabular-nums">{inr(amount as number)}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between gap-3 border-t pt-2 font-semibold">
                <span>Estimated total</span>
                <span className="tabular-nums">{inr(total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
