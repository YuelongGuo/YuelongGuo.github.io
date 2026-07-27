/**
 * Citation-distribution chart, shared by the page build and the social card.
 *
 * The y-axis uses a square-root scale: a linear axis would flatten the long
 * tail against the baseline and hide the h-index crossing entirely, and a log
 * axis cannot represent zero-citation works honestly. The shaded rectangle is
 * the literal h-square — h works, each with at least h citations.
 */

const defaults = {
  width: 660,
  height: 290,
  padLeft: 46,
  padRight: 14,
  padTop: 20,
  padBottom: 40,
  ceiling: 260,
  minimal: false,
  className: "chart",
  role: "img",
  labelledBy: "chart-title chart-caption"
};

export const renderChart = (chart, overrides = {}) => {
  const o = { ...defaults, ...overrides };
  const shown = Math.min(Number(chart.shown) || chart.series.length, chart.series.length);
  const series = chart.series.slice(0, shown);
  const h = Number(chart.highlight);

  const plotWidth = o.width - o.padLeft - o.padRight;
  const plotHeight = o.height - o.padTop - o.padBottom;

  const scale = (value) => Math.sqrt(Math.max(value, 0)) / Math.sqrt(o.ceiling);
  const y = (value) => o.padTop + plotHeight - scale(value) * plotHeight;
  const slot = plotWidth / shown;
  const barWidth = Math.max(slot * 0.62, 2);
  const xSlot = (index) => o.padLeft + index * slot;
  const xBar = (index) => xSlot(index) + (slot - barWidth) / 2;

  const yTicks = [250, 100, 50, 20, 0];
  const xTicks = [1, 10, 20, 30].filter((rank) => rank <= shown);

  const gridLines = o.minimal
    ? ""
    : yTicks
        .map(
          (tick) => `
          <line class="chart-grid" x1="${o.padLeft}" x2="${o.width - o.padRight}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}" />
          <text class="chart-axis-text" x="${o.padLeft - 10}" y="${(y(tick) + 3.5).toFixed(1)}" text-anchor="end">${tick}</text>`
        )
        .join("");

  const bars = series
    .map((value, index) => {
      const barTop = y(value);
      const isCore = index < h;
      const title = o.minimal
        ? ""
        : `
            <title>Rank ${index + 1}: ${value} citation${value === 1 ? "" : "s"}</title>`;
      return `
          <rect class="chart-bar${isCore ? " chart-bar-core" : ""}" x="${xBar(index).toFixed(1)}" y="${barTop.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${(o.padTop + plotHeight - barTop).toFixed(1)}" rx="1">${title}
          </rect>`;
    })
    .join("");

  const rankLabels = o.minimal
    ? ""
    : xTicks
        .map(
          (rank) => `
          <text class="chart-axis-text" x="${(xSlot(rank - 1) + slot / 2).toFixed(1)}" y="${o.height - o.padBottom + 20}" text-anchor="middle">${rank}</text>`
        )
        .join("");

  const axisTitle = o.minimal
    ? ""
    : `
          <text class="chart-axis-title" x="${o.padLeft}" y="${o.height - 6}">works ranked by citations →</text>`;

  const squareRight = xSlot(h);
  const squareTop = y(h);
  const labelledBy = o.labelledBy ? ` aria-labelledby="${o.labelledBy}"` : "";

  return `<svg class="${o.className}" viewBox="0 0 ${o.width} ${o.height}" role="${o.role}"${labelledBy} preserveAspectRatio="xMidYMid meet">
          <g>${gridLines}
          </g>
          <rect class="chart-square" x="${o.padLeft}" y="${squareTop.toFixed(1)}" width="${(squareRight - o.padLeft).toFixed(1)}" height="${(o.padTop + plotHeight - squareTop).toFixed(1)}" />
          <g>${bars}
          </g>
          <line class="chart-threshold" x1="${o.padLeft}" x2="${(squareRight + 42).toFixed(1)}" y1="${squareTop.toFixed(1)}" y2="${squareTop.toFixed(1)}" />
          <line class="chart-threshold" x1="${squareRight.toFixed(1)}" x2="${squareRight.toFixed(1)}" y1="${squareTop.toFixed(1)}" y2="${o.padTop + plotHeight}" />
          <circle class="chart-crossing" cx="${squareRight.toFixed(1)}" cy="${squareTop.toFixed(1)}" r="3.5" />
          <text class="chart-callout" x="${(squareRight + 10).toFixed(1)}" y="${(squareTop - 10).toFixed(1)}">h = ${h}</text>${axisTitle}
          ${rankLabels}
        </svg>`;
};
