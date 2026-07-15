import { EXPENSE_TYPES } from "../../utils/constants";
import AppIcon from "../common/AppIcon";

const typeIcons = {
  food: "food",
  snacks: "snack",
  bus: "bus",
  custom: "sliders",
};

function ExpenseTypeSelector({ selectedType, onChange, disabled = false }) {
  return (
    <div className="type-selector">
      {EXPENSE_TYPES.map((type) => (
        <button
          key={type.value}
          type="button"
          className={
            selectedType === type.value
              ? "type-btn type-btn--active"
              : "type-btn"
          }
          onClick={() => onChange(type.value)}
          disabled={disabled}
        >
          <AppIcon name={typeIcons[type.value] || "sliders"} size={17} />
          <span>{type.label}</span>
        </button>
      ))}
    </div>
  );
}

export default ExpenseTypeSelector;
