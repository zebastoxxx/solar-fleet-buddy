import { CartesianGrid, Tooltip } from 'recharts';

/**
 * Branded defaults for recharts. Use as drop-in replacements.
 * Colors come from the design tokens so they adapt to dark mode.
 */

export const GOLD = 'hsl(36 79% 47%)';
export const GOLD_BRIGHT = 'hsl(37 91% 55%)';
export const SUCCESS = 'hsl(138 65% 29%)';
export const DANGER = 'hsl(6 64% 46%)';
export const WARNING = 'hsl(45 90% 27%)';

export const CHART_COLORS = [GOLD, SUCCESS, WARNING, DANGER, GOLD_BRIGHT, '#1E40AF'];

export const AXIS_PROPS = {
  tick: { fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'DM Sans' },
  axisLine: { stroke: 'hsl(var(--border))' },
  tickLine: { stroke: 'hsl(var(--border))' },
};

/** Branded grid for charts. Subtle, theme-aware. */
export function BrandedGrid({ vertical = false, horizontal = true }: { vertical?: boolean; horizontal?: boolean }) {
  return (
    <CartesianGrid
      strokeDasharray="3 3"
      stroke="hsl(var(--border))"
      strokeOpacity={0.4}
      vertical={vertical}
      horizontal={horizontal}
    />
  );
}

/** Branded tooltip with theme-aware bg/border. */
export function BrandedTooltip(props: React.ComponentProps<typeof Tooltip>) {
  return (
    <Tooltip
      cursor={{ fill: 'hsl(var(--gold) / 0.08)' }}
      contentStyle={{
        backgroundColor: 'hsl(var(--popover))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        fontFamily: 'DM Sans',
        fontSize: 12,
        color: 'hsl(var(--foreground))',
      }}
      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
      itemStyle={{ color: 'hsl(var(--foreground))' }}
      {...props}
    />
  );
}
