import { useEffect, useMemo, useState } from "react";
import EmptyState from "../common/EmptyState";
import TablePagination from "../common/TablePagination";
import { formatDisplayDate, isDateInRange } from "../../utils/dateUtils";
import { formatCurrency, toNumber } from "../../utils/totalUtils";

const BALANCE_HISTORY_COLUMNS = [
  { label: "S.No", key: "index" },
  { label: "Date", key: "date" },
  { label: "Balance", key: "balanceType" },
  { label: "Action", key: "action" },
  { label: "Requested", key: "amount" },
  { label: "Applied", key: "appliedAmount" },
  { label: "Shortfall Change", key: "shortfallChange" },
  { label: "Old Balance", key: "oldBalance" },
  { label: "New Balance", key: "newBalance" },
  { label: "Total After", key: "newTotalBalance" },
  { label: "Reason", key: "reason" },
];

const NUMERIC_SORT_KEYS = new Set([
  "amount",
  "appliedAmount",
  "shortfallChange",
  "oldBalance",
  "newBalance",
  "newTotalBalance",
]);

function formatBalanceType(balanceType) {
  return balanceType === "gpay" ? "GPay" : "Cash";
}

function formatAction(action = "") {
  if (action === "add") return "Added";
  if (action === "reduce") return "Reduced";
  if (action.startsWith("edit_") && action.endsWith("_deduction")) {
    return "Edit deduction";
  }
  if (action.startsWith("edit_") && action.endsWith("_refund")) {
    return "Edit refund";
  }
  if (action.includes("expense")) return "Expense deduction";

  return action || "-";
}

function getShortfallChange(item) {
  if (toNumber(item.shortfall) > 0) return toNumber(item.shortfall);
  if (toNumber(item.shortfallResolved) > 0) {
    return -toNumber(item.shortfallResolved);
  }
  return 0;
}

function SortIcon({ active, direction }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {active ? (
        <path
          d={direction === "asc" ? "M7 14L12 9L17 14" : "M7 10L12 15L17 10"}
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <path
            d="M8 9L12 5L16 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 15L12 19L16 15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

function BalanceHistoryTable({ items = [], filters = {} }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "index",
    direction: "asc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filteredAndSortedItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const selectedBalance = filters.paymentType || "all";

    const filteredItems = items
      .map((item, index) => ({ ...item, originalIndex: index }))
      .filter((item) => {
        const balanceType = item.balanceType === "gpay" ? "gpay" : "cash";
        const dateMatch = isDateInRange(
          item.date,
          filters.startDate || "",
          filters.endDate || ""
        );
        const balanceMatch =
          selectedBalance === "all" || balanceType === selectedBalance;
        const searchText = `${item.date || ""} ${formatDisplayDate(
          item.date
        )} ${formatBalanceType(item.balanceType)} ${formatAction(
          item.action
        )} ${item.action || ""} ${item.amount ?? ""} ${
          item.appliedAmount ?? ""
        } ${item.oldBalance ?? ""} ${item.newBalance ?? ""} ${
          item.newTotalBalance ?? ""
        } ${item.reason || ""}`.toLowerCase();
        const searchMatch =
          !normalizedSearch || searchText.includes(normalizedSearch);

        return dateMatch && balanceMatch && searchMatch;
      });

    return [...filteredItems].sort((a, b) => {
      const directionValue = sortConfig.direction === "asc" ? 1 : -1;
      const key = sortConfig.key;
      let comparison = 0;

      if (key === "index") {
        comparison = a.originalIndex - b.originalIndex;
      } else if (key === "balanceType") {
        comparison = formatBalanceType(a.balanceType).localeCompare(
          formatBalanceType(b.balanceType)
        );
      } else if (key === "action") {
        comparison = formatAction(a.action).localeCompare(formatAction(b.action));
      } else if (key === "shortfallChange") {
        comparison = getShortfallChange(a) - getShortfallChange(b);
      } else if (NUMERIC_SORT_KEYS.has(key)) {
        comparison = toNumber(a[key]) - toNumber(b[key]);
      } else {
        comparison = String(a[key] || "").localeCompare(String(b[key] || ""));
      }

      if (comparison === 0) {
        return a.originalIndex - b.originalIndex;
      }

      return comparison * directionValue;
    });
  }, [
    items,
    filters.startDate,
    filters.endDate,
    filters.paymentType,
    searchQuery,
    sortConfig,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedItems.length / rowsPerPage)
  );
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedItems = filteredAndSortedItems.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    filters.startDate,
    filters.endDate,
    filters.paymentType,
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

  function handleSort(key) {
    setSortConfig((previous) => ({
      key,
      direction:
        previous.key === key && previous.direction === "asc" ? "desc" : "asc",
    }));
  }

  function renderCell(item, columnKey, index) {
    if (columnKey === "index") return startIndex + index + 1;
    if (columnKey === "date") return formatDisplayDate(item.date);
    if (columnKey === "balanceType") return formatBalanceType(item.balanceType);
    if (columnKey === "action") return formatAction(item.action);
    if (columnKey === "amount") return formatCurrency(item.amount);
    if (columnKey === "appliedAmount") {
      return formatCurrency(item.appliedAmount ?? item.amount);
    }
    if (columnKey === "shortfallChange") {
      const change = getShortfallChange(item);
      if (change > 0) return `+${formatCurrency(change)}`;
      if (change < 0) return `-${formatCurrency(Math.abs(change))}`;
      return "-";
    }
    if (columnKey === "oldBalance") return formatCurrency(item.oldBalance);
    if (columnKey === "newBalance") return formatCurrency(item.newBalance);
    if (columnKey === "newTotalBalance") {
      return item.newTotalBalance === undefined
        ? "-"
        : formatCurrency(item.newTotalBalance);
    }
    if (columnKey === "reason") return item.reason || "-";

    return "-";
  }

  return (
    <div className="card table-card balance-history-card">
      <h3>Balance History</h3>

      <div className="history-search-field">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search balance history..."
          aria-label="Search balance history"
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No balance history"
          message="Cash and GPay balance history will appear here."
        />
      ) : filteredAndSortedItems.length === 0 ? (
        <EmptyState
          title="No matching balance history"
          message="Change the date, balance, or search filter to see more data."
        />
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {BALANCE_HISTORY_COLUMNS.map((column) => (
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
                    {BALANCE_HISTORY_COLUMNS.map((column) => (
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

export default BalanceHistoryTable;
