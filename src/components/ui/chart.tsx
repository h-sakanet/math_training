import * as React from "react";
import { ResponsiveContainer, TooltipProps } from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label: string; color: string }>;

const ChartContext = React.createContext<ChartConfig | null>(null);

export function useChartConfig(): ChartConfig {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChartConfig must be used within ChartContainer");
  }
  return context;
}

export function ChartContainer({
  config,
  className,
  children
}: {
  config: ChartConfig;
  className?: string;
  children: React.ReactNode;
}) {
  const style = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color])
  ) as React.CSSProperties;

  return (
    <ChartContext.Provider value={config}>
      <div className={cn("h-[280px] w-full", className)} style={style}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export function ChartTooltipContent({
  active,
  payload,
  label
}: TooltipProps<number, string>) {
  const config = useChartConfig();

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border bg-background p-2 text-xs shadow-sm">
      <div className="mb-1 font-medium">セッション {label}</div>
      {payload.map((item) => {
        const key = String(item.dataKey);
        const entry = config[key];
        return (
          <div key={key} className="flex items-center justify-between gap-2">
            <span>{entry?.label ?? key}</span>
            <span className="font-semibold">{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}
