import PeriodTabs from "../expense/PeriodTabs";
import EditableExpenseTable from "./EditableExpenseTable";

function EditExpenseSection({
  activePeriod,
  onPeriodChange,
  items,
  onChangeItem,
  onDeleteItem,
  onAddItem,
}) {
  const filteredItems = items.filter((item) => item.period === activePeriod);

  return (
    <div className="edit-section">
      <div className="card">
        <h3>Select Period</h3>
        <PeriodTabs activePeriod={activePeriod} onChange={onPeriodChange} />
      </div>

      <EditableExpenseTable
        items={filteredItems}
        onChangeItem={onChangeItem}
        onDeleteItem={onDeleteItem}
        onAddItem={onAddItem}
      />
    </div>
  );
}

export default EditExpenseSection;