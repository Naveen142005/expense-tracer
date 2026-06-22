import { useEffect, useMemo, useState } from "react";
import { DetailModal } from "../common/ConfirmModal";
import EmptyState from "../common/EmptyState";
import TablePagination from "../common/TablePagination";
import { EXPENSE_TYPES, PERIODS } from "../../utils/constants";
import { formatDisplayDate } from "../../utils/dateUtils";
import { calculateTotal, formatCurrency, toNumber } from "../../utils/totalUtils";
import {
  getAllExpensesForReport,
  getExpenseHistoryMetrics,
  getExpenseHistoryPage,
} from "../../firebase/reportQueryService";

function getItemName(item) {
  return item.name || item.description || "-";
}

function getPeriodSortOrder(value) {
  const index = PERIODS.findIndex((period) => period.value === value);
  return index === -1 ? PERIODS.length : index;
}

function SortIcon({ active, direction }) {
  if (!active) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M8 7L12 3L16 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 3V21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M8 17L12 21L16 17"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      {direction === "asc" ? (
        <>
          <path
            d="M7 10L12 5L17 10"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 5V19"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M7 14L12 19L17 14"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 5V19"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

function FullHistoryTable({
  filters = {},
  refreshKey = 0,
  onOpenFilters,
  activeFilterCount = 0,
}) {
  const [periodFilter, setPeriodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: "index",
    direction: "asc",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [serverItems, setServerItems] = useState([]);
  const [fallbackItems, setFallbackItems] = useState([]);
  const [serverTotalItems, setServerTotalItems] = useState(0);
  const [serverFilteredTotal, setServerFilteredTotal] = useState(0);
  const [firstDocument, setFirstDocument] = useState(null);
  const [lastDocument, setLastDocument] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  const usesServerPagination =
    !searchQuery.trim() &&
    sortConfig.key === "index" &&
    sortConfig.direction === "asc";

  const queryState = useMemo(() => {
    const globalType = filters.type || "all";
    const globalPeriod = filters.period || "all";
    const typeConflict =
      globalType !== "all" &&
      typeFilter !== "all" &&
      globalType !== typeFilter;
    const periodConflict =
      globalPeriod !== "all" &&
      periodFilter !== "all" &&
      globalPeriod !== periodFilter;

    return {
      impossible: typeConflict || periodConflict,
      filters: {
        startDate: filters.startDate || "",
        endDate: filters.endDate || "",
        paymentType: filters.paymentType || "all",
        type: typeFilter !== "all" ? typeFilter : globalType,
        period: periodFilter !== "all" ? periodFilter : globalPeriod,
      },
    };
  }, [filters, periodFilter, typeFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setCurrentPage(1);
      setDataError("");

      if (queryState.impossible) {
        setServerItems([]);
        setFallbackItems([]);
        setServerTotalItems(0);
        setServerFilteredTotal(0);
        setFirstDocument(null);
        setLastDocument(null);
        setDataLoading(false);
        return;
      }

      try {
        setDataLoading(true);

        if (usesServerPagination) {
          const [metrics, page] = await Promise.all([
            getExpenseHistoryMetrics(queryState.filters),
            getExpenseHistoryPage({
              filters: queryState.filters,
              pageSize: rowsPerPage,
            }),
          ]);

          if (cancelled) return;
          setServerItems(page.items);
          setServerTotalItems(metrics.totalItems);
          setServerFilteredTotal(metrics.filteredTotal);
          setFirstDocument(page.firstDocument);
          setLastDocument(page.lastDocument);
          setFallbackItems([]);
        } else {
          const allItems = await getAllExpensesForReport(queryState.filters);
          if (cancelled) return;
          setFallbackItems(allItems);
          setServerItems([]);
          setServerTotalItems(allItems.length);
          setFirstDocument(null);
          setLastDocument(null);
        }
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setDataError("Unable to load expense history.");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [queryState, rowsPerPage, usesServerPagination, refreshKey]);

  const items = usesServerPagination ? serverItems : fallbackItems;

  const visibleColumns = useMemo(() => {
    const columns = [
      { label: "S.No", key: "index" },
      { label: "Date", key: "date" },
    ];

    if (periodFilter === "all") {
      columns.push({ label: "Period", key: "period" });
    }

    if (typeFilter === "all") {
      columns.push({ label: "Type", key: "type" });
    }

    columns.push(
      { label: "Name / Description", key: "nameText" },
      { label: "Payment", key: "paymentType" },
      { label: "Price", key: "price" }
    );

    return columns;
  }, [periodFilter, typeFilter]);

  useEffect(() => {
    const sortKeyStillVisible = visibleColumns.some(
      (column) => column.key === sortConfig.key
    );

    if (!sortKeyStillVisible) {
      setSortConfig({
        key: "index",
        direction: "asc",
      });
    }
  }, [visibleColumns, sortConfig.key]);

  const filteredAndSortedItems = useMemo(() => {
    const filteredItems = items
      .map((item, index) => ({
        ...item,
        originalIndex: index,
        nameText: getItemName(item),
      }))
      .filter((item) => {
        const periodMatch =
          periodFilter === "all" || item.period === periodFilter;

        const typeMatch = typeFilter === "all" || item.type === typeFilter;
        const normalizedSearch = searchQuery.trim().toLowerCase();
        const searchText = `${item.date || ""} ${item.period || ""} ${
          item.type || ""
        } ${item.nameText} ${item.paymentType || ""} ${item.price || ""}`
          .toLowerCase()
          .trim();
        const searchMatch =
          !normalizedSearch || searchText.includes(normalizedSearch);

        return periodMatch && typeMatch && searchMatch;
      });

    return [...filteredItems].sort((a, b) => {
      const { key, direction } = sortConfig;
      const directionValue = direction === "asc" ? 1 : -1;

      if (key === "index") {
        return (a.originalIndex - b.originalIndex) * directionValue;
      }

      if (key === "price") {
        return (toNumber(a.price) - toNumber(b.price)) * directionValue;
      }

      if (key === "period") {
        return (
          (getPeriodSortOrder(a.period) - getPeriodSortOrder(b.period)) *
          directionValue
        );
      }

      if (key === "date") {
        return (
          String(a.date || "").localeCompare(String(b.date || "")) *
          directionValue
        );
      }

      const aValue = String(a[key] || "").toLowerCase();
      const bValue = String(b[key] || "").toLowerCase();

      return aValue.localeCompare(bValue) * directionValue;
    });
  }, [items, periodFilter, typeFilter, searchQuery, sortConfig]);

  const filteredTotal = useMemo(
    () =>
      usesServerPagination
        ? serverFilteredTotal
        : calculateTotal(filteredAndSortedItems),
    [filteredAndSortedItems, serverFilteredTotal, usesServerPagination]
  );

  const totalItems = usesServerPagination
    ? serverTotalItems
    : filteredAndSortedItems.length;

  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / rowsPerPage)
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    periodFilter,
    typeFilter,
    searchQuery,
    rowsPerPage,
    sortConfig.key,
    sortConfig.direction,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedItems = usesServerPagination
    ? filteredAndSortedItems
    : filteredAndSortedItems.slice(startIndex, endIndex);

  async function handlePageChange(targetPage) {
    if (!usesServerPagination) {
      setCurrentPage(targetPage);
      return;
    }

    if (targetPage === currentPage || targetPage < 1 || targetPage > totalPages) {
      return;
    }

    const direction =
      targetPage === 1
        ? "first"
        : targetPage === totalPages
        ? "last"
        : targetPage > currentPage
        ? "next"
        : "previous";
    const lastPageSize = serverTotalItems % rowsPerPage || rowsPerPage;

    try {
      setDataLoading(true);
      setDataError("");
      const page = await getExpenseHistoryPage({
        filters: queryState.filters,
        pageSize: direction === "last" ? lastPageSize : rowsPerPage,
        direction,
        firstDocument,
        lastDocument,
      });

      setServerItems(page.items);
      setFirstDocument(page.firstDocument);
      setLastDocument(page.lastDocument);
      setCurrentPage(targetPage);
    } catch (error) {
      console.error(error);
      setDataError("Unable to load this expense page.");
    } finally {
      setDataLoading(false);
    }
  }

  function handleSort(key) {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: "asc",
      };
    });
  }

  function renderCell(item, columnKey, index) {
    if (columnKey === "index") return startIndex + index + 1;
    if (columnKey === "date") return formatDisplayDate(item.date);
    if (columnKey === "period") return item.period;
    if (columnKey === "type") return item.type;
    if (columnKey === "nameText") return item.nameText;
    if (columnKey === "paymentType") return item.paymentType;
    if (columnKey === "price") return formatCurrency(item.price);

    return "-";
  }

  return (
    <div className="card table-card full-history-card">
      <div className="today-overview-header">
        <h3>Full Expense History</h3>

        <div className="today-overview-filters">
          <select
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value)}
          >
            <option value="all">All Periods</option>
            {PERIODS.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">All Types</option>
            {EXPENSE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          {onOpenFilters && (
            <button
              type="button"
              className="history-filter-btn"
              onClick={onOpenFilters}
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="reports-filter-count">{activeFilterCount}</span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="history-search-field">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search expenses..."
          aria-label="Search full expense history"
        />
      </div>

      {dataError && <div className="error-box">{dataError}</div>}

      {dataLoading && items.length === 0 ? (
        <div className="table-loading-state">Loading expense history...</div>
      ) : totalItems === 0 ? (
        <EmptyState title="No expenses found" message="No data available." />
      ) : filteredAndSortedItems.length === 0 ? (
        <EmptyState
          title="No matching expenses"
          message="Change period or type filter to see more data."
        />
      ) : (
        <>
          <div className="table-wrapper full-history-table-wrapper responsive-table--desktop">
            <table className="full-history-table">
              <thead>
                <tr>
                  {visibleColumns.map((column) => (
                    <th
                      key={column.key}
                      className={
                        column.key === "nameText"
                          ? "table-cell--description"
                          : ""
                      }
                    >
                      <button
                        type="button"
                        className="table-sort-btn"
                        onClick={() => handleSort(column.key)}
                      >
                        <span>{column.label}</span>
                        <SortIcon
                          active={sortConfig.key === column.key}
                          direction={sortConfig.direction}
                        />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {paginatedItems.map((item, index) => (
                  <tr key={item.id}>
                    {visibleColumns.map((column) => (
                      <td
                        key={column.key}
                        className={
                          column.key === "nameText"
                            ? "table-cell--description"
                            : ""
                        }
                      >
                        {renderCell(item, column.key, index)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="responsive-table--mobile">
            <table className="compact-mobile-table">
              <thead>
                <tr>
                  {[
                    { label: "Date", key: "date", className: "date" },
                    { label: "Item", key: "nameText", className: "item" },
                    {
                      label: "Payment",
                      key: "paymentType",
                      className: "payment",
                    },
                    { label: "Price", key: "price", className: "amount" },
                  ].map((column) => (
                    <th
                      key={column.key}
                      className={`compact-mobile-table__${column.className}`}
                    >
                      <button
                        type="button"
                        className="table-sort-btn"
                        onClick={() => handleSort(column.key)}
                      >
                        <span>{column.label}</span>
                        <SortIcon
                          active={sortConfig.key === column.key}
                          direction={sortConfig.direction}
                        />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
                  <tr
                    key={item.id}
                    role="button"
                    tabIndex="0"
                    onClick={() => setSelectedItem(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedItem(item);
                      }
                    }}
                    aria-label={`View details for ${item.nameText}`}
                  >
                    <td className="compact-mobile-table__date">
                      {formatDisplayDate(item.date)}
                    </td>
                    <td className="compact-mobile-table__item">{item.nameText}</td>
                    <td className="compact-mobile-table__payment">
                      {item.paymentType || "-"}
                    </td>
                    <td className="compact-mobile-table__amount">
                      {formatCurrency(item.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="history-table-total">
            <span>Filtered Total</span>
            <strong>{formatCurrency(filteredTotal)}</strong>
          </div>

          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            rowsPerPage={rowsPerPage}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={handlePageChange}
            onRowsPerPageChange={setRowsPerPage}
          />
        </>
      )}

      <DetailModal
        isOpen={Boolean(selectedItem)}
        title="Expense Details"
        fields={
          selectedItem
            ? [
                { label: "Date", value: formatDisplayDate(selectedItem.date) },
                { label: "Period", value: selectedItem.period || "-" },
                { label: "Type", value: selectedItem.type || "-" },
                { label: "Name / Description", value: selectedItem.nameText },
                { label: "Payment", value: selectedItem.paymentType || "-" },
                { label: "Price", value: formatCurrency(selectedItem.price) },
              ]
            : []
        }
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

export default FullHistoryTable;
