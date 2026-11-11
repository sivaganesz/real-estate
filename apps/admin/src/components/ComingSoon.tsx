import { HammerIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Placeholder for a screen whose API/UI is built in a later step. */
export function ComingSoon({
  step,
  summary,
  items,
}: {
  step: string;
  summary: string;
  items: string[];
}) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <HammerIcon className="size-4 text-muted-foreground" />
          <CardTitle>Being built</CardTitle>
          <Badge variant="outline" className="border-dashed">
            {step}
          </Badge>
        </div>
        <CardDescription>{summary}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
