import React, { useId, useRef, useState } from "react";
import {
  View,
  Text,
  LayoutChangeEvent,
  PanResponder,
  GestureResponderEvent,
} from "react-native";
import Svg, {
  Path,
  Line,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { colors, ink } from "@/theme/colors";

/**
 * Minimal Apple-Health-style line chart drawn with react-native-svg. A smooth
 * 2px line over a soft vertical gradient area that fades to transparent at the
 * baseline, with hairline min/max gridlines and small muted value labels. A
 * subtle dot marks the latest sample. No axis clutter. Width is measured via
 * onLayout; height is fixed by prop.
 *
 * Touch scrubbing: dragging a finger across the plot snaps to the nearest data
 * point, drawing a crosshair + highlighted dot and a floating value bubble.
 * Implemented with the built-in PanResponder — zero extra dependencies.
 */

type P = { t: number; v: number };

// Geometry shared between render and the pan responder. Kept in a ref so the
// (once-created) responder always reads the latest layout.
type Geom = { xs: number[]; xy: { x: number; y: number }[] };

export function LineChart({
  points,
  color,
  unit,
  height = 160,
}: {
  points: P[];
  color: string;
  unit?: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  // Unique gradient id so the four stacked charts never share a <Defs> fill.
  const gradientId = "chartFill" + useId().replace(/[^a-zA-Z0-9]/g, "");

  const geomRef = useRef<Geom | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Map a finger x (in overlay-local coords) to the nearest sample index.
  const scrubTo = (x: number) => {
    const g = geomRef.current;
    if (!g || g.xs.length < 2) return;
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < g.xs.length; i++) {
      const d = Math.abs(g.xs[i] - x);
      if (d < best) {
        best = d;
        idx = i;
      }
    }
    setActiveIdx((prev) => (prev === idx ? prev : idx));
  };

  // Fade the selection out shortly after the finger lifts — calmer than an
  // abrupt disappearance, and leaves the last read on screen a beat longer.
  const scheduleClear = () => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setActiveIdx(null), 900);
  };
  const cancelClear = () => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        cancelClear();
        scrubTo(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        scrubTo(e.nativeEvent.locationX);
      },
      onPanResponderRelease: scheduleClear,
      onPanResponderTerminate: scheduleClear,
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };

  // Empty state — not enough to draw a line. Kept calm and centered. (No
  // scrubbing here; the overlay is only mounted for a real series.)
  if (points.length < 2) {
    return (
      <View
        style={{
          height,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 14, color: colors.tertiaryLabel }}>
          Zatím nemám dost dat
        </Text>
      </View>
    );
  }

  // Comfortable vertical breathing room so the line never touches the edges
  // and the top/bottom value labels have space to sit outside the plot.
  const padY = 22;
  const padX = 8;

  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  // Guard a flat series so it draws through the middle.
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const fmt = (n: number) => `${n.toFixed(1)}${unit ? ` ${unit}` : ""}`;

  // --- geometry (only meaningful once measured) ---
  const innerW = Math.max(1, width - padX * 2);
  const innerH = Math.max(1, height - padY * 2);
  const n = points.length;
  const first = points[0].t;
  const span = points[n - 1].t - first || 1;

  const xy = points.map((p) => ({
    x: padX + ((p.t - first) / span) * innerW,
    y: padY + (1 - (p.v - min) / (max - min)) * innerH,
  }));
  geomRef.current = { xs: xy.map((p) => p.x), xy };

  const line = smoothPath(xy);
  const area = `${line} L ${xy[n - 1].x.toFixed(2)} ${(padY + innerH).toFixed(
    2
  )} L ${xy[0].x.toFixed(2)} ${(padY + innerH).toFixed(2)} Z`;

  const topY = padY;
  const bottomY = padY + innerH;
  const last = xy[n - 1];

  const active =
    activeIdx != null && activeIdx >= 0 && activeIdx < n ? activeIdx : null;
  const activePt = active != null ? xy[active] : null;

  return (
    <View style={{ height }} onLayout={onLayout}>
      {width > 0 && (
        <>
          <Svg width={width} height={height}>
            {/* Soft vertical gradient for the area fill: accent at the top,
                fading to fully transparent at the baseline. */}
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.22} />
                <Stop offset="0.85" stopColor={color} stopOpacity={0.02} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* min / max gridlines — hairlines */}
            <Line
              x1={padX}
              y1={topY}
              x2={width - padX}
              y2={topY}
              stroke={ink.secondary}
              strokeWidth={0.5}
              opacity={0.3}
            />
            <Line
              x1={padX}
              y1={bottomY}
              x2={width - padX}
              y2={bottomY}
              stroke={ink.secondary}
              strokeWidth={0.5}
              opacity={0.3}
            />

            {/* area fill */}
            <Path d={area} fill={`url(#${gradientId})`} />

            {/* line */}
            <Path
              d={line}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* scrubbing crosshair + highlighted point */}
            {activePt && (
              <>
                <Line
                  x1={activePt.x}
                  y1={topY - 4}
                  x2={activePt.x}
                  y2={bottomY + 4}
                  stroke={color}
                  strokeWidth={1}
                  opacity={0.35}
                />
                <Circle cx={activePt.x} cy={activePt.y} r={7} fill={color} opacity={0.18} />
                <Circle cx={activePt.x} cy={activePt.y} r={3.5} fill={color} />
              </>
            )}

            {/* latest sample marker — a soft halo with a solid centre. Hidden
                while actively scrubbing the last point to avoid a double dot. */}
            {active !== n - 1 && (
              <>
                <Circle cx={last.x} cy={last.y} r={5.5} fill={color} opacity={0.16} />
                <Circle cx={last.x} cy={last.y} r={2.75} fill={color} />
              </>
            )}

            {/* value labels at the gridlines */}
            <SvgText
              x={width - padX}
              y={topY - 7}
              fill={ink.secondary}
              fontSize={11}
              fontWeight="500"
              textAnchor="end"
            >
              {fmt(max)}
            </SvgText>
            <SvgText
              x={width - padX}
              y={bottomY + 15}
              fill={ink.secondary}
              fontSize={11}
              fontWeight="500"
              textAnchor="end"
            >
              {fmt(min)}
            </SvgText>
          </Svg>

          {/* Floating value bubble, anchored near the finger and clamped to
              stay inside the plot. */}
          {active != null && activePt && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: Math.min(Math.max(activePt.x - 46, 2), Math.max(2, width - 94)),
                top: Math.max(activePt.y - 50, 0),
                minWidth: 92,
                paddingVertical: 5,
                paddingHorizontal: 9,
                borderRadius: 10,
                backgroundColor: colors.secondarySystemBackground,
                borderWidth: 0.5,
                borderColor: colors.separator,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.label,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {fmt(points[active].v)}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.secondaryLabel,
                  fontVariant: ["tabular-nums"],
                  marginTop: 1,
                }}
              >
                {timeLabel(points[active].t)}
              </Text>
            </View>
          )}

          {/* Transparent touch overlay driving the scrubber. */}
          <View
            {...responder.panHandlers}
            style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
          />
        </>
      )}
    </View>
  );
}

/**
 * Format a sample's own timestamp as a compact "d.M. HH:MM". Uses the point's
 * epoch ms only — never the current wall clock.
 */
function timeLabel(t: number): string {
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()}.${d.getMonth() + 1}. ${hh}:${mm}`;
}

/**
 * Build a smooth SVG path through the points using a Catmull-Rom spline
 * converted to cubic beziers. Falls back to a straight move for a single point.
 */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;

    // Catmull-Rom → Bezier control points (tension 1/6).
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(
      2
    )} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}
