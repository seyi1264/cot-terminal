import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/cot/types";
import { formatContracts } from "@/lib/cot/format";

function tickDate(value: string) {
  const d = new Date(`${value}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function NetChart({ series }: { series: SeriesPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="d"
            tickFormatter={tickDate}
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={(v: number) => formatContracts(v, 0)}
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              color: "var(--color-fg)",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              formatContracts(Number(value ?? 0)),
              String(name),
            ]}
            labelFormatter={(label) => String(label)}
          />
          <Legend
            verticalAlign="bottom"
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, color: "var(--color-muted)", paddingTop: 8 }}
          />
          <Line
            type="monotone"
            dataKey="n"
            name="Non-commercial"
            stroke="var(--color-fg)"
            strokeWidth={1.8}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="c"
            name="Commercial"
            stroke="var(--color-bid)"
            strokeWidth={1.8}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="r"
            name="Retail"
            stroke="var(--color-muted)"
            strokeWidth={1.2}
            strokeDasharray="4 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WoChart({ series }: { series: SeriesPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="d"
            tickFormatter={tickDate}
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={(v: number) => formatContracts(v, 0)}
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              color: "var(--color-fg)",
              fontSize: 12,
            }}
            formatter={(value) => [formatContracts(Number(value ?? 0)), "WO difference"]}
          />
          <Line
            type="monotone"
            dataKey="w"
            name="WO difference"
            stroke="var(--color-accent)"
            strokeWidth={1.8}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
