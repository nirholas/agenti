'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';
import { api, type ChartDataPoint } from '@/lib/api';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

interface ActivityDataPoint {
  date: string;
  dateFormatted: string;
  settlements: number;
  verifications: number;
  amount: number;
}

interface SettlementActivityChartProps {
  facilitatorId: string;
}

function processChartData(rawData: ChartDataPoint[], days: number): ActivityDataPoint[] {
  const now = new Date();
  const dataMap = new Map<string, ChartDataPoint>();

  // Index existing data by date
  rawData.forEach((point) => {
    dataMap.set(point.date, point);
  });

  // Generate all days in range and fill in missing days
  const result: ActivityDataPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];

    const existing = dataMap.get(dateKey);
    result.push({
      date: dateKey,
      dateFormatted: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      settlements: existing?.settlements ?? 0,
      verifications: existing?.verifications ?? 0,
      amount: existing?.amount ?? 0,
    });
  }

  return result;
}

export function SettlementActivityChart({ facilitatorId }: SettlementActivityChartProps) {
  const [range, setRange] = useState<7 | 30>(7);

  const { data: chartData, isLoading } = useQuery({
    queryKey: ['chart-data', facilitatorId, range],
    queryFn: () => api.getChartData(facilitatorId, range),
  });

  const data = chartData ? processChartData(chartData.data, range) : [];
  const totalSettled = data.reduce((sum, d) => sum + d.amount, 0);
  const totalSettlements = data.reduce((sum, d) => sum + d.settlements, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Settlement Activity
            </CardTitle>
            <CardDescription>
              {formatCurrency(totalSettled)} settled across {totalSettlements.toLocaleString()} transactions
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant={range === 7 ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setRange(7)}
            >
              7D
            </Button>
            <Button
              variant={range === 30 ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setRange(30)}
            >
              30D
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Loading chart data...
          </div>
        ) : totalSettlements === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            No settlement activity in this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="dateFormatted"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B7280', fontSize: 11 }}
                interval={range === 7 ? 0 : 'preserveStartEnd'}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B7280', fontSize: 11 }}
                tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value) => [formatCurrency(Number(value)), 'Settled']}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#3B82F6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAmount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
