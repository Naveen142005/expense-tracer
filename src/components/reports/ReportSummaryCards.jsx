import { useMemo, useState } from "react";
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
    const series = MONTH_LABELS.map((label, index) => {
      const month = String(index + 1).padStart(2, "0");

      return {
        label,
        current: index <= today.getMonth()
          ? monthlyTotals[`${currentYear}-${month}`] || 0
          : null,
        previous: monthlyTotals[`${previousYear}-${month}`] || 0,
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
    const currentExists = index < currentDays && currentDate <= today;
    const previousExists = index < previousDays;

    return {
      label: isWeekly
        ? formatShortDate(range === "lastWeek" ? previousDate : currentDate)
        : String(index + 1),
      current: currentExists ? dailyTotals[toDateKey(currentDate)] || 0 : null,
      previous: previousExists ? dailyTotals[toDateKey(previousDate)] || 0 : null,
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

function SpendOverviewChart({ comparison, selectedRange }) {
  const { series, currentLabel, previousLabel } = comparison;
  const width = 820;
  const height = 390;
  const left = 56;
  const right = 18;
  const top = 18;
  const bottom = 42;
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
      x: left + (index / divisor) * chartWidth,
      y: top + chartHeight - (value / maximum) * chartHeight,
    };
  };
  const selectedPoints = series
    .map((item, index) => toPoint(item, index, selectedKey))
    .filter(Boolean);
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
  const labelInterval = series.length <= 7 ? 1 : series.length <= 12 ? 2 : 5;

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
        >
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
                  {formatAxisValue(value)}
                </text>
              </g>
            );
          })}

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
              r="9"
              className="analytics-trend__hit-area"
            >
              <title>
                {point.label}: {formatCurrency(point.value)}
              </title>
            </circle>
          ))}

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

    return {
      spendComparison: getSpendComparison(items, trendRange),
      typeSeries: toSortedSeries(typeTotals, 6),
      periodSeries: orderedPeriods,
      itemSeries: toSortedSeries(itemTotals, 6),
      cashTotal,
      gpayTotal,
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
        <article className="analytics-card analytics-card--trend">
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
          />
        </article>

        <article className="analytics-card analytics-card--payment">
          <div className="analytics-card__header">
            <div>
              <span>Distribution</span>
              <h4>Payment Split</h4>
            </div>
          </div>
          <PaymentSplit
            cashTotal={analytics.cashTotal}
            gpayTotal={analytics.gpayTotal}
          />
        </article>

        <article className="analytics-card analytics-card--type">
          <div className="analytics-card__header">
            <div>
              <span>Categories</span>
              <h4>Spend by Type</h4>
            </div>
          </div>
          <HorizontalBars
            items={analytics.typeSeries}
            emptyMessage="No type data available."
          />
        </article>

        <article className="analytics-card analytics-card--period">
          <div className="analytics-card__header">
            <div>
              <span>Time of day</span>
              <h4>Spend by Period</h4>
            </div>
          </div>
          <HorizontalBars
            items={analytics.periodSeries}
            emptyMessage="No period data available."
          />
        </article>

        <article className="analytics-card analytics-card--items">
          <div className="analytics-card__header">
            <div>
              <span>Highest totals</span>
              <h4>Top Items</h4>
            </div>
          </div>
          <HorizontalBars
            items={analytics.itemSeries}
            emptyMessage="No item data available."
          />
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
