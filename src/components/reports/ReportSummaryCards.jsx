import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { PERIODS } from "../../utils/constants";
import { formatCurrency, toNumber } from "../../utils/totalUtils";
import AppIcon from "../common/AppIcon";

function capitalize(value = "") {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Unknown";
}

function formatCategoryLabel(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "mixed") return "Mixed (Multi-leg)";
  if (normalized === "gpay") return "GPay";
  return capitalize(normalized);
}

function useAnimatedAmount(value, duration = 720) {
  const target = toNumber(value);
  const previousTarget = useRef(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startValue = previousTarget.current;
    previousTarget.current = target;

    if (typeof window === "undefined") return undefined;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const animationFrame = window.requestAnimationFrame(() => {
        setDisplayValue(target);
      });
      return () => window.cancelAnimationFrame(animationFrame);
    }

    let animationFrame = 0;
    const startedAt = performance.now();
    const difference = target - startValue;

    const update = (timestamp) => {
      const progress = Math.min((timestamp - startedAt) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + difference * easedProgress);

      if (progress < 1) animationFrame = window.requestAnimationFrame(update);
    };

    animationFrame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [duration, target]);

  return displayValue;
}

function AnimatedCurrency({ value }) {
  const displayedValue = useAnimatedAmount(value);
  return (
    <span className="report-animated-value" aria-label={formatCurrency(value)}>
      {formatCurrency(displayedValue)}
    </span>
  );
}

function useRevealOnView() {
  const visibilityThreshold = 0.5;
  const elementRef = useRef(null);
  const [revealed, setRevealed] = useState(
    () =>
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element || revealed) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some(
            (entry) =>
              entry.isIntersecting &&
              entry.intersectionRatio >= visibilityThreshold
          )
        ) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: visibilityThreshold, rootMargin: "0px 0px -2% 0px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [revealed]);

  return [elementRef, revealed];
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
    .filter((entry) => entry.value > 0)
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

  const regularItems = items.filter((item) => !item.isTravelLog);
  const travelItems = items.filter((item) => Boolean(item.isTravelLog));
  const hasAnyTravel = travelItems.length > 0;

  const dailyTotals = groupExpenses(items, (item) => item.date);
  const dailyExpenseTotals = groupExpenses(regularItems, (item) => item.date);
  const dailyTravelTotals = groupExpenses(travelItems, (item) => item.date);

  const monthlyTotals = groupExpenses(items, (item) => item.date?.slice(0, 7));
  const monthlyExpenseTotals = groupExpenses(regularItems, (item) => item.date?.slice(0, 7));
  const monthlyTravelTotals = groupExpenses(travelItems, (item) => item.date?.slice(0, 7));

  if (range === "yearly") {
    const currentYear = today.getFullYear();
    const previousYear = currentYear - 1;
    const currentMonthIndex = today.getMonth();
    const series = MONTH_LABELS.map((label, index) => {
      const month = String(index + 1).padStart(2, "0");
      const isFutureMonth = index > currentMonthIndex;
      const currentMonthKey = `${currentYear}-${month}`;
      const previousMonthKey = `${previousYear}-${month}`;

      return {
        label,
        current: isFutureMonth ? null : monthlyTotals[currentMonthKey] || 0,
        currentExpense: isFutureMonth ? null : monthlyExpenseTotals[currentMonthKey] || 0,
        currentTravel: isFutureMonth ? null : monthlyTravelTotals[currentMonthKey] || 0,
        previous: monthlyTotals[previousMonthKey] || 0,
        previousExpense: monthlyExpenseTotals[previousMonthKey] || 0,
        previousTravel: monthlyTravelTotals[previousMonthKey] || 0,
        currentDetailKey: currentMonthKey,
        previousDetailKey: previousMonthKey,
        detailType: "month",
        isFuture: isFutureMonth,
      };
    });

    return {
      series,
      currentLabel: "This Year Spend",
      previousLabel: "Last Year Spend",
      dataThroughLabel: `${MONTH_LABELS[currentMonthIndex]} ${currentYear}`,
      hasAnyTravel,
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
    const dateKey = toDateKey(currentDate);
    const prevDateKey = toDateKey(previousDate);

    return {
      label: isWeekly
        ? formatShortDate(range === "lastWeek" ? previousDate : currentDate)
        : String(index + 1),
      current:
        currentExists && !isFutureCurrentDate
          ? dailyTotals[dateKey] || 0
          : null,
      currentExpense:
        currentExists && !isFutureCurrentDate
          ? dailyExpenseTotals[dateKey] || 0
          : null,
      currentTravel:
        currentExists && !isFutureCurrentDate
          ? dailyTravelTotals[dateKey] || 0
          : null,
      previous: previousExists ? dailyTotals[prevDateKey] || 0 : null,
      previousExpense: previousExists ? dailyExpenseTotals[prevDateKey] || 0 : null,
      previousTravel: previousExists ? dailyTravelTotals[prevDateKey] || 0 : null,
      currentDetailKey: currentExists ? dateKey : null,
      previousDetailKey: previousExists ? prevDateKey : null,
      detailType: "date",
      isFuture: range === "lastWeek" ? false : isFutureCurrentDate,
    };
  });

  let dataThroughDate = today;
  if (range === "lastWeek") dataThroughDate = addDays(previousStart, 6);
  if (range === "lastMonth") {
    dataThroughDate = new Date(
      currentStart.getFullYear(),
      currentStart.getMonth(),
      getDaysInMonth(currentStart)
    );
  }

  return {
    series,
    currentLabel,
    previousLabel,
    dataThroughLabel: formatShortDate(dataThroughDate),
    hasAnyTravel,
  };
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
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  if (n === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  const dx = [];
  const dy = [];
  const slopes = [];
  for (let i = 0; i < n - 1; i++) {
    const deltaX = points[i + 1].x - points[i].x;
    const deltaY = points[i + 1].y - points[i].y;
    dx.push(deltaX);
    dy.push(deltaY);
    slopes.push(deltaX !== 0 ? deltaY / deltaX : 0);
  }

  const tangents = new Array(n);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    const s0 = slopes[i - 1];
    const s1 = slopes[i];
    if (s0 * s1 <= 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (2 * s0 * s1) / (s0 + s1);
    }
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const segmentDx = dx[i] / 3;

    const cp1x = (p0.x + segmentDx).toFixed(2);
    const cp1y = (p0.y + tangents[i] * segmentDx).toFixed(2);

    const cp2x = (p1.x - segmentDx).toFixed(2);
    const cp2y = (p1.y - tangents[i + 1] * segmentDx).toFixed(2);

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }

  return path;
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


