import { useEffect, useMemo, useState } from "react";
import BalanceHistoryTable from "../components/balance/BalanceHistoryTable";
import Loading from "../components/common/Loading";
import DateWiseReport from "../components/reports/DateWiseReport";
import ExportButtons from "../components/reports/ExportButtons";
import FullHistoryTable from "../components/reports/FullHistoryTable";
import ItemWiseReport from "../components/reports/ItemWiseReport";
import PaymentWiseReport from "../components/reports/PaymentWiseReport";
import PeriodWiseReport from "../components/reports/PeriodWiseReport";
import ReportFilters from "../components/reports/ReportFilters";
import ReportSidebar from "../components/reports/ReportSidebar";
import ReportSummaryCards, {
  ReportsAnalytics,
} from "../components/reports/ReportSummaryCards";
import TypeWiseReport from "../components/reports/TypeWiseReport";
import { getAllBalanceHistory } from "../firebase/balanceService";
import { getAllExpenses } from "../firebase/expenseService";
import {
  getCurrentMonthKey,
  getCurrentYear,
  getMonthKeyFromDate,
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
  groupTotalByKey,
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
  type: "Type-wise Analysis",
  payment: "Payment Analysis",
  period: "Period Analysis",
  date: "Date-wise Analysis",
  month: "Month-wise Analysis",
  item: "Item Analysis",
  balance: "Balance History",
  export: "Export and Backup",
};

function groupItemTotals(items) {
  return items.reduce((result, item) => {
    const key = item.name || item.description || "unknown";
    result[key] = (result[key] || 0) + toNumber(item.price);
    return result;
  }, {});
}

function groupMonthTotals(items) {
  return items.reduce((result, item) => {
    const monthKey = getMonthKeyFromDate(item.date);
    result[monthKey] = (result[monthKey] || 0) + toNumber(item.price);
    return result;
  }, {});
}

