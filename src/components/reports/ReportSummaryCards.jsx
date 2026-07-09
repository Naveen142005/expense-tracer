import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PERIODS } from "../../utils/constants";
import { formatCurrency, toNumber } from "../../utils/totalUtils";

function capitalize(value = "") {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Unknown";
}

function groupExpenses(items, getKey) {
  return items.reduce((result, item) => {
    const key = getKey(item) || "unknown";
    result[key] = (result[key] || 0) + toNumber(item.price);
    return result;
  }, {});
}

function toSortedSeries(data, limit) {
  return Object.entries(data)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function getMonday(date) {
  const day = date.getDay() || 7;
  return addDays(date, 1 - day);
}

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function getSpendComparison(items, range) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dailyTotals = groupExpenses(items, (item) => item.date);
  const monthlyTotals = groupExpenses(items, (item) => item.date?.slice(0, 7));

  if (range === "yearly") {
    const currentYear = today.getFullYear();
    const previousYear = currentYear - 1;
    const currentMonthIndex = today.getMonth();
    const series = MONTH_LABELS.map((label, index) => {
      const month = String(index + 1).padStart(2, "0");
      const isFutureMonth = index > currentMonthIndex;

      return {
        label,
        current: isFutureMonth ? null : monthlyTotals[`${currentYear}-${month}`] || 0,
        previous: monthlyTotals[`${previousYear}-${month}`] || 0,
        currentDetailKey: `${currentYear}-${month}`,
        previousDetailKey: `${previousYear}-${month}`,
        detailType: "month",
      };
    });

    return {
      series,
      currentLabel: "This Year Spend",
      previousLabel: "Last Year Spend",
    };
  }

  let currentStart;
  let previousStart;
  let length;
  let currentLabel;
  let previousLabel;

  const isWeekly = range === "thisWeek" || range === "lastWeek";

  if (range === "monthly") {
    currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
    previousStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    length = Math.max(
      getDaysInMonth(currentStart),
      getDaysInMonth(previousStart)
    );
    currentLabel = "This Month Spend";
    previousLabel = "Last Month Spend";
  } else if (range === "lastMonth") {
    currentStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    previousStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    length = Math.max(
      getDaysInMonth(currentStart),
      getDaysInMonth(previousStart)
    );
    currentLabel = "Last Month Spend";
    previousLabel = "Previous Month Spend";
  } else {
    currentStart = getMonday(today);
    previousStart = addDays(currentStart, -7);
    length = 7;
    currentLabel = "This Week Spend";
    previousLabel = "Last Week Spend";
  }

  const currentDays = isWeekly ? length : getDaysInMonth(currentStart);
  const previousDays = isWeekly ? length : getDaysInMonth(previousStart);
  const series = Array.from({ length }, (_, index) => {
    const currentDate = addDays(currentStart, index);
    const previousDate = addDays(previousStart, index);
    const currentExists = index < currentDays;
    const previousExists = index < previousDays;

    const isFutureCurrentDate = currentDate > today;

    return {
      label: isWeekly
        ? formatShortDate(range === "lastWeek" ? previousDate : currentDate)
        : String(index + 1),
      current:
        currentExists && !isFutureCurrentDate
          ? dailyTotals[toDateKey(currentDate)] || 0
          : null,
      previous: previousExists ? dailyTotals[toDateKey(previousDate)] || 0 : null,
      currentDetailKey: currentExists ? toDateKey(currentDate) : null,
      previousDetailKey: previousExists ? toDateKey(previousDate) : null,
      detailType: "date",
    };
  });

  return { series, currentLabel, previousLabel };
}

