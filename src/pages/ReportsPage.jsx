import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BalanceHistoryTable from "../components/balance/BalanceHistoryTable";
import Loading from "../components/common/Loading";
import ExportButtons from "../components/reports/ExportButtons";
import FullHistoryTable from "../components/reports/FullHistoryTable";
import ReportFilters from "../components/reports/ReportFilters";
import ReportSidebar from "../components/reports/ReportSidebar";
import ReportSummaryCards, {
  ReportsAnalytics,
} from "../components/reports/ReportSummaryCards";
import {
  getAllBalanceHistoryForReport,
  getAllExpensesForReport,
} from "../firebase/reportQueryService";
import {
  getReportOverview,
  getReportRecordCounts,
} from "../firebase/reportStatsService";
import {
  getCurrentMonthKey,
  getCurrentYear,
  getTodayDate,
  isDateInRange,
  isSameMonth,
  isSameYear,
} from "../utils/dateUtils";
import {
  calculateCashTotal,
  calculateGPayTotal,
  calculateTotal,
  getMostSpentDay,
  getMostUsedItem,
  toNumber,
} from "../utils/totalUtils";

const defaultFilters = {
  startDate: "",
  endDate: "",
  type: "all",
  paymentType: "all",
  period: "all",
};

const reportTitles = {
  history: "Full Expense History",
  analytics: "Analytics Workspace",
  balance: "Balance History",
  export: "Export and Backup",
};