function ReportsPage() {
  const [expenses, setExpenses] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [activeReport, setActiveReport] = useState("history");

  const [isReportMenuOpen, setIsReportMenuOpen] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [showMobileCards, setShowMobileCards] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  async function loadReports({ background = false } = {}) {
    try {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const [expenseData, balanceHistoryData] = await Promise.all([
        getAllExpenses(),
        getAllBalanceHistory(),
      ]);

      setExpenses(expenseData);
      setBalanceHistory(balanceHistoryData);
      setLastUpdated(
        new Intl.DateTimeFormat(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date())
      );
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

  const todayDate = getTodayDate();
  const currentMonth = getCurrentMonthKey();
  const currentYear = getCurrentYear();

  const lifetimeTotal = useMemo(
    () => calculateTotal(filteredExpenses),
    [filteredExpenses]
  );

  const lifetimeCashTotal = useMemo(
    () => calculateCashTotal(filteredExpenses),
    [filteredExpenses]
  );

  const lifetimeGPayTotal = useMemo(
    () => calculateGPayTotal(filteredExpenses),
    [filteredExpenses]
  );

  const todayTotal = useMemo(
    () =>
      calculateTotal(filteredExpenses.filter((item) => item.date === todayDate)),
    [filteredExpenses, todayDate]
  );

  const monthTotal = useMemo(
    () =>
      calculateTotal(
        filteredExpenses.filter((item) => isSameMonth(item.date, currentMonth))
      ),
    [filteredExpenses, currentMonth]
  );

  const yearTotal = useMemo(
    () =>
      calculateTotal(
        filteredExpenses.filter((item) => isSameYear(item.date, currentYear))
      ),
    [filteredExpenses, currentYear]
  );

  const typeTotals = useMemo(
    () => groupTotalByKey(filteredExpenses, "type"),
    [filteredExpenses]
  );

  const periodTotals = useMemo(
    () => groupTotalByKey(filteredExpenses, "period"),
    [filteredExpenses]
  );

  const paymentTotals = useMemo(
    () => groupTotalByKey(filteredExpenses, "paymentType"),
    [filteredExpenses]
  );

  const dateTotals = useMemo(
    () => groupTotalByKey(filteredExpenses, "date"),
    [filteredExpenses]
  );

  const monthTotals = useMemo(
    () => groupMonthTotals(filteredExpenses),
    [filteredExpenses]
  );

  const itemTotals = useMemo(
    () => groupItemTotals(filteredExpenses),
    [filteredExpenses]
  );

  const mostSpentDay = useMemo(
    () => getMostSpentDay(filteredExpenses),
    [filteredExpenses]
  );

  const mostUsedItem = useMemo(
    () => getMostUsedItem(filteredExpenses),
    [filteredExpenses]
  );

  function renderActiveReport() {
    if (activeReport === "type") return <TypeWiseReport data={typeTotals} />;
    if (activeReport === "payment") return <PaymentWiseReport data={paymentTotals} />;
    if (activeReport === "period") return <PeriodWiseReport data={periodTotals} />;
    if (activeReport === "date") return <DateWiseReport data={dateTotals} title="Date-wise Total" />;
    if (activeReport === "month") return <DateWiseReport data={monthTotals} title="Month-wise Total" />;
    if (activeReport === "item") return <ItemWiseReport data={itemTotals} />;
    if (activeReport === "history") return <FullHistoryTable items={filteredExpenses} />;
    if (activeReport === "balance") {
      return <BalanceHistoryTable items={balanceHistory} filters={filters} />;
    }

    if (activeReport === "export") {
      return (
        <ExportButtons
          expenses={filteredExpenses}
          balanceHistory={balanceHistory}
        />
      );
    }

    return <FullHistoryTable items={filteredExpenses} />;
  }

  if (loading) {
    return <Loading message="Loading reports..." />;
  }

  return (
    <section className="reports-page-shell">
      <header className="reports-workspace-header">
        <div className="reports-workspace-header__content">
          <div className="reports-workspace-header__title-row">
            <h2>Reports</h2>
            <span>{reportTitles[activeReport] || "Reports"}</span>
          </div>

          <div className="reports-workspace-meta">
            <span>
              <strong>{filteredExpenses.length}</strong> expense records
            </span>
            <span>
              <strong>{balanceHistory.length}</strong> balance events
            </span>
            {lastUpdated && <span>Updated {lastUpdated}</span>}
          </div>
        </div>

        <div className="reports-workspace-actions">
          <button
            type="button"
            className={
              showAnalytics
                ? "reports-action-btn reports-action-btn--active"
                : "reports-action-btn"
            }
            aria-pressed={showAnalytics}
            onClick={() => setShowAnalytics((current) => !current)}
          >
            {showAnalytics ? "Hide Analytics" : "Show Analytics"}
          </button>

          <button
            type="button"
            className="reports-action-btn reports-header-summary-btn"
            aria-pressed={showMobileCards}
            onClick={() => setShowMobileCards((current) => !current)}
          >
            {showMobileCards ? "Hide Summary" : "Show Summary"}
          </button>

          <button
            type="button"
            className="reports-action-btn reports-filter-trigger"
            onClick={() => setIsMobileFilterOpen(true)}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="reports-filter-count">{activeFilterCount}</span>
            )}
          </button>

          <button
            type="button"
            className="reports-action-btn reports-action-btn--primary"
            onClick={() => loadReports({ background: true })}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-box">
          <p>{error}</p>
        </div>
      )}

      <div className="reports-three-layout">
        <div className="reports-left-panel">
          <ReportSidebar
            activeReport={activeReport}
            onChange={setActiveReport}
            isOpen={isReportMenuOpen}
            onToggle={() => setIsReportMenuOpen((prev) => !prev)}
          />

        </div>

        <div className="reports-center-panel">
          <div
            className={
              showMobileCards
                ? "reports-cards-section"
                : "reports-cards-section reports-cards-section--mobile-hidden"
            }
          >
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
          </div>

          {showAnalytics && <ReportsAnalytics items={analyticsExpenses} />}

          <div className="reports-dynamic-area">{renderActiveReport()}</div>
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
        inert={isMobileFilterOpen ? undefined : ""}
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