function getNiceStep(value) {
  if (value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function formatAxisValue(value) {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(Math.round(value));
}

function createSmoothPath(points) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.slice(0, -1).reduce((path, point, index) => {
    const previous = points[index - 1] || point;
    const next = points[index + 1];
    const afterNext = points[index + 2] || next;
    const minimumY = Math.min(point.y, next.y);
    const maximumY = Math.max(point.y, next.y);
    const controlOneY = Math.min(
      maximumY,
      Math.max(minimumY, point.y + (next.y - previous.y) / 6)
    );
    const controlTwoY = Math.min(
      maximumY,
      Math.max(minimumY, next.y - (afterNext.y - point.y) / 6)
    );

    return `${path} C ${point.x + (next.x - previous.x) / 6} ${controlOneY}, ${
      next.x - (afterNext.x - point.x) / 6
    } ${controlTwoY}, ${next.x} ${next.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}


function formatDateKeyLabel(value = "") {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value || "Unknown";

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  }).format(new Date(year, month - 1, day));
}

function parseDateKey(value = "") {
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getEndDateForRecentSeries(dailyMap) {
  const dateKeys = Object.keys(dailyMap).filter(Boolean).sort();
  const latestExpenseDate = parseDateKey(dateKeys[dateKeys.length - 1]);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!latestExpenseDate) return today;
  return latestExpenseDate > today ? latestExpenseDate : today;
}

function buildContinuousDailySeries(dailyMap, length = 10) {
  const endDate = getEndDateForRecentSeries(dailyMap);
  const startDate = addDays(endDate, -(length - 1));

  return Array.from({ length }, (_, index) => {
    const date = addDays(startDate, index);
    const dateKey = toDateKey(date);
    const summary = dailyMap[dateKey] || { value: 0, count: 0 };

    return {
      dateKey,
      label: formatDateKeyLabel(dateKey),
      value: summary.value || 0,
      count: summary.count || 0,
    };
  });
}

function getTiltProps() {
  return {};
}

function HorizontalBars({ items, emptyMessage }) {
  if (items.length === 0) {
    return <div className="analytics-empty">{emptyMessage}</div>;
  }

  const peakValue = Math.max(...items.map((item) => item.value), 0);
  const maximum = Math.max(peakValue, 1);

  return (
    <div className="analytics-bars">
      {items.map((item) => (
        <div key={item.label} className="analytics-bar-row">
          <div className="analytics-bar-row__label">
            <span>{capitalize(item.label)}</span>
            <strong>{formatCurrency(item.value)}</strong>
          </div>
          <div className="analytics-bar-row__track">
            <span style={{ width: `${(item.value / maximum) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}


function formatDetailPeriod(detailKey, detailType) {
  if (!detailKey) return "Spending details";

  if (detailType === "month") {
    const [year, month] = detailKey.split("-").map(Number);
    if (!year || !month) return detailKey;
    return new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, 1));
  }

  const date = parseDateKey(detailKey);
  if (!date) return detailKey;
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatPaymentName(value = "") {
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "gpay") return "GPay";
  return capitalize(normalized || "unknown");
}

function ExpenseDetailsModal({ selection, items, onClose }) {
  const detailItems = useMemo(() => {
    if (!selection?.detailKey) return [];

    return items.filter((item) => {
      if (selection.detailType === "month") {
        return String(item.date || "").slice(0, 7) === selection.detailKey;
      }
      return item.date === selection.detailKey;
    });
  }, [items, selection]);

  const groupedPeriods = useMemo(() => {
    const knownPeriods = new Set(PERIODS.map((period) => period.value));

    return PERIODS.map((period) => {
      const periodItems = detailItems.filter((item) => {
        const itemPeriod = String(item.period || "other").trim().toLowerCase();
        const normalizedPeriod = knownPeriods.has(itemPeriod) ? itemPeriod : "other";
        return normalizedPeriod === period.value;
      });

      return {
        ...period,
        items: periodItems,
      };
    }).filter((period) => period.items.length > 0);
  }, [detailItems]);

  const detailTotal = useMemo(
    () => detailItems.reduce((total, item) => total + toNumber(item.price), 0),
    [detailItems]
  );

  useEffect(() => {
    if (!selection) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selection, onClose]);

  if (!selection) return null;

  const periodLabel = formatDetailPeriod(
    selection.detailKey,
    selection.detailType
  );

  return createPortal(
    <div
      className="analytics-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="analytics-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-detail-title"
      >
        <header className="analytics-detail-modal__header">
          <div>
            <span>Spending details</span>
            <h3 id="analytics-detail-title">{periodLabel}</h3>
          </div>
          <button
            type="button"
            className="analytics-detail-modal__close"
            onClick={onClose}
            aria-label="Close spending details"
            autoFocus
          >
            ×
          </button>
        </header>

        <div className="analytics-detail-modal__meta">
          <span>
            {detailItems.length} {detailItems.length === 1 ? "item" : "items"}
          </span>
        </div>

        <div className="analytics-detail-sections">
          {groupedPeriods.length > 0 ? (
            groupedPeriods.map((period) => (
              <section className="analytics-detail-period" key={period.value}>
                <div className="analytics-detail-period__heading">
                  <h4>{period.label}</h4>
                  <span>
                    {period.items.length} {period.items.length === 1 ? "item" : "items"}
                  </span>
                </div>

                <div className="analytics-detail-period__table-wrap">
                  <table className="analytics-detail-period__table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Payment</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {period.items.map((item, index) => {
                        const itemName = item.name || item.description || "-";

                        return (
                          <tr key={item.id || `${item.date}-${itemName}-${index}`}>
                            <td>
                              <span
                                className="analytics-detail-item-name"
                                title={itemName}
                              >
                                {itemName}
                              </span>
                            </td>
                            <td>{formatPaymentName(item.paymentType)}</td>
                            <td>{formatCurrency(item.price)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </section>
            ))
          ) : (
            <div className="analytics-detail-empty">
              No expenses were recorded for this period.
            </div>
          )}
        </div>

        {groupedPeriods.length > 0 ? (
          <footer className="analytics-detail-modal__grand-total">
            <span>Overall total</span>
            <strong>{formatCurrency(detailTotal)}</strong>
          </footer>
        ) : null}
      </section>
    </div>,
    document.body
  );
}

function SpendOverviewChart({ comparison, selectedRange, items = [] }) {
  const { series, currentLabel, previousLabel } = comparison;
  const [activePoint, setActivePoint] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const width = 620;
  const height = 340;
  const left = 48;
  const right = 14;
  const top = 18;
  const bottom = 40;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const divisor = Math.max(series.length - 1, 1);
  const selectedKey = selectedRange === "lastWeek" ? "previous" : "current";
  const selectedLabel =
    selectedKey === "previous" ? previousLabel : currentLabel;
  const numericValues = series
    .map((item) => item[selectedKey])
    .filter((value) => value !== null);
  const peakValue = Math.max(...numericValues, 0);
  const step = peakValue > 0 ? getNiceStep(peakValue / 4) : 25;
  const maximum = step * 4;
  const toPoint = (item, index, key) => {
    const value = item[key];
    if (value === null) return null;

    return {
      label: item.label,
      value,
      detailKey:
        key === "previous" ? item.previousDetailKey : item.currentDetailKey,
      detailType: item.detailType || "date",
      x: left + (index / divisor) * chartWidth,
      y: top + chartHeight - (value / maximum) * chartHeight,
    };
  };
  const selectedPoints = series
    .map((item, index) => toPoint(item, index, selectedKey))
    .filter(Boolean);
  const firstPoint = selectedPoints[0];
  const lastPoint = selectedPoints[selectedPoints.length - 1];
  const baselineY = top + chartHeight;
  const areaPath =
    selectedPoints.length > 1
      ? `${createSmoothPath(selectedPoints)} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`
      : "";
  const currentTotal = series.reduce(
    (total, item) => total + (item.current || 0),
    0
  );
  const previousTotal = series.reduce(
    (total, item) => total + (item.previous || 0),
    0
  );
  const spendDifference = currentTotal - previousTotal;
  const changePercentage =
    previousTotal > 0 ? (Math.abs(spendDifference) / previousTotal) * 100 : null;
  const changeLabel =
    previousTotal === 0
      ? currentTotal === 0
        ? "No spend"
        : "No prior spend"
      : spendDifference > 0
      ? `${changePercentage.toFixed(1)}% more`
      : spendDifference < 0
      ? `${changePercentage.toFixed(1)}% less`
      : "No change";
  const changeClass =
    previousTotal === 0 || spendDifference === 0
      ? "spend-overview__change--neutral"
      : spendDifference > 0
      ? "spend-overview__change--more"
      : "spend-overview__change--less";
  const labelInterval = series.length <= 10 ? 1 : series.length <= 16 ? 2 : 5;

  return (
    <div className="spend-overview">
      <div className="spend-overview__legend" aria-hidden="true">
        <span>
          <i className="spend-overview__legend-line spend-overview__legend-line--current" />
          {selectedLabel.replace(" Spend", "")}
        </span>
      </div>

      <div className="analytics-trend spend-overview__chart">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${selectedLabel} spending trend`}
          onMouseLeave={() => setActivePoint(null)}
        >
          <defs>
            <linearGradient id="spendOverviewArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" className="analytics-trend__area-stop analytics-trend__area-stop--top" />
              <stop offset="100%" className="analytics-trend__area-stop analytics-trend__area-stop--bottom" />
            </linearGradient>
          </defs>
          {Array.from({ length: 5 }, (_, index) => {
            const value = maximum - step * index;
            const y = top + (index / 4) * chartHeight;

            return (
              <g key={value}>
                <line
                  x1={left}
                  y1={y}
                  x2={width - right}
                  y2={y}
                  className="analytics-trend__grid"
                />
                <text
                  x={left - 12}
                  y={y + 4}
                  textAnchor="end"
                  className="analytics-trend__label analytics-trend__label--axis"
                >
                  ₹{formatAxisValue(value)}
                </text>
              </g>
            );
          })}

          {areaPath && (
            <path
              d={areaPath}
              className="analytics-trend__area analytics-trend__area--current"
            />
          )}

          <path
            d={createSmoothPath(selectedPoints)}
            className="analytics-trend__line analytics-trend__line--current"
          />

          {selectedPoints.length === 1 && selectedPoints.map((point) => (
            <circle
              key={`visible-${point.label}`}
              cx={point.x}
              cy={point.y}
              r="4"
              className="analytics-trend__visible-point"
            />
          ))}

          {selectedPoints.map((point, index) => (
            <circle
              key={`${point.label}-${point.value}-${index}`}
              cx={point.x}
              cy={point.y}
              r="12"
              className="analytics-trend__hit-area"
              onMouseEnter={() => setActivePoint(point)}
              onFocus={() => setActivePoint(point)}
              onClick={() => setActivePoint(point)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActivePoint(point);
                }
              }}
              tabIndex="0"
              aria-label={`${point.label}: ${formatCurrency(point.value)}`}
            />
          ))}

          {activePoint && (
            <g className="analytics-trend__active-layer">
              <line
                x1={activePoint.x}
                y1={top}
                x2={activePoint.x}
                y2={baselineY}
                className="analytics-trend__crosshair"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="5"
                className="analytics-trend__active-dot"
              />
              {(() => {
                const tooltipWidth = 176;
                const tooltipHeight = 48;
                const tooltipX = Math.min(
                  Math.max(activePoint.x - tooltipWidth / 2, left + 8),
                  width - right - tooltipWidth - 8
                );
                const tooltipY = Math.max(activePoint.y - tooltipHeight - 14, top + 8);

                return (
                  <g transform={`translate(${tooltipX} ${tooltipY})`}>
                    <rect
                      width={tooltipWidth}
                      height={tooltipHeight}
                      rx="9"
                      className="analytics-trend__tooltip-box"
                    />
                    <text x="10" y="16" className="analytics-trend__tooltip-title">
                      {activePoint.label}
                    </text>
                    <text x="10" y="35" className="analytics-trend__tooltip-value">
                      Spend: {formatCurrency(activePoint.value)}
                    </text>
                    <g
                      className="analytics-trend__details-button"
                      role="button"
                      tabIndex="0"
                      onClick={() => setSelectedDetail(activePoint)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedDetail(activePoint);
                        }
                      }}
                      aria-label={`View spending details for ${activePoint.label}`}
                    >
                      <rect
                        className="analytics-trend__details-hitbox"
                        x="105"
                        y="20"
                        width="61"
                        height="20"
                        rx="4"
                      />
                      <text x="166" y="35" textAnchor="end">View details</text>
                    </g>
                  </g>
                );
              })()}
            </g>
          )}

          {series.map((item, index) => {
            const shouldShow =
              index === 0 ||
              index === series.length - 1 ||
              index % labelInterval === 0;

            if (!shouldShow) return null;

            return (
              <text
                key={`${item.label}-${index}`}
                x={left + (index / divisor) * chartWidth}
                y={height - 12}
                textAnchor={
                  index === 0
                    ? "start"
                    : index === series.length - 1
                    ? "end"
                    : "middle"
                }
                className="analytics-trend__label"
              >
                {item.label}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="spend-overview__summary">
        <div>
          <span>{currentLabel}</span>
          <strong>{formatCurrency(currentTotal)}</strong>
        </div>
        <div>
          <span>{previousLabel}</span>
          <strong>{formatCurrency(previousTotal)}</strong>
        </div>
        <span className={`spend-overview__change ${changeClass}`}>
          {changeLabel}
        </span>
      </div>

      <ExpenseDetailsModal
        selection={selectedDetail}
        items={items}
        onClose={() => setSelectedDetail(null)}
      />
    </div>
  );
}


function DailySpendBars({ items, emptyMessage }) {
  const [activeBar, setActiveBar] = useState(null);

  if (items.length === 0) {
    return <div className="analytics-empty">{emptyMessage}</div>;
  }

  const width = 600;
  const height = 235;
  const left = 48;
  const right = 16;
  const top = 18;
  const bottom = 40;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const peakValue = Math.max(...items.map((item) => item.value), 0);
  const step = peakValue > 0 ? getNiceStep(peakValue / 3) : 25;
  const maximum = Math.max(step * 3, 1);
  const slotWidth = chartWidth / items.length;
  const barWidth = Math.min(24, Math.max(12, slotWidth * 0.32));

  return (
    <div className="daily-bars-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Daily spending bar chart"
        onMouseLeave={() => setActiveBar(null)}
      >
        {Array.from({ length: 4 }, (_, index) => {
          const value = step * index;
          const y = top + chartHeight - (value / maximum) * chartHeight;
          return (
            <g key={`daily-grid-${index}`}>
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                className="daily-bars-chart__grid"
              />
              <text
                x={left - 10}
                y={y + 4}
                textAnchor="end"
                className="daily-bars-chart__axis"
              >
                ₹{formatAxisValue(value)}
              </text>
            </g>
          );
        })}

        {items.map((item, index) => {
          const x = left + index * slotWidth + (slotWidth - barWidth) / 2;
          const barHeight = (item.value / maximum) * chartHeight;
          const y = top + chartHeight - barHeight;
          const labelY = height - 15;

          return (
            <g key={item.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, item.value > 0 ? 4 : 0)}
                rx="3"
                className="daily-bars-chart__bar"
                onMouseEnter={() => setActiveBar({ ...item, x, y })}
                onFocus={() => setActiveBar({ ...item, x, y })}
                tabIndex="0"
                aria-label={`${item.label}: ${formatCurrency(item.value)}`}
              />
              <text
                x={x + barWidth / 2}
                y={labelY}
                textAnchor="middle"
                className="daily-bars-chart__label"
              >
                {item.label}
              </text>
            </g>
          );
        })}

        {activeBar && (
          <g aria-hidden="true">
            {(() => {
              const tooltipWidth = 108;
              const tooltipHeight = 48;
              const tooltipX = Math.min(
                Math.max(activeBar.x - tooltipWidth / 2 + barWidth / 2, left + 8),
                width - right - tooltipWidth - 8
              );
              const tooltipY = Math.max(activeBar.y - tooltipHeight - 12, top + 8);

              return (
                <g transform={`translate(${tooltipX} ${tooltipY})`}>
                  <rect
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx="10"
                    className="daily-bars-chart__tooltip-box"
                  />
                  <text x="12" y="17" className="daily-bars-chart__tooltip-title">
                    {activeBar.label}
                  </text>
                  <text x="12" y="32" className="daily-bars-chart__tooltip-value">
                    {formatCurrency(activeBar.value)}
                  </text>
                  {activeBar.count ? (
                    <text x="12" y="43" className="daily-bars-chart__tooltip-meta">
                      {activeBar.count} entries
                    </text>
                  ) : null}
                </g>
              );
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}


const DISTRIBUTION_OPTIONS = [
  { value: "type", label: "Type-wise Spending" },
  { value: "payment", label: "Payment Split" },
  { value: "period", label: "Period-wise Spending" },
  { value: "needs", label: "Needs vs Wants" },
  { value: "topCategory", label: "Top Category Share" },
  { value: "budget", label: "Monthly Budget Usage" },
  { value: "cashUsage", label: "Cash Usage" },
];

function normalizeDistributionKey(value = "") {
  return String(value).trim().toLowerCase();
}

function getMonthlyBudgetValue() {
  if (typeof window === "undefined") return 0;

  const possibleKeys = [
    "monthlyBudget",
    "expenseMonthlyBudget",
    "expense_tracker_monthly_budget",
  ];

  for (const key of possibleKeys) {
    const value = Number(window.localStorage.getItem(key));
    if (Number.isFinite(value) && value > 0) return value;
  }

  return 0;
}

function isEssentialExpense(item) {
  const type = normalizeDistributionKey(item.type);
  const name = normalizeDistributionKey(item.name || item.description);
  const essentialWords = [
    "bus",
    "train",
    "office",
    "home",
    "room",
    "food",
    "rice",
    "idly",
    "idli",
    "dosa",
    "poori",
    "meal",
    "egg",
    "curd",
    "medicine",
    "medical",
  ];

  if (["bus", "food"].includes(type)) return true;
  return essentialWords.some((word) => name.includes(word));
}

function buildDistributionData(mode, analytics) {
  const total = analytics.cashTotal + analytics.gpayTotal;

  if (mode === "type") {
    return {
      title: "Type-wise Spending",
      centerLabel: "Total",
      data: analytics.typeSeries,
    };
  }

  if (mode === "payment") {
    return {
      title: "Payment Split",
      centerLabel: "Total",
      data: [
        { label: "Cash", value: analytics.cashTotal },
        { label: "GPay", value: analytics.gpayTotal },
      ].filter((item) => item.value > 0),
    };
  }

  if (mode === "period") {
    return {
      title: "Period-wise Spending",
      centerLabel: "Total",
      data: analytics.periodSeries,
    };
  }

  if (mode === "needs") {
    return {
      title: "Needs vs Wants",
      centerLabel: "Total",
      data: [
        { label: "Needs", value: analytics.needsTotal },
        { label: "Wants", value: analytics.wantsTotal },
      ].filter((item) => item.value > 0),
    };
  }

  if (mode === "topCategory") {
    const top = analytics.typeSeries[0];
    if (!top) {
      return {
        title: "Top Category Share",
        centerLabel: "Total",
        data: [],
      };
    }

    return {
      title: "Top Category Share",
      centerLabel: top.label,
      data: [
        { label: capitalize(top.label), value: top.value },
        { label: "Remaining", value: Math.max(total - top.value, 0) },
      ].filter((item) => item.value > 0),
    };
  }

  if (mode === "budget") {
    const budget = getMonthlyBudgetValue();
    if (!budget) {
      return {
        title: "Monthly Budget Usage",
        centerLabel: "Budget",
        data: [],
        emptyMessage: "No monthly budget is set.",
      };
    }

    return {
      title: "Monthly Budget Usage",
      centerLabel: "Budget",
      data: [
        { label: "Spent", value: Math.min(total, budget) },
        { label: "Remaining", value: Math.max(budget - total, 0) },
        ...(total > budget ? [{ label: "Over budget", value: total - budget }] : []),
      ].filter((item) => item.value > 0),
    };
  }

  return {
    title: "Cash Usage",
    centerLabel: "Cash",
    data: [
      { label: "Cash", value: analytics.cashTotal },
      { label: "Non-cash", value: analytics.gpayTotal },
    ].filter((item) => item.value > 0),
  };
}

function DistributionDonut({ mode, analytics }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const config = buildDistributionData(mode, analytics);
  const data = config.data || [];
  const total = data.reduce((sum, item) => sum + toNumber(item.value), 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const activeItem = activeIndex !== null ? data[activeIndex] : null;
  const centerValue = activeItem ? activeItem.value : total;
  const centerLabel = activeItem ? capitalize(activeItem.label) : config.centerLabel;
  const activePercent = activeItem && total > 0 ? Math.round((activeItem.value / total) * 100) : null;

  if (!total) {
    return (
      <div className="distribution-donut distribution-donut--empty">
        <div className="analytics-empty">
          {config.emptyMessage || "No distribution data available."}
        </div>
      </div>
    );
  }

  return (
    <div className="distribution-donut">
      <div className="distribution-donut__visual">
        <svg viewBox="0 0 160 160" role="img" aria-label={config.title}>
          <circle
            cx="80"
            cy="80"
            r={radius}
            className="distribution-donut__track"
          />
          {data.map((item, index) => {
            const percentage = item.value / total;
            const dash = Math.max(percentage * circumference - 2, 0);
            const segment = (
              <circle
                key={`${item.label}-${index}`}
                cx="80"
                cy="80"
                r={radius}
                className={`distribution-donut__segment distribution-donut__segment--${index % 7}`}
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={-offset}
                style={{ opacity: activeIndex === null || activeIndex === index ? 1 : 0.32 }}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                tabIndex="0"
                aria-label={`${capitalize(item.label)}: ${formatCurrency(item.value)}`}
              />
            );
            offset += percentage * circumference;
            return segment;
          })}
        </svg>
        <div className="distribution-donut__center" aria-hidden="true">
          <strong>{activePercent !== null ? `${activePercent}%` : formatCurrency(centerValue)}</strong>
          <span>{activePercent !== null ? formatCurrency(centerValue) : centerLabel}</span>
        </div>
      </div>

      <div className="distribution-donut__legend" onMouseLeave={() => setActiveIndex(null)}>
        <div className="distribution-donut__legend-heading">
          <span>{config.title}</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <button
              type="button"
              key={`${item.label}-${index}`}
              className={
                activeIndex === index
                  ? "distribution-donut__legend-item distribution-donut__legend-item--active"
                  : "distribution-donut__legend-item"
              }
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
            >
              <span className={`distribution-donut__dot distribution-donut__dot--${index % 7}`} />
              <span className="distribution-donut__legend-label">
                {capitalize(item.label)}
              </span>
              <strong>{formatCurrency(item.value)}</strong>
              <small>{percentage.toFixed(0)}%</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PaymentSplit({ cashTotal, gpayTotal }) {
  const total = cashTotal + gpayTotal;
  const cashPercentage = total > 0 ? (cashTotal / total) * 100 : 0;
  const gpayPercentage = total > 0 ? (gpayTotal / total) * 100 : 0;

  return (
    <div className="payment-split">
      <div className="payment-split__track" aria-label="Cash and GPay split">
        <span
          className="payment-split__cash"
          style={{ width: `${cashPercentage}%` }}
        />
        <span
          className="payment-split__gpay"
          style={{ width: `${gpayPercentage}%` }}
        />
      </div>
      <div className="payment-split__legend">
        <div>
          <span className="payment-split__dot payment-split__dot--cash" />
          <p>Cash</p>
          <strong>{formatCurrency(cashTotal)}</strong>
          <small>{cashPercentage.toFixed(0)}%</small>
        </div>
        <div>
          <span className="payment-split__dot payment-split__dot--gpay" />
          <p>GPay</p>
          <strong>{formatCurrency(gpayTotal)}</strong>
          <small>{gpayPercentage.toFixed(0)}%</small>
        </div>
      </div>
    </div>
  );
}

export function ReportsAnalytics({ items = [] }) {
  const [trendRange, setTrendRange] = useState("thisWeek");
  const [distributionMode, setDistributionMode] = useState("type");

  const analytics = useMemo(() => {
    const typeTotals = groupExpenses(items, (item) => item.type);
    const periodTotals = groupExpenses(items, (item) => item.period);
    const itemTotals = groupExpenses(
      items,
      (item) => item.name || item.description || "unknown"
    );
    const cashTotal = items
      .filter((item) => item.paymentType === "cash")
      .reduce((total, item) => total + toNumber(item.price), 0);
    const gpayTotal = items
      .filter((item) => item.paymentType === "gpay")
      .reduce((total, item) => total + toNumber(item.price), 0);
    const orderedPeriods = PERIODS.map((period) => ({
      label: period.label,
      value: periodTotals[period.value] || 0,
    })).filter((item) => item.value > 0);
    const needsTotal = items
      .filter((item) => isEssentialExpense(item))
      .reduce((total, item) => total + toNumber(item.price), 0);
    const wantsTotal = items
      .filter((item) => !isEssentialExpense(item))
      .reduce((total, item) => total + toNumber(item.price), 0);
    const dailyMap = items.reduce((result, item) => {
      if (!item.date) return result;
      const current = result[item.date] || { value: 0, count: 0 };
      current.value += toNumber(item.price);
      current.count += 1;
      result[item.date] = current;
      return result;
    }, {});
    const dailySeries = items.length > 0 ? buildContinuousDailySeries(dailyMap, 10) : [];

    return {
      spendComparison: getSpendComparison(items, trendRange),
      typeSeries: toSortedSeries(typeTotals, 6),
      periodSeries: orderedPeriods,
      itemSeries: toSortedSeries(itemTotals, 6),
      dailySeries,
      cashTotal,
      gpayTotal,
      needsTotal,
      wantsTotal,
    };
  }, [items, trendRange]);

  return (
    <section className="reports-analytics" aria-labelledby="analytics-title">
      <div className="reports-section-heading">
        <div>
          <span className="reports-section-heading__eyebrow">Analytics</span>
          <h3 id="analytics-title">Spending Patterns</h3>
        </div>
        <p>Type, payment, and period filters apply.</p>
      </div>

      <div className="reports-analytics-grid">
        <article className="analytics-card analytics-card--trend" {...getTiltProps()}>
          <div className="analytics-card__header analytics-card__header--overview">
            <h4>Spend Overview</h4>
            <label className="analytics-range-select">
              <select
                value={trendRange}
                onChange={(event) => setTrendRange(event.target.value)}
                aria-label="Spend overview range"
              >
                <option value="thisWeek">This Week</option>
                <option value="lastWeek">Last Week</option>
                <option value="monthly">Monthly</option>
                <option value="lastMonth">Last Month</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
          </div>
          <SpendOverviewChart
            comparison={analytics.spendComparison}
            selectedRange={trendRange}
            items={items}
          />
        </article>

        <article className="analytics-card analytics-card--distribution" {...getTiltProps()}>
          <div className="analytics-card__header analytics-card__header--distribution">
            <div>
              <span>Distribution</span>
              <h4>Smart Donut Chart</h4>
            </div>
            <label className="analytics-range-select analytics-distribution-select">
              <select
                value={distributionMode}
                onChange={(event) => setDistributionMode(event.target.value)}
                aria-label="Distribution chart type"
              >
                {DISTRIBUTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <DistributionDonut mode={distributionMode} analytics={analytics} />
        </article>

      </div>
    </section>
  );
}

function ReportSummaryCards({
  lifetimeTotal = 0,
  lifetimeCashTotal = 0,
  lifetimeGPayTotal = 0,
  todayTotal = 0,
  monthTotal = 0,
  yearTotal = 0,
  mostSpentDay,
  mostUsedItem,
}) {
  const mostUsedItemName = mostUsedItem?.name
    ? capitalize(mostUsedItem.name)
    : "-";

  return (
    <section className="reports-summary" aria-labelledby="summary-title">
      <div className="reports-section-heading reports-section-heading--summary">
        <div>
          <span className="reports-section-heading__eyebrow">Overview</span>
          <h3 id="summary-title">Spending Summary</h3>
        </div>
        <p>Updates automatically with active filters.</p>
      </div>

      <div className="report-primary-grid">
        <article className="report-kpi report-kpi--total">
          <span className="report-kpi__marker" aria-hidden="true" />
          <p>Total Spend</p>
          <h3>{formatCurrency(lifetimeTotal)}</h3>
          <small>Cash and GPay combined</small>
        </article>

        <article className="report-kpi report-kpi--cash">
          <span className="report-kpi__marker" aria-hidden="true" />
          <p>Cash Spend</p>
          <h3>{formatCurrency(lifetimeCashTotal)}</h3>
          <small>Paid from cash balance</small>
        </article>

        <article className="report-kpi report-kpi--gpay">
          <span className="report-kpi__marker" aria-hidden="true" />
          <p>GPay Spend</p>
          <h3>{formatCurrency(lifetimeGPayTotal)}</h3>
          <small>Paid from GPay balance</small>
        </article>
      </div>

      <div className="report-secondary-grid">
        <article className="report-mini-stat">
          <p>Today</p>
          <strong>{formatCurrency(todayTotal)}</strong>
        </article>
        <article className="report-mini-stat">
          <p>This Month</p>
          <strong>{formatCurrency(monthTotal)}</strong>
        </article>
        <article className="report-mini-stat">
          <p>This Year</p>
          <strong>{formatCurrency(yearTotal)}</strong>
        </article>
        <article className="report-mini-stat">
          <p>Highest Spend Day</p>
          <strong>{mostSpentDay?.date || "-"}</strong>
          <small>{formatCurrency(mostSpentDay?.total || 0)}</small>
        </article>
        <article className="report-mini-stat">
          <p>Most Used Item</p>
          <strong>{mostUsedItemName}</strong>
          <small>{mostUsedItem?.count || 0} times</small>
        </article>
      </div>
    </section>
  );
}

export default ReportSummaryCards;
