import { useEffect, useMemo, useState } from "react";
import EmptyState from "../common/EmptyState";
import { EXPENSE_TYPES, PERIODS } from "../../utils/constants";
import { formatDisplayDate } from "../../utils/dateUtils";
import { formatCurrency, toNumber } from "../../utils/totalUtils";

function getItemName(item) {
  return item.name || item.description || "-";
}

function FullHistoryTable({ items = [] }) {
  const [periodFilter, setPeriodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({
    key: "index",
    direction: "asc",
  });

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

        return periodMatch && typeMatch;
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

      if (key === "date") {
        return String(a.date || "").localeCompare(String(b.date || "")) * directionValue;
      }

      const aValue = String(a[key] || "").toLowerCase();
      const bValue = String(b[key] || "").toLowerCase();

      return aValue.localeCompare(bValue) * directionValue;
    });
  }, [items, periodFilter, typeFilter, sortConfig]);

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

  function getSortIcon(key) {
    if (sortConfig.key !== key) {
      return "↕";
    }

    return sortConfig.direction === "asc" ? "↑" : "↓";
  }

  function renderCell(item, columnKey, index) {
    if (columnKey === "index") return index + 1;
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

      {items.length === 0 ? (
        <EmptyState title="No expenses found" message="No data available." />
      ) : filteredAndSortedItems.length === 0 ? (
        <EmptyState
          title="No matching expenses"
          message="Change period or type filter to see more data."
        />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {visibleColumns.map((column) => (
                  <th key={column.key}>
                    <button
                      type="button"
                      className="table-sort-btn"
                      onClick={() => handleSort(column.key)}
                    >
                      {column.label}
                      <span>{getSortIcon(column.key)}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredAndSortedItems.map((item, index) => (
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
      )}
    </div>
  );
}

export default FullHistoryTable;