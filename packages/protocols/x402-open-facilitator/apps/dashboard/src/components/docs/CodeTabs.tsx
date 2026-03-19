'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface CodeTabsProps {
  defaultValue?: string;
  children: React.ReactNode;
}

interface TabProps {
  value: string;
  label: string;
  children: React.ReactNode;
}

export function CodeTabs({ defaultValue, children }: CodeTabsProps) {
  return (
    <Tabs defaultValue={defaultValue} className="w-full">
      {children}
    </Tabs>
  );
}

export function CodeTabsList({ children }: { children: React.ReactNode }) {
  return (
    <TabsList className="mb-5">
      {children}
    </TabsList>
  );
}

export function CodeTab({ value, label }: { value: string; label: string }) {
  return <TabsTrigger value={value}>{label}</TabsTrigger>;
}

export function CodeTabContent({ value, children }: { value: string; children: React.ReactNode }) {
  return <TabsContent value={value} className="mt-0 [&>h2:first-child]:mt-0 [&>h3:first-child]:mt-0">{children}</TabsContent>;
}