function getDetailItemName(item) {
  return String(item.name || item.description || "-").trim();
}

function formatItemDate(value = "") {
  if (!value) return "-";
  const parts = String(value).split("-").map(Number);
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const [year, month, day] = parts;
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
    }).format(new Date(year, month - 1, day));
  }
  const dateObj = new Date(value);
  if (!isNaN(dateObj.getTime())) {
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
    }).format(dateObj);
  }
  return value;
}

function compareDetailItems(first, second, key) {
  if (key === "date") {
    const diff = String(first.date || "").localeCompare(String(second.date || ""));
    if (diff !== 0) return diff;
    return getDetailItemName(first).localeCompare(
      getDetailItemName(second),
      undefined,
      { sensitivity: "base", numeric: true }
    );
  }

  if (key === "price") {
    const diff = toNumber(first.price) - toNumber(second.price);
    if (diff !== 0) return diff;
    return String(first.date || "").localeCompare(String(second.date || ""));
  }

  if (key === "payment") {
    const diff = formatPaymentName(first.paymentType).localeCompare(
      formatPaymentName(second.paymentType),
      undefined,
      { sensitivity: "base", numeric: true }
    );
    if (diff !== 0) return diff;
    return String(first.date || "").localeCompare(String(second.date || ""));
  }

  const diff = getDetailItemName(first).localeCompare(
    getDetailItemName(second),
    undefined,
    { sensitivity: "base", numeric: true }
  );
  if (diff !== 0) return diff;
  return String(first.date || "").localeCompare(String(second.date || ""));
}

function SortablePeriodDetails({ period, showDate = false }) {
  const [sortConfig, setSortConfig] = useState(() =>
    showDate ? { key: "date", direction: "asc" } : null
  );
  const periodTotal = useMemo(
    () =>
      period.items.reduce(
        (total, item) => total + toNumber(item.price),
        0
      ),
    [period.items]
  );

  const sortedItems = useMemo(() => {
    if (!sortConfig) return period.items;

    const direction = sortConfig.direction === "asc" ? 1 : -1;
    return [...period.items].sort(
      (first, second) =>
        compareDetailItems(first, second, sortConfig.key) * direction
    );
  }, [period.items, sortConfig]);

  function toggleSort(key) {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }

      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }

      return null;
    });
  }

  function renderSortHeader(label, key) {
    const isActive = sortConfig?.key === key;
    const direction = isActive ? sortConfig.direction : null;
    const nextDirection = !isActive
      ? "ascending"
      : direction === "asc"
      ? "descending"
      : "default order";

    return (
      <button
        type="button"
        className={`analytics-detail-sort-button${
          isActive ? " analytics-detail-sort-button--active" : ""
        }`}
        onClick={() => toggleSort(key)}
        aria-label={`Sort ${period.label} ${label} by ${nextDirection}`}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span className="analytics-detail-sort-indicator" aria-hidden="true">
          {direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}
        </span>
      </button>
    );
  }

  return (
    <section className="analytics-detail-period">
      <div className="analytics-detail-period__heading">
        <h4>{period.label}</h4>
        <span className="analytics-detail-period__summary">
          <span>
            {period.items.length} {period.items.length === 1 ? "item" : "items"}
          </span>
          <span aria-hidden="true">·</span>
          <strong>{formatCurrency(periodTotal)}</strong>
        </span>
      </div>

      <div className="analytics-detail-period__table-wrap">
        <table
          className={`analytics-detail-period__table${
            showDate ? " analytics-detail-period__table--with-date" : ""
          }`}
        >
          <thead>
            <tr>
              {showDate && <th scope="col">{renderSortHeader("Date", "date")}</th>}
              <th scope="col">{renderSortHeader("Item", "item")}</th>
              <th scope="col">{renderSortHeader("Payment", "payment")}</th>
              <th scope="col">{renderSortHeader("Price", "price")}</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              const itemName = getDetailItemName(item);
              const isTravel = Boolean(item.isTravelLog);
              const dateDisplay = formatItemDate(item.date);

              return (
                <tr key={item.id || `${item.date}-${itemName}-${item.price}-${index}`}>
                  {showDate && (
                    <td className="analytics-detail-date-cell">
                      <span
                        className="analytics-detail-item-date"
                        title={item.date || ""}
                      >
                        {dateDisplay}
                      </span>
                    </td>
                  )}
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        className="analytics-detail-item-name"
                        title={itemName}
                      >
                        {itemName}
                      </span>
                      {isTravel && (
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(245, 158, 11, 0.15)",
                            color: "#d97706",
                            fontWeight: 700,
                            letterSpacing: "0.03em",
                            textTransform: "uppercase",
                            flexShrink: 0,
                          }}
                        >
                          Travel
                        </span>
                      )}
                    </div>
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
  );
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
              <SortablePeriodDetails
                key={`${selection.detailType}-${selection.detailKey}-${period.value}`}
                period={period}
                showDate={selection.detailType === "month"}
              />
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

