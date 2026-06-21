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

function getDailyKeys(startDate, endDate) {
  const keys = [];
  const cursor = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );

  while (cursor <= endDate) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

function getTrendSeries(items, range) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dailyTotals = groupExpenses(items, (item) => item.date);

  if (range === "thisYear") {
    const monthlyTotals = groupExpenses(items, (item) => item.date?.slice(0, 7));

    return Array.from({ length: today.getMonth() + 1 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      const key = `${today.getFullYear()}-${month}`;
      return { label: key, value: monthlyTotals[key] || 0 };
    });
  }

  let startDate;
  let endDate = today;

  if (range === "thisMonth") {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (range === "lastMonth") {
    startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    endDate = new Date(today.getFullYear(), today.getMonth(), 0);
  } else {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
  }

  return getDailyKeys(startDate, endDate).map((key) => ({
    label: key,
    value: dailyTotals[key] || 0,
  }));
}

function formatTrendLabel(value = "") {
  if (value.length === 7) {
    const monthIndex = Number(value.slice(5, 7)) - 1;
    return [
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
    ][monthIndex] || value;
  }

  const [, month, day] = value.split("-");
  return month && day ? `${day}-${month}` : value;
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

function DailyTrendChart({ items }) {
  if (items.length === 0) {
    return <div className="analytics-empty">No spending trend available.</div>;
  }

  const width = 720;
  const height = 220;
  const left = 28;
  const right = 20;
  const top = 22;
  const bottom = 42;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const peakValue = Math.max(...items.map((item) => item.value), 0);
  const maximum = Math.max(peakValue, 1);
  const divisor = Math.max(items.length - 1, 1);
  const points = items.map((item, index) => ({
    ...item,
    x: left + (index / divisor) * chartWidth,
    y: top + chartHeight - (item.value / maximum) * chartHeight,
  }));
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  const firstDate = formatTrendLabel(points[0]?.label);
  const lastDate = formatTrendLabel(points[points.length - 1]?.label);

  return (
    <div className="analytics-trend">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Daily spending trend for the selected date range"
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = top + chartHeight * ratio;
          return (
            <line
              key={ratio}
              x1={left}
              y1={y}
              x2={width - right}
              y2={y}
              className="analytics-trend__grid"
            />
          );
        })}
        <polyline points={pointString} className="analytics-trend__line" />
        {points.map((point) => (
          <circle
            key={point.label}
            cx={point.x}
            cy={point.y}
            r="4"
            className="analytics-trend__point"
          >
            <title>
              {point.label}: {formatCurrency(point.value)}
            </title>
          </circle>
        ))}
        <text x={left} y={height - 12} className="analytics-trend__label">
          {firstDate}
        </text>
        <text
          x={width - right}
          y={height - 12}
          textAnchor="end"
          className="analytics-trend__label"
        >
          {lastDate}
        </text>
        <text x={left} y={14} className="analytics-trend__value">
          Peak {formatCurrency(peakValue)}
        </text>
      </svg>
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
  const [trendRange, setTrendRange] = useState("last7");

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
      dailySeries: getTrendSeries(items, trendRange),
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
          <div className="analytics-card__header">
            <div>
              <span>Daily spending</span>
              <h4>Daily Spending</h4>
            </div>
            <label className="analytics-range-select">
              <span>Graph range</span>
              <select
                value={trendRange}
                onChange={(event) => setTrendRange(event.target.value)}
              >
                <option value="last7">Last 7 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="thisYear">This Year</option>
              </select>
            </label>
          </div>
          <DailyTrendChart items={analytics.dailySeries} />
        </article>

        <article className="analytics-card">
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

        <article className="analytics-card">
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

        <article className="analytics-card">
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

        <article className="analytics-card">
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
