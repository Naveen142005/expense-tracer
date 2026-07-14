import { useMemo, useState } from "react";
import { DetailModal } from "../common/ConfirmModal";
import EmptyState from "../common/EmptyState";
import { EXPENSE_TYPES, PERIODS } from "../../utils/constants";
import { formatCurrency, toNumber } from "../../utils/totalUtils";

function getItemName(item) {
  return item.name || item.description || "-";
}

function getPeriodSortOrder(value) {
  const index = PERIODS.findIndex((period) => period.value === value);
  return index === -1 ? PERIODS.length : index;
}

function TodayOverviewTable({ items = [] }) {
  const [periodFilter, setPeriodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: "index",
    direction: "asc",
  });

  const visibleColumns = useMemo(() => {
    const columns = [{ label: "S.No", key: "index" }];

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

      if (key === "period") {
        return (
          (getPeriodSortOrder(a.period) - getPeriodSortOrder(b.period)) *
          directionValue
        );
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
    if (columnKey === "period") return item.period;
    if (columnKey === "type") return item.type;
    if (columnKey === "nameText") return item.nameText;
    if (columnKey === "paymentType") return item.paymentType;
    if (columnKey === "price") return formatCurrency(item.price);

    return "-";
  }

  return (
    <div className="card table-card today-overview-card">
      <div className="today-overview-header">
        <h3>Today Overview</h3>

        <div className="today-overview-filters">
          <select
            value={periodFilter}
            onChange={(event) => {
              const value = event.target.value;
              setPeriodFilter(value);
              if (value !== "all" && sortConfig.key === "period") {
                setSortConfig({ key: "index", direction: "asc" });
              }
            }}
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
            onChange={(event) => {
              const value = event.target.value;
              setTypeFilter(value);
              if (value !== "all" && sortConfig.key === "type") {
                setSortConfig({ key: "index", direction: "asc" });
              }
            }}
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
        <EmptyState
          title="No expenses today"
          message="Submitted expenses will appear here."
        />
      ) : filteredAndSortedItems.length === 0 ? (
        <EmptyState
          title="No matching expenses"
          message="Change period or type filter to see more data."
        />
      ) : (
        <>
          <div className="table-wrapper responsive-table--desktop">
            <table>
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
                    { label: "Period", key: "period", className: "date" },
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
                        {column.label}
                        <span>{getSortIcon(column.key)}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedItems.map((item) => (
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
                      {item.period || "-"}
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
        </>
      )}

      <DetailModal
        isOpen={Boolean(selectedItem)}
        title="Expense Details"
        fields={
          selectedItem
            ? [
                {
                  label: "Status",
                  value: "Submitted",
                },
                { label: "Period", value: selectedItem.period || "-" },
                { label: "Type", value: selectedItem.type || "-" },
                ...(selectedItem.type === "custom"
                  ? [
                      {
                        label: "Custom Category",
                        value: selectedItem.customCategory || "-",
                      },
                    ]
                  : []),
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

export default TodayOverviewTable;