function SpendOverviewChart({
  comparison,
  selectedRange,
  items = [],
  travelView = "expenses",
  shouldAnimate = false,
}) {
  const { series, currentLabel, previousLabel, dataThroughLabel, hasAnyTravel } = comparison;
  const [activePoint, setActivePoint] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [lineFilter, setLineFilter] = useState("both"); // "both" | "expense" | "travel"
  const linePathRef = useRef(null);
  const areaPathRef = useRef(null);
  const revealClipRef = useRef(null);
  const terminalPointRef = useRef(null);
  const revealClipId = `spend-overview-reveal-${useId().replace(/:/g, "")}`;
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

  // If travel is not selected globally or not present, force "expense" filter strictly
  const effectiveFilter =
    !hasAnyTravel || travelView === "expenses"
      ? "expense"
      : travelView === "travel"
      ? "travel"
      : lineFilter;

  // Dynamic Y-axis scaling based on the effective line filter
  const numericValues = series
    .map((item) => {
      if (item[selectedKey] === null) return null;
      if (effectiveFilter === "travel") {
        return selectedKey === "previous" ? (item.previousTravel ?? 0) : (item.currentTravel ?? 0);
      }
      if (effectiveFilter === "expense") {
        return selectedKey === "previous"
          ? (item.previousExpense ?? item.previous ?? 0)
          : (item.currentExpense ?? item.current ?? 0);
      }
      return item[selectedKey];
    })
    .filter((value) => value !== null && value !== undefined);

  const peakValue = Math.max(...numericValues, 0);
  const step = peakValue > 0 ? getNiceStep(peakValue / 4) : 25;
  const maximum = Math.max(step * 4, 1);

  const toPoint = (item, index, key) => {
    const value = item[key];
    if (value === null) return null;

    const expenseValue =
      key === "previous"
        ? (item.previousExpense ?? value)
        : (item.currentExpense ?? value);
    const travelValue =
      key === "previous"
        ? (item.previousTravel ?? 0)
        : (item.currentTravel ?? 0);

    const plotValue =
      effectiveFilter === "travel"
        ? travelValue
        : effectiveFilter === "expense"
        ? expenseValue
        : value;

    return {
      label: item.label,
      value,
      expenseValue,
      travelValue,
      plotValue,
      hasTravel: travelValue > 0,
      hasExpense: expenseValue > 0,
      detailKey:
        key === "previous" ? item.previousDetailKey : item.currentDetailKey,
      detailType: item.detailType || "date",
      x: left + (index / divisor) * chartWidth,
      y: top + chartHeight - (plotValue / maximum) * chartHeight,
      expenseY: top + chartHeight - (expenseValue / maximum) * chartHeight,
      travelY: top + chartHeight - (travelValue / maximum) * chartHeight,
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
  const linePath = createSmoothPath(selectedPoints);
  const hasTravelInView = selectedPoints.some((p) => p.hasTravel);
  const expensePoints = selectedPoints.map((p) => ({
    x: p.x,
    y: p.expenseY,
  }));
  const expenseLinePath =
    effectiveFilter === "both" && hasTravelInView && selectedPoints.length > 1
      ? createSmoothPath(expensePoints)
      : "";

  const currentTotal = series.reduce((total, item) => {
    if (item.current === null) return total;
    if (effectiveFilter === "travel") return total + (item.currentTravel || 0);
    if (effectiveFilter === "expense") return total + (item.currentExpense || 0);
    return total + (item.current || 0);
  }, 0);

  const previousTotal = series.reduce((total, item) => {
    if (item.previous === null) return total;
    if (effectiveFilter === "travel") return total + (item.previousTravel || 0);
    if (effectiveFilter === "expense") return total + (item.previousExpense || 0);
    return total + (item.previous || 0);
  }, 0);

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

  const modeTitle =
    effectiveFilter === "travel"
      ? "Travel"
      : effectiveFilter === "expense"
      ? "Daily Expense"
      : "Total";
  const effectiveCurrentLabel = `${currentLabel.replace(" Spend", "")} (${modeTitle})`;
  const effectivePreviousLabel = `${previousLabel.replace(" Spend", "")} (${modeTitle})`;

  useLayoutEffect(() => {
    const lineElement = linePathRef.current;
    const areaElement = areaPathRef.current;
    const clipElement = revealClipRef.current;
    const terminalElement = terminalPointRef.current;
    if (!lineElement || !clipElement || !linePath) return undefined;

    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const revealStartX = left - 8;
    const revealWidth = chartWidth + 16;
    let animationFrame = 0;
    let cancelled = false;

    lineElement.getAnimations?.().forEach((animation) => animation.cancel());
    areaElement?.getAnimations?.().forEach((animation) => animation.cancel());

    lineElement.style.setProperty("animation", "none", "important");
    lineElement.style.setProperty("stroke-dasharray", "none", "important");
    lineElement.style.setProperty("stroke-dashoffset", "0", "important");

    function showCompleteChart() {
      clipElement.setAttribute("x", String(revealStartX));
      clipElement.setAttribute("width", String(revealWidth));
      if (areaElement) {
        areaElement.style.opacity = "1";
        areaElement.style.transform = "none";
      }
      if (terminalElement) terminalElement.style.opacity = "1";
    }

    if (reducedMotion) {
      showCompleteChart();
      return undefined;
    }

    clipElement.setAttribute("x", String(revealStartX));
    clipElement.setAttribute("width", "0");
    if (areaElement) {
      areaElement.style.opacity = "0";
      areaElement.style.transform = "none";
    }
    if (terminalElement) terminalElement.style.opacity = "0";

    if (!shouldAnimate) return undefined;

    const lineDuration = 1120;
    const areaDuration = 760;
    const areaDelay = 70;
    let startedAt;

    function animateFrame(timestamp) {
      if (cancelled) return;
      if (startedAt === undefined) startedAt = timestamp;
      const elapsed = timestamp - startedAt;
      const lineProgress = Math.min(elapsed / lineDuration, 1);
      const lineEased = 1 - Math.pow(1 - lineProgress, 3);

      clipElement.setAttribute("width", String(revealWidth * lineEased));

      if (areaElement) {
        const areaProgress = Math.min(
          Math.max((elapsed - areaDelay) / areaDuration, 0),
          1
        );
        const areaEased = 1 - Math.pow(1 - areaProgress, 3);
        areaElement.style.opacity = String(areaEased);
      }

      if (terminalElement) {
        const terminalProgress = Math.min(
          Math.max((lineProgress - 0.82) / 0.18, 0),
          1
        );
        terminalElement.style.opacity = String(terminalProgress);
      }

      if (lineProgress < 1) {
        animationFrame = window.requestAnimationFrame(animateFrame);
      } else {
        showCompleteChart();
      }
    }

    animationFrame = window.requestAnimationFrame(animateFrame);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, [linePath, areaPath, selectedRange, effectiveFilter, shouldAnimate, chartWidth, left]);

  return (
    <div className="spend-overview">
      <div className="spend-overview__legend">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {effectiveFilter === "both" && (
            <>
              <span>
                <i className="spend-overview__legend-line spend-overview__legend-line--current" />
                {hasTravelInView ? "Total Spend (Combined)" : selectedLabel.replace(" Spend", "")}
              </span>
              {hasTravelInView && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--reports-text, #334155)" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "16px",
                      height: "3px",
                      backgroundColor: "#06b6d4",
                      borderTop: "2px dashed #06b6d4",
                      borderRadius: "2px",
                    }}
                  />
                  Daily Expenses
                </span>
              )}
              {hasTravelInView && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--reports-text, #334155)" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      backgroundColor: "#f59e0b",
                      borderRadius: "50%",
                      boxShadow: "0 0 0 2px rgba(245, 158, 11, 0.35)",
                    }}
                  />
                  Travel Trips
                </span>
              )}
            </>
          )}

          {effectiveFilter === "expense" && (
            <span>
              <i
                className="spend-overview__legend-line"
                style={{ backgroundColor: "#06b6d4", boxShadow: "0 0 8px rgba(6, 182, 212, 0.35)" }}
              />
              {selectedLabel.replace(" Spend", "")} {hasAnyTravel ? "(Daily Expenses Only)" : ""}
            </span>
          )}

          {effectiveFilter === "travel" && (
            <span>
              <i
                className="spend-overview__legend-line"
                style={{ backgroundColor: "#f59e0b", boxShadow: "0 0 8px rgba(245, 158, 11, 0.35)" }}
              />
              {selectedLabel.replace(" Spend", "")} (Travel Only)
            </span>
          )}

          {/* Graph line filter pills: switch between Combined, Expenses, or Travel */}
          {hasAnyTravel && travelView === "both" && (
            <div className="spend-overview-line-mode-pills" role="radiogroup" aria-label="Graph line mode">
              <button
                type="button"
                className={`spend-pill ${effectiveFilter === "both" ? "spend-pill--active" : ""}`}
                onClick={() => setLineFilter("both")}
                title="Show combined total and expense dashed line"
              >
                <AppIcon name="layers" size={13} />
                <span>Both</span>
              </button>
              <button
                type="button"
                className={`spend-pill ${effectiveFilter === "expense" ? "spend-pill--active" : ""}`}
                onClick={() => setLineFilter("expense")}
                title="Show daily expenses only"
              >
                <AppIcon name="briefcase" size={13} />
                <span>Only Expense</span>
              </button>
              <button
                type="button"
                className={`spend-pill ${effectiveFilter === "travel" ? "spend-pill--active" : ""}`}
                onClick={() => setLineFilter("travel")}
                title="Show travel trips only"
              >
                <AppIcon name="plane" size={13} />
                <span>Only Travel</span>
              </button>
            </div>
          )}
        </div>
        <span className="spend-overview__through">
          <AppIcon name="calendar" size={13} />
          Data through {dataThroughLabel}
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
            <filter id="chartDotGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.25" />
            </filter>
            <linearGradient id="spendOverviewCombinedLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chart-combined-start, #6366f1)" />
              <stop offset="100%" stopColor="var(--chart-combined-end, #0ea5e9)" />
            </linearGradient>
            <linearGradient id="spendOverviewExpenseLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chart-expense-start, #06b6d4)" />
              <stop offset="100%" stopColor="var(--chart-expense-end, #0284c7)" />
            </linearGradient>
            <linearGradient id="spendOverviewTravelLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chart-travel-start, #f59e0b)" />
              <stop offset="100%" stopColor="var(--chart-travel-end, #ea580c)" />
            </linearGradient>
            <linearGradient id="spendOverviewCombinedArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-combined-start, #6366f1)" stopOpacity="0.22" />
              <stop offset="70%" stopColor="var(--chart-combined-end, #0ea5e9)" stopOpacity="0.05" />
              <stop offset="100%" stopColor="var(--chart-combined-end, #0ea5e9)" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="spendOverviewTravelArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-travel-start, #f59e0b)" stopOpacity="0.25" />
              <stop offset="70%" stopColor="var(--chart-travel-end, #ea580c)" stopOpacity="0.06" />
              <stop offset="100%" stopColor="var(--chart-travel-end, #ea580c)" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="spendOverviewExpenseArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-expense-start, #06b6d4)" stopOpacity="0.22" />
              <stop offset="70%" stopColor="var(--chart-expense-end, #0284c7)" stopOpacity="0.05" />
              <stop offset="100%" stopColor="var(--chart-expense-end, #0284c7)" stopOpacity="0.00" />
            </linearGradient>
            <clipPath id={revealClipId} clipPathUnits="userSpaceOnUse">
              <rect
                ref={revealClipRef}
                x={left - 8}
                y={top - 8}
                width="0"
                height={chartHeight + 16}
              />
            </clipPath>
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
                  stroke="var(--chart-grid-line, rgba(148, 163, 184, 0.2))"
                  strokeWidth="1"
                  strokeDasharray="3 4"
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
              ref={areaPathRef}
              d={areaPath}
              fill={
                effectiveFilter === "travel"
                  ? "url(#spendOverviewTravelArea)"
                  : effectiveFilter === "expense"
                  ? "url(#spendOverviewExpenseArea)"
                  : "url(#spendOverviewCombinedArea)"
              }
              className={`analytics-trend__area ${
                effectiveFilter === "travel"
                  ? "analytics-trend__area--travel"
                  : "analytics-trend__area--current"
              }`}
              clipPath={`url(#${revealClipId})`}
            />
          )}

          {/* Daily Expense dashed line (in "both" mode) */}
          {expenseLinePath && (
            <path
              d={expenseLinePath}
              fill="none"
              stroke="var(--chart-expense-start, #06b6d4)"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="analytics-trend__line--expense"
              clipPath={`url(#${revealClipId})`}
            />
          )}

          <path
            ref={linePathRef}
            d={linePath}
            fill="none"
            stroke={
              effectiveFilter === "travel"
                ? "url(#spendOverviewTravelLine)"
                : effectiveFilter === "expense"
                ? "url(#spendOverviewExpenseLine)"
                : "url(#spendOverviewCombinedLine)"
            }
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="analytics-trend__line analytics-trend__line--current"
            clipPath={`url(#${revealClipId})`}
          />

          {lastPoint && lastPoint.plotValue > 0 && (
            <g
              ref={terminalPointRef}
              className="analytics-trend__terminal-point"
              aria-hidden="true"
            >
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="9"
                fill={
                  effectiveFilter === "travel"
                    ? "var(--chart-travel-start, #f59e0b)"
                    : effectiveFilter === "expense"
                    ? "var(--chart-expense-start, #06b6d4)"
                    : "var(--chart-combined-start, #6366f1)"
                }
                opacity="0.25"
              />
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="4"
                fill={
                  effectiveFilter === "travel"
                    ? "var(--chart-travel-start, #f59e0b)"
                    : effectiveFilter === "expense"
                    ? "var(--chart-expense-start, #06b6d4)"
                    : "var(--chart-combined-start, #6366f1)"
                }
              />
            </g>
          )}

          {/* Visible interactive data dots for ALL points with clear visual hierarchy */}
          {selectedPoints.map((point, index) => {
            const isZero = point.plotValue === 0;
            const isSelected = activePoint?.x === point.x;

            if (isZero) {
              return (
                <circle
                  key={`zero-dot-${point.label}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={isSelected ? 4 : 2}
                  fill={isSelected ? "var(--reports-primary, #6366f1)" : "var(--chart-grid-line, #94a3b8)"}
                  opacity={isSelected ? 0.9 : 0.35}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setActivePoint(point);
                    setSelectedDetail(point);
                  }}
                />
              );
            }

            if (effectiveFilter === "travel") {
              return (
                <g
                  key={`travel-dot-${point.label}-${index}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setActivePoint(point);
                    setSelectedDetail(point);
                  }}
                >
                  {/* Subtle ambient aura ring around travel gem */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isSelected ? 11 : 8.5}
                    fill="none"
                    stroke="var(--chart-travel-start, #f59e0b)"
                    strokeWidth={isSelected ? "2" : "1.4"}
                    opacity={isSelected ? "0.9" : "0.55"}
                  />
                  {/* Primary amber gem dot */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isSelected ? 6.5 : 5}
                    fill="var(--chart-travel-start, #f59e0b)"
                    stroke="var(--chart-dot-border, #ffffff)"
                    strokeWidth="2.5"
                    filter="url(#chartDotGlow)"
                  />
                </g>
              );
            }

            if (effectiveFilter === "expense") {
              return (
                <g
                  key={`expense-dot-${point.label}-${index}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setActivePoint(point);
                    setSelectedDetail(point);
                  }}
                >
                  {isSelected && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="10.5"
                      fill="none"
                      stroke="var(--chart-expense-start, #06b6d4)"
                      strokeWidth="2"
                      opacity="0.75"
                    />
                  )}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isSelected ? 6.5 : 4.8}
                    fill="var(--chart-expense-start, #06b6d4)"
                    stroke="var(--chart-dot-border, #ffffff)"
                    strokeWidth="2.5"
                    filter="url(#chartDotGlow)"
                  />
                </g>
              );
            }

            // Both (Combined) mode
            const hasTravel = point.hasTravel;
            const hasExpense = point.hasExpense;

            return (
              <g
                key={`both-dot-${point.label}-${index}`}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setActivePoint(point);
                  setSelectedDetail(point);
                }}
              >
                {/* For days with travel: amber aura */}
                {hasTravel && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isSelected ? 11 : 8.5}
                    fill="none"
                    stroke="var(--chart-travel-start, #f59e0b)"
                    strokeWidth={isSelected ? "2" : "1.4"}
                    opacity={isSelected ? "0.9" : "0.55"}
                  />
                )}

                {/* Primary gem on combined curve */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isSelected ? 6.5 : hasTravel ? 5.5 : 4.8}
                  fill={
                    hasTravel
                      ? "var(--chart-travel-start, #f59e0b)"
                      : "var(--chart-combined-start, #6366f1)"
                  }
                  stroke="var(--chart-dot-border, #ffffff)"
                  strokeWidth="2.5"
                  filter="url(#chartDotGlow)"
                />

                {/* If point has both daily expense and travel, cyan gem at daily expense level */}
                {hasTravel && hasExpense && (
                  <circle
                    cx={point.x}
                    cy={point.expenseY}
                    r={isSelected ? 4.5 : 3.5}
                    fill="var(--chart-expense-start, #06b6d4)"
                    stroke="var(--chart-dot-border, #ffffff)"
                    strokeWidth="1.8"
                    filter="url(#chartDotGlow)"
                  />
                )}
              </g>
            );
          })}

          {selectedPoints.map((point, index) => (
            <circle
              key={`${point.label}-${point.value}-${index}`}
              cx={point.x}
              cy={point.y}
              r="14"
              className="analytics-trend__hit-area"
              onMouseEnter={() => setActivePoint(point)}
              onFocus={() => setActivePoint(point)}
              onClick={() => {
                setActivePoint(point);
                setSelectedDetail(point);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActivePoint(point);
                  setSelectedDetail(point);
                }
              }}
              tabIndex="0"
              aria-label={`${point.label}: ${formatCurrency(point.plotValue)}${
                point.hasTravel ? " (includes travel)" : ""
              }`}
            />
          ))}

          {activePoint && (
            <g className="analytics-trend__active-layer">
              <line
                x1={activePoint.x}
                y1={top}
                x2={activePoint.x}
                y2={baselineY}
                stroke="var(--chart-crosshair, rgba(100, 116, 139, 0.4))"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                className="analytics-trend__crosshair"
              />
              {/* Outer halo */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="13"
                fill="none"
                stroke={
                  effectiveFilter === "travel"
                    ? "var(--chart-travel-start, #f59e0b)"
                    : effectiveFilter === "expense"
                    ? "var(--chart-expense-start, #06b6d4)"
                    : activePoint.hasTravel
                    ? "var(--chart-travel-start, #f59e0b)"
                    : "var(--chart-combined-start, #6366f1)"
                }
                strokeWidth="2"
                opacity="0.4"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="6.5"
                className="analytics-trend__active-dot"
                fill={
                  effectiveFilter === "travel"
                    ? "var(--chart-travel-start, #f59e0b)"
                    : effectiveFilter === "expense"
                    ? "var(--chart-expense-start, #06b6d4)"
                    : activePoint.hasTravel
                    ? "var(--chart-travel-start, #f59e0b)"
                    : "var(--chart-combined-start, #6366f1)"
                }
                stroke="var(--chart-dot-border, #ffffff)"
                strokeWidth="2.5"
                filter="url(#chartDotGlow)"
              />
              {(() => {
                const showBreakdown = effectiveFilter === "both" && activePoint.hasTravel;
                const tooltipWidth = showBreakdown ? 220 : 180;
                const tooltipHeight = showBreakdown ? 66 : 50;
                const tooltipX = Math.min(
                  Math.max(activePoint.x - tooltipWidth / 2, left + 8),
                  width - right - tooltipWidth - 8
                );
                const tooltipY = Math.max(activePoint.y - tooltipHeight - 14, top + 8);

                const mainText =
                  effectiveFilter === "travel"
                    ? `Travel: ${formatCurrency(activePoint.travelValue)}`
                    : effectiveFilter === "expense"
                    ? `Expense: ${formatCurrency(activePoint.expenseValue)}`
                    : activePoint.hasTravel
                    ? `Total: ${formatCurrency(activePoint.value)}`
                    : `Spend: ${formatCurrency(activePoint.value)}`;

                return (
                  <g className="analytics-trend__svg-tooltip" transform={`translate(${tooltipX} ${tooltipY})`}>
                    <rect
                      width={tooltipWidth}
                      height={tooltipHeight}
                      rx="8"
                      className="analytics-trend__tooltip-box"
                    />
                    <text x="12" y="17" className="analytics-trend__tooltip-title">
                      {activePoint.label}
                    </text>
                    <text x="12" y="35" className="analytics-trend__tooltip-value">
                      {mainText}
                    </text>
                    {showBreakdown && (
                      <text x="12" y="52" className="analytics-trend__tooltip-breakdown" fill="var(--chart-travel-start, #f59e0b)" fontSize="11" fontWeight="600">
                        Daily: {formatCurrency(activePoint.expenseValue)} · Travel: {formatCurrency(activePoint.travelValue)}
                      </text>
                    )}
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
                        x={tooltipWidth - 75}
                        y={showBreakdown ? 22 : 18}
                        width="70"
                        height="24"
                        rx="4"
                      />
                      <text x={tooltipWidth - 10} y={showBreakdown ? 37 : 34} textAnchor="end">View details ›</text>
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
                className={`analytics-trend__label${
                  item.isFuture ? " analytics-trend__label--future" : ""
                }`}
              >
                {item.label}
              </text>
            );
          })}
        </svg>

        {activePoint && (
          <div className="spend-overview__mobile-point-card" role="status">
            <div className="spend-overview__mobile-point-copy">
              <span>{activePoint.label}</span>
              <strong>
                {effectiveFilter === "travel"
                  ? `Travel: ${formatCurrency(activePoint.travelValue)}`
                  : effectiveFilter === "expense"
                  ? `Expense: ${formatCurrency(activePoint.expenseValue)}`
                  : `Spend: ${formatCurrency(activePoint.value)}`}
              </strong>
              {effectiveFilter === "both" && activePoint.hasTravel && (
                <small style={{ color: "#f59e0b", display: "block", marginTop: "2px", fontWeight: 600 }}>
                  Daily: {formatCurrency(activePoint.expenseValue)} · Travel: {formatCurrency(activePoint.travelValue)}
                </small>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedDetail(activePoint)}
              aria-label={`View spending details for ${activePoint.label}`}
            >
              View details
            </button>
          </div>
        )}
      </div>

      <div className="spend-overview__summary">
        <div>
          <span>{effectiveCurrentLabel}</span>
          <strong>{formatCurrency(currentTotal)}</strong>
        </div>
        <div>
          <span>{effectivePreviousLabel}</span>
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
    "mixed",
    "flight",
    "auto",
    "travel",
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

  if (["bus", "train", "mixed", "flight", "auto", "travel", "food"].includes(type)) return true;
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
  const donutSegments = data.map((item, index) => {
    const previousValue = data
      .slice(0, index)
      .reduce((sum, entry) => sum + toNumber(entry.value), 0);
    const percentage = total > 0 ? item.value / total : 0;
    return {
      item,
      index,
      dash: Math.max(percentage * circumference - 2, 0),
      offset: total > 0 ? (previousValue / total) * circumference : 0,
    };
  });
  const activeItem = activeIndex !== null ? data[activeIndex] : null;
  const centerValue = activeItem ? activeItem.value : total;
  const centerLabel = activeItem ? formatCategoryLabel(activeItem.label) : config.centerLabel;
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
          {donutSegments.map(({ item, index, dash, offset }) => {
            return (
              <circle
                key={`${item.label}-${index}`}
                cx="80"
                cy="80"
                r={radius}
                className={`distribution-donut__segment distribution-donut__segment--${index % 7}`}
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={-offset}
                style={{
                  "--donut-offset": -offset,
                  "--donut-start-offset": circumference - offset,
                  "--donut-delay": `${index * 65}ms`,
                  opacity: activeIndex === null || activeIndex === index ? 1 : 0.32,
                }}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                tabIndex="0"
                aria-label={`${formatCategoryLabel(item.label)}: ${formatCurrency(item.value)}`}
              />
            );
          })}
        </svg>
        <div className="distribution-donut__center" aria-hidden="true">
          <strong>{activePercent !== null ? `${activePercent}%` : formatCurrency(centerValue)}</strong>
          <span>{activePercent !== null ? formatCurrency(centerValue) : centerLabel}</span>
        </div>
      </div>

      <div
        className="distribution-donut__legend"
        style={{ maxHeight: "300px", overflowY: "auto", paddingRight: "4px" }}
        onMouseLeave={() => setActiveIndex(null)}
      >
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
                {formatCategoryLabel(item.label)}
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

export function ReportsAnalytics({ items = [], travelView = "expenses" }) {
  const [trendRange, setTrendRange] = useState("thisWeek");
  const [distributionMode, setDistributionMode] = useState("type");
  const [trendRef, trendRevealed] = useRevealOnView();
  const [distributionRef, distributionRevealed] = useRevealOnView();

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
      typeSeries: toSortedSeries(typeTotals, 30),
      periodSeries: orderedPeriods,
      itemSeries: toSortedSeries(itemTotals, 20),
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
        <article
          ref={trendRef}
          className={`analytics-card analytics-card--trend analytics-card--scroll-reveal${
            trendRevealed ? " analytics-card--revealed" : ""
          }`}
          {...getTiltProps()}
        >
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
            key={`${trendRange}-${travelView}`}
            comparison={analytics.spendComparison}
            selectedRange={trendRange}
            items={items}
            travelView={travelView}
            shouldAnimate={trendRevealed}
          />
        </article>

        <article
          ref={distributionRef}
          className={`analytics-card analytics-card--distribution analytics-card--scroll-reveal${
            distributionRevealed ? " analytics-card--revealed" : ""
          }`}
          {...getTiltProps()}
        >
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
          <DistributionDonut
            key={distributionMode}
            mode={distributionMode}
            analytics={analytics}
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
  includeTravel = false,
  travelView = "expenses",
  travelStats = { total: 0, count: 0 },
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {travelView === "travel" && travelStats?.count > 0 && (
            <div
              className="report-travel-breakdown-banner"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "rgba(245, 158, 11, 0.14)",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                fontSize: "0.8rem",
                color: "#d97706",
                fontWeight: "600",
              }}
            >
              <AppIcon name="plane" size={14} />
              <span>
                Showing only travel expenses ({travelStats.count} trips totaling {formatCurrency(travelStats.total)})
              </span>
            </div>
          )}
          {travelView === "both" && travelStats?.count > 0 && (
            <div
              className="report-travel-breakdown-banner"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "color-mix(in srgb, var(--primary, #0ea5e9) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--primary, #0ea5e9) 28%, transparent)",
                fontSize: "0.8rem",
                color: "var(--primary, #0284c7)",
                fontWeight: "600",
              }}
            >
              <AppIcon name="plane" size={14} />
              <span>
                Includes {formatCurrency(travelStats.total)} from {travelStats.count} travel trips
              </span>
            </div>
          )}
          <p>Updates automatically with active filters.</p>
        </div>
      </div>

      <div className="report-primary-grid">
        <article className="report-kpi report-kpi--total">
          <span className="report-kpi__marker" aria-hidden="true" />
          <span className="report-stat-icon report-stat-icon--total"><AppIcon name="wallet" /></span>
          <p>Total Spend</p>
          <h3><AnimatedCurrency value={lifetimeTotal} /></h3>
          <small>Cash and GPay combined</small>
        </article>

        <article className="report-kpi report-kpi--cash">
          <span className="report-kpi__marker" aria-hidden="true" />
          <span className="report-stat-icon report-stat-icon--cash"><AppIcon name="cash" /></span>
          <p>Cash Spend</p>
          <h3><AnimatedCurrency value={lifetimeCashTotal} /></h3>
          <small>Paid from cash balance</small>
        </article>

        <article className="report-kpi report-kpi--gpay">
          <span className="report-kpi__marker" aria-hidden="true" />
          <span className="report-stat-icon report-stat-icon--gpay"><AppIcon name="phone" /></span>
          <p>GPay Spend</p>
          <h3><AnimatedCurrency value={lifetimeGPayTotal} /></h3>
          <small>Paid from GPay balance</small>
        </article>
      </div>

      <div className="report-secondary-grid">
        <article className="report-mini-stat">
          <span className="report-stat-icon"><AppIcon name="calendar" /></span>
          <p>Today</p>
          <strong><AnimatedCurrency value={todayTotal} /></strong>
        </article>
        <article className="report-mini-stat">
          <span className="report-stat-icon"><AppIcon name="calendar" /></span>
          <p>This Month</p>
          <strong><AnimatedCurrency value={monthTotal} /></strong>
        </article>
        <article className="report-mini-stat">
          <span className="report-stat-icon"><AppIcon name="calendar" /></span>
          <p>This Year</p>
          <strong><AnimatedCurrency value={yearTotal} /></strong>
        </article>
        <article className="report-mini-stat">
          <span className="report-stat-icon report-stat-icon--trend"><AppIcon name="trend" /></span>
          <p>Highest Spend Day</p>
          <strong>{mostSpentDay?.date || "-"}</strong>
          <small><AnimatedCurrency value={mostSpentDay?.total || 0} /></small>
        </article>
        <article className="report-mini-stat">
          <span className="report-stat-icon report-stat-icon--repeat"><AppIcon name="repeat" /></span>
          <p>Most Used Item</p>
          <strong>{mostUsedItemName}</strong>
          <small>{mostUsedItem?.count || 0} times</small>
        </article>
      </div>
    </section>
  );
}

export default ReportSummaryCards;
