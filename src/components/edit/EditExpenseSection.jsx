import PeriodTabs from "../expense/PeriodTabs";
import EditableExpenseTable from "./EditableExpenseTable";

function EditExpenseSection({
  activePeriod,
  onPeriodChange,
  items,
  onChangeItem,
  onDeleteItem,
  onAddItem,
  disabled = false,
}) {
  const isAllPeriods = activePeriod === "all";
  const filteredItems = isAllPeriods
    ? items
    : items.filter((item) => item.period === activePeriod);

  return (
    <div className="edit-section">
      <div className="card edit-period-card">
        <h3>Select Period</h3>
        <PeriodTabs activePeriod={activePeriod} onChange={onPeriodChange} includeAll />
      </div>

      <EditableExpenseTable
        items={filteredItems}
        onChangeItem={onChangeItem}
        onDeleteItem={onDeleteItem}
        onAddItem={onAddItem}
        disabled={disabled}
        addBlocked={isAllPeriods}
        emptyMessage={
          isAllPeriods
            ? "No expenses found for this date."
            : "Click Add New Item to add expense for this period."
        }
      />
    </div>
  );
}

export default EditExpenseSection;
