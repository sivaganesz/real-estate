import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandMark } from './BrandMark';

/** Centered card used by the sign-in, forgot-password and reset-password screens. */
export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-4">
          <BrandMark />
          <div className="space-y-1">
            <CardTitle className="text-xl">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
