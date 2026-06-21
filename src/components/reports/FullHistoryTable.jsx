import { useEffect, useMemo, useState } from "react";
import EmptyState from "../common/EmptyState";
import TablePagination from "../common/TablePagination";
import { EXPENSE_TYPES, PERIODS } from "../../utils/constants";
import { formatDisplayDate } from "../../utils/dateUtils";
import { formatCurrency, toNumber } from "../../utils/totalUtils";

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

function FullHistoryTable({ items = [] }) {
  const [periodFilter, setPeriodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "index",
    direction: "asc",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedItems.length / rowsPerPage)
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
  const paginatedItems = filteredAndSortedItems.slice(startIndex, endIndex);

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

      {items.length === 0 ? (
        <EmptyState title="No expenses found" message="No data available." />
      ) : filteredAndSortedItems.length === 0 ? (
        <EmptyState
          title="No matching expenses"
          message="Change period or type filter to see more data."
        />
      ) : (
        <>
          <div className="table-wrapper full-history-table-wrapper">
            <table className="full-history-table">
              <thead>
                <tr>
                  {visibleColumns.map((column) => (
                    <th key={column.key}>
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
                      <td key={column.key}>
                        {renderCell(item, column.key, index)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            rowsPerPage={rowsPerPage}
            totalItems={filteredAndSortedItems.length}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={setRowsPerPage}
          />
        </>
      )}
    </div>
  );
}

export default FullHistoryTable;
