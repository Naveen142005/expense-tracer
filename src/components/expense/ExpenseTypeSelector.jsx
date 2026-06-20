import { EXPENSE_TYPES } from "../../utils/constants";

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
          {type.label}
        </button>
      ))}
    </div>
  );
}

export default ExpenseTypeSelector;
