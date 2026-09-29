import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { colors, hairline, radius, sizes, space, typography } from '@/theme';
import {
  areaPath,
  axisScale,
  monotonePath,
  niceMax,
  summarize,
  toPoints,
  type Point,
  type SpeedSample,
} from '@/utils/chart';
import { formatRate, joinUnit } from '@/utils/format';
import { AppText } from './AppText';

// Axis text must stay inside the fixed-width gutter at large font scales.
const AXIS_FONT_SCALE = 1.3;

function LastDot({ points, color }: { points: Point[]; color: string }) {
  const p = points[points.length - 1];
  if (!p) return null;
  return (
    <Circle
      cx={p.x}
      cy={p.y}
      r={sizes.chartDot}
      fill={color}
      stroke={colors.surface}
      strokeWidth={sizes.chartStroke}
    />
  );
}

function LegendItem({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <AppText variant="caption" color={colors.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

function AxisText({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return (
    <AppText
      variant="caption"
      color={colors.textMuted}
      numeric
      maxFontSizeMultiplier={AXIS_FONT_SCALE}
      style={style}
    >
      {children}
    </AppText>
  );
}

const rate = (bps: number | null) => (bps === null ? '–' : joinUnit(formatRate(bps / 8)));

/** Top / average for one direction; columns line up with Download / Upload above. */
function SummaryColumn({ name, top, avg }: { name: string; top: number | null; avg: number | null }) {
  return (
    <View
      style={styles.summaryCol}
      accessible
      accessibilityLabel={`${name} in the last minute: top ${rate(top)}, average ${rate(avg)}`}
    >
      <View style={styles.summaryRow}>
        <AppText variant="caption" color={colors.textSecondary}>
          Top
        </AppText>
        <AppText variant="label" numeric>
          {rate(top)}
        </AppText>
      </View>
      <View style={styles.summaryRow}>
        <AppText variant="caption" color={colors.textSecondary}>
          Average
        </AppText>
        <AppText variant="label" numeric>
          {rate(avg)}
        </AppText>
      </View>
    </View>
  );
}

/**
 * Download (blue, filled) and upload (purple) over the last 60 s (DESIGN.md §9.1),
 * with a speed axis on the left, a time axis below and a legend.
 * One lightweight SVG, no chart library or animation (A06 is an entry-level phone).
 */
export function SpeedChart({ samples }: { samples: SpeedSample[] }) {
  const [width, setWidth] = useState(0);

  // Inset so the line and the end dots aren't clipped at the edges.
  const inset = sizes.chartDot + sizes.chartStroke;
  const plotWidth = Math.max(0, width - inset);
  const plotHeight = sizes.chart - inset * 2;

  const peakDown = Math.max(0, ...samples.map((s) => s.down));
  const peakUp = Math.max(0, ...samples.map((s) => s.up));
  const max = niceMax(Math.max(peakDown, peakUp));
  const scale = axisScale(max);
  const summary = summarize(samples);

  const down = toPoints(samples, 'down', plotWidth, plotHeight, max);
  const up = toPoints(samples, 'up', plotWidth, plotHeight, max);
  const dash = `${space.xs} ${space.xs}`;
  const gridY = [0, plotHeight / 2, plotHeight];
  const labelHalf = typography.caption.lineHeight / 2;

  return (
    <View>
      <View
        accessible
        accessibilityLabel={`Speed over the last 60 seconds. Download in blue, peak ${joinUnit(
          formatRate(peakDown / 8),
        )}. Upload in purple, peak ${joinUnit(formatRate(peakUp / 8))}.`}
      >
        <View style={styles.header}>
          <AxisText>{scale.unit}</AxisText>
          <View style={styles.legend}>
            <LegendItem label="Download" color={colors.primary} />
            <LegendItem label="Upload" color={colors.info} />
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.yAxis}>
            {scale.ticks.map((label, i) => (
              <AxisText key={i} style={[styles.yLabel, { top: inset + (gridY[i] ?? 0) - labelHalf }]}>
                {label}
              </AxisText>
            ))}
          </View>

          <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {width > 0 && (
              <Svg width={width} height={sizes.chart}>
                <G transform={`translate(0, ${inset})`}>
                  {gridY.map((y, i) => (
                    <Line
                      key={i}
                      x1={0}
                      x2={width}
                      y1={y}
                      y2={y}
                      stroke={colors.border}
                      strokeWidth={hairline}
                      strokeDasharray={i === gridY.length - 1 ? undefined : dash}
                    />
                  ))}

                  {down.length > 1 && <Path d={areaPath(down, plotHeight)} fill={colors.primaryBg} />}
                  {down.length > 1 && (
                    <Path
                      d={monotonePath(down)}
                      fill="none"
                      stroke={colors.primary}
                      strokeWidth={sizes.chartStroke}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  {up.length > 1 && (
                    <Path
                      d={monotonePath(up)}
                      fill="none"
                      stroke={colors.info}
                      strokeWidth={sizes.chartStroke}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  {/* Download last so its dot stays visible when both sit at zero. */}
                  <LastDot points={up} color={colors.info} />
                  <LastDot points={down} color={colors.primary} />
                </G>
              </Svg>
            )}
          </View>
        </View>

        <View style={styles.xAxis}>
          <AxisText style={styles.xLabel}>60 s ago</AxisText>
          <AxisText style={[styles.xLabel, styles.center]}>30 s ago</AxisText>
          <AxisText style={[styles.xLabel, styles.end]}>Now</AxisText>
        </View>
      </View>

      <View style={styles.summary}>
        <SummaryColumn name="Download" top={summary.topDown} avg={summary.avgDown} />
        <SummaryColumn name="Upload" top={summary.topUp} avg={summary.avgUp} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  legend: { flexDirection: 'row', gap: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  legendDot: { width: sizes.chartDot * 2, height: sizes.chartDot * 2, borderRadius: radius.pill },
  body: { flexDirection: 'row' },
  yAxis: { width: sizes.chartAxis, height: sizes.chart },
  yLabel: { position: 'absolute', right: space.sm },
  chart: { flex: 1, height: sizes.chart },
  // Equal thirds so "30 s ago" sits under the middle of the chart.
  xAxis: { flexDirection: 'row', marginLeft: sizes.chartAxis, marginTop: space.xs },
  xLabel: { flex: 1 },
  center: { textAlign: 'center' },
  end: { textAlign: 'right' },
  // Same two-column grid as the Download / Upload numbers at the top of the card.
  summary: {
    flexDirection: 'row',
    gap: space.lg,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: hairline,
    borderTopColor: colors.border,
  },
  summaryCol: { flex: 1, gap: space.xs },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