function ReportsPage() {
  const [expenses, setExpenses] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [overview, setOverview] = useState(null);
  const [recordCounts, setRecordCounts] = useState({
    expenses: 0,
    balanceHistory: 0,
  });
  const [fullExpensesLoaded, setFullExpensesLoaded] = useState(false);
  const [fullBalanceLoaded, setFullBalanceLoaded] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [activeReport, setActiveReport] = useState("analytics");

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const expenseLoadPromiseRef = useRef(null);
  const balanceLoadPromiseRef = useRef(null);

  const ensureFullExpenses = useCallback(async ({ force = false } = {}) => {
    if (fullExpensesLoaded && !force) return expenses;
    if (expenseLoadPromiseRef.current && !force) {
      return expenseLoadPromiseRef.current;
    }

    const loadPromise = getAllExpensesForReport().then((items) => {
      setExpenses(items);
      setFullExpensesLoaded(true);
      return items;
    });
    expenseLoadPromiseRef.current = loadPromise;

    try {
      return await loadPromise;
    } finally {
      expenseLoadPromiseRef.current = null;
    }
  }, [expenses, fullExpensesLoaded]);

  const ensureFullBalanceHistory = useCallback(
    async ({ force = false } = {}) => {
      if (fullBalanceLoaded && !force) return balanceHistory;
      if (balanceLoadPromiseRef.current && !force) {
        return balanceLoadPromiseRef.current;
      }

      const loadPromise = getAllBalanceHistoryForReport().then((items) => {
        setBalanceHistory(items);
        setFullBalanceLoaded(true);
        return items;
      });
      balanceLoadPromiseRef.current = loadPromise;

      try {
        return await loadPromise;
      } finally {
        balanceLoadPromiseRef.current = null;
      }
    },
    [balanceHistory, fullBalanceLoaded]
  );

  async function loadReports({ background = false } = {}) {
    try {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const [overviewData, countData] = await Promise.all([
        getReportOverview(),
        getReportRecordCounts(),
      ]);

      setOverview(overviewData);
      setRecordCounts(countData);

      if (background && fullExpensesLoaded) {
        await ensureFullExpenses({ force: true });
      }
      if (background && fullBalanceLoaded) {
        await ensureFullBalanceHistory({ force: true });
      }
      setLastUpdated(
        new Intl.DateTimeFormat(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date())
      );
      setRefreshVersion((current) => current + 1);
    } catch (err) {
      console.error(err);
      setError("Failed to load reports");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    if (!isMobileFilterOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") setIsMobileFilterOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileFilterOpen]);

  function handleFilterChange(name, value) {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleResetFilters() {
    setFilters(defaultFilters);
  }

  function handleReportChange(nextReport) {
    setActiveReport(nextReport);
    setIsMobileFilterOpen(false);
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const dateMatch = isDateInRange(
        item.date,
        filters.startDate,
        filters.endDate
      );

      const typeMatch = filters.type === "all" || item.type === filters.type;

      const paymentMatch =
        filters.paymentType === "all" ||
        item.paymentType === filters.paymentType;

      const periodMatch =
        filters.period === "all" || item.period === filters.period;

      return dateMatch && typeMatch && paymentMatch && periodMatch;
    });
  }, [expenses, filters]);

  const analyticsExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const typeMatch = filters.type === "all" || item.type === filters.type;
      const paymentMatch =
        filters.paymentType === "all" ||
        item.paymentType === filters.paymentType;
      const periodMatch =
        filters.period === "all" || item.period === filters.period;

      return typeMatch && paymentMatch && periodMatch;
    });
  }, [expenses, filters.type, filters.paymentType, filters.period]);

  const activeFilterCount = useMemo(() => {
    const applicableKeys =
      activeReport === "balance"
        ? ["startDate", "endDate", "paymentType"]
        : ["startDate", "endDate", "type", "paymentType", "period"];

    return applicableKeys.filter(
      (key) => filters[key] !== defaultFilters[key]
    ).length;
  }, [activeReport, filters]);

  useEffect(() => {
    const reportNeedsDetailedExpenses = ["analytics", "export"].includes(
      activeReport
    );
    const needsExpenses =
      reportNeedsDetailedExpenses || activeFilterCount > 0;

    if (!needsExpenses) return;

    ensureFullExpenses().catch((loadError) => {
      console.error(loadError);
      setError("Unable to load the complete report dataset.");
    });

    if (activeReport === "export") {
      ensureFullBalanceHistory().catch((loadError) => {
        console.error(loadError);
        setError("Unable to load the complete backup dataset.");
      });
    }
  }, [
    activeFilterCount,
    activeReport,
    ensureFullBalanceHistory,
    ensureFullExpenses,
  ]);

  const todayDate = getTodayDate();
  const currentMonth = getCurrentMonthKey();
  const currentYear = getCurrentYear();

  const lifetimeTotal = useMemo(
    () =>
      fullExpensesLoaded
        ? calculateTotal(filteredExpenses)
        : toNumber(overview?.lifetimeTotal),
    [filteredExpenses, fullExpensesLoaded, overview]
  );

  const lifetimeCashTotal = useMemo(
    () =>
      fullExpensesLoaded
        ? calculateCashTotal(filteredExpenses)
        : toNumber(overview?.lifetimeCashTotal),
    [filteredExpenses, fullExpensesLoaded, overview]
  );

  const lifetimeGPayTotal = useMemo(
    () =>
      fullExpensesLoaded
        ? calculateGPayTotal(filteredExpenses)
        : toNumber(overview?.lifetimeGPayTotal),
    [filteredExpenses, fullExpensesLoaded, overview]
  );

  const todayTotal = useMemo(
    () =>
      fullExpensesLoaded
        ? calculateTotal(
            filteredExpenses.filter((item) => item.date === todayDate)
          )
        : toNumber(overview?.todayTotal),
    [filteredExpenses, fullExpensesLoaded, overview, todayDate]
  );

  const monthTotal = useMemo(
    () =>
      fullExpensesLoaded
        ? calculateTotal(
            filteredExpenses.filter((item) =>
              isSameMonth(item.date, currentMonth)
            )
          )
        : toNumber(overview?.monthTotal),
    [filteredExpenses, currentMonth, fullExpensesLoaded, overview]
  );

  const yearTotal = useMemo(
    () =>
      fullExpensesLoaded
        ? calculateTotal(
            filteredExpenses.filter((item) =>
              isSameYear(item.date, currentYear)
            )
          )
        : toNumber(overview?.yearTotal),
    [filteredExpenses, currentYear, fullExpensesLoaded, overview]
  );

  const mostSpentDay = useMemo(
    () =>
      fullExpensesLoaded
        ? getMostSpentDay(filteredExpenses)
        : overview?.mostSpentDay,
    [filteredExpenses, fullExpensesLoaded, overview]
  );

  const mostUsedItem = useMemo(
    () =>
      fullExpensesLoaded
        ? getMostUsedItem(filteredExpenses)
        : overview?.mostUsedItem,
    [filteredExpenses, fullExpensesLoaded, overview]
  );

  function renderActiveReport() {
    const requiresDetailedExpenses =
      ["analytics", "export"].includes(activeReport) || activeFilterCount > 0;

    if (requiresDetailedExpenses && !fullExpensesLoaded) {
      return <Loading message="Loading complete report data..." />;
    }

    if (activeReport === "history") {
      return (
        <FullHistoryTable
          filters={filters}
          refreshKey={refreshVersion}
          onOpenFilters={() => setIsMobileFilterOpen(true)}
          activeFilterCount={activeFilterCount}
        />
      );
    }

    if (activeReport === "analytics") {
      return (
        <div className="reports-analytics-workspace">
          <ReportSummaryCards
            lifetimeTotal={lifetimeTotal}
            lifetimeCashTotal={lifetimeCashTotal}
            lifetimeGPayTotal={lifetimeGPayTotal}
            todayTotal={todayTotal}
            monthTotal={monthTotal}
            yearTotal={yearTotal}
            mostSpentDay={mostSpentDay}
            mostUsedItem={mostUsedItem}
          />
          <ReportsAnalytics items={analyticsExpenses} />
        </div>
      );
    }

    if (activeReport === "balance") {
      return (
        <BalanceHistoryTable filters={filters} refreshKey={refreshVersion} />
      );
    }

    if (activeReport === "export") {
      if (!fullBalanceLoaded) {
        return <Loading message="Preparing complete backup data..." />;
      }

      return (
        <ExportButtons
          expenses={filteredExpenses}
          balanceHistory={balanceHistory}
        />
      );
    }

    return (
      <FullHistoryTable
        filters={filters}
        refreshKey={refreshVersion}
        onOpenFilters={() => setIsMobileFilterOpen(true)}
        activeFilterCount={activeFilterCount}
      />
    );
  }

  if (loading) {
    return <Loading message="Loading reports..." />;
  }

  return (
    <section className="reports-page-shell">
      <header className="reports-workspace-header">
        <div className="reports-workspace-header__content">
          <div className="reports-workspace-header__copy">
            <div className="reports-workspace-header__title-row">
              <h2>Reports</h2>
              <span>{reportTitles[activeReport] || "Reports"}</span>
            </div>

            <div className="reports-workspace-meta">
              <span>
                <strong>{recordCounts.expenses}</strong> expense records
              </span>
              <span>
                <strong>{recordCounts.balanceHistory}</strong> balance events
              </span>
              {lastUpdated && <span>Updated {lastUpdated}</span>}
            </div>
          </div>

          <button
            type="button"
            className={`reports-mobile-filter-btn${
              isMobileFilterOpen ? " reports-mobile-filter-btn--active" : ""
            }`}
            onClick={() => setIsMobileFilterOpen(true)}
            aria-label={
              activeFilterCount > 0
                ? `Open report filters, ${activeFilterCount} active`
                : "Open report filters"
            }
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 6H20M7 12H17M10 18H14"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
            {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
          </button>
        </div>

        <div className="reports-workspace-actions">
          <button
            type="button"
            className={
              isMobileFilterOpen
                ? "reports-action-btn reports-desktop-filter-btn reports-action-btn--active"
                : "reports-action-btn reports-desktop-filter-btn"
            }
            aria-pressed={isMobileFilterOpen}
            onClick={() => setIsMobileFilterOpen(true)}
          >
            <span className="reports-action-btn__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 6H20M7 12H17M10 18H14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="reports-action-filter-count">{activeFilterCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`reports-action-btn reports-action-btn--primary reports-refresh-btn${
              refreshing ? " reports-refresh-btn--loading" : ""
            }`}
            onClick={() => loadReports({ background: true })}
            disabled={refreshing}
          >
            <span className="reports-refresh-btn__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M20 7V3m0 0h-4m4 0-3.1 3.1A7 7 0 1 0 19 16" />
              </svg>
            </span>
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="error-box">
          <p>{error}</p>
        </div>
      )}

      <ReportSidebar
        activeReport={activeReport}
        onChange={handleReportChange}
      />

      <div className="reports-three-layout">
        <div className="reports-center-panel">
          <div
            key={activeReport}
            className="reports-dynamic-area report-workspace-panel"
          >
            {renderActiveReport()}
          </div>
        </div>
      </div>

      {isMobileFilterOpen && (
        <button
          type="button"
          className="reports-filter-backdrop"
          aria-label="Close report filters"
          onClick={() => setIsMobileFilterOpen(false)}
        />
      )}

      <aside
        className={
          isMobileFilterOpen
            ? "reports-right-panel reports-right-panel--open"
            : "reports-right-panel"
        }
        aria-hidden={!isMobileFilterOpen}
        inert={!isMobileFilterOpen}
      >
        <div className="reports-filter-mobile-header">
          <div>
            <span>Refine results</span>
            <h3>Report Filters</h3>
          </div>

          <button
            type="button"
            className="reports-filter-close"
            onClick={() => setIsMobileFilterOpen(false)}
          >
            Close
          </button>
        </div>

        <ReportFilters
          filters={filters}
          activeReport={activeReport}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />
      </aside>
    </section>
  );
}

export default ReportsPage;
