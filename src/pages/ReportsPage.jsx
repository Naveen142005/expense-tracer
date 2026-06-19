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
import ReportSummaryCards from "../components/reports/ReportSummaryCards";
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
  search: "",
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReports() {
    try {
      setLoading(true);
      setError("");

      const [expenseData, balanceHistoryData] = await Promise.all([
        getAllExpenses(),
        getAllBalanceHistory(),
      ]);

      setExpenses(expenseData);
      setBalanceHistory(balanceHistoryData);
    } catch (err) {
      console.error(err);
      setError("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

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
    const searchText = filters.search.trim().toLowerCase();

    return expenses.filter((item) => {
      const itemText = `${item.name || ""} ${item.description || ""}`
        .toLowerCase()
        .trim();

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

      const searchMatch = !searchText || itemText.includes(searchText);

      return dateMatch && typeMatch && paymentMatch && periodMatch && searchMatch;
    });
  }, [expenses, filters]);

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

  if (loading) {
    return <Loading message="Loading reports..." />;
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <h2 className="page-title">Reports</h2>
          <p className="page-subtitle">
            Simple text and table-based analysis of your expenses.
          </p>
        </div>
      </div>

      {error && (
        <div className="error-box">
          <p>{error}</p>
        </div>
      )}

      <div className="reports-actions">
        <button type="button" className="theme-toggle" onClick={loadReports}>
          Refresh Reports
        </button>
      </div>

      <ReportFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      <ExportButtons
        expenses={filteredExpenses}
        balanceHistory={balanceHistory}
      />

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

      <div className="report-grid">
        <TypeWiseReport data={typeTotals} />
        <PaymentWiseReport data={paymentTotals} />
        <PeriodWiseReport data={periodTotals} />
        <DateWiseReport data={dateTotals} title="Date-wise Total" />
        <DateWiseReport data={monthTotals} title="Month-wise Total" />
        <ItemWiseReport data={itemTotals} />
      </div>

      <FullHistoryTable items={filteredExpenses} />

      <BalanceHistoryTable items={balanceHistory} />
    </section>
  );
}

export default ReportsPage;