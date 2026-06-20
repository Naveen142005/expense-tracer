import {
  EXPENSE_TYPES,
  FOOD_SUGGESTIONS,
  PAYMENT_TYPES,
  PERIODS,
  SNACK_SUGGESTIONS,
} from "../../utils/constants";
import Button from "../common/Button";
import EmptyState from "../common/EmptyState";

function EditableExpenseTable({
  items = [],
  onChangeItem,
  onDeleteItem,
  onAddItem,
}) {
  return (
    <div className="card table-card">
      <div className="card-header">
        <h3>Editable Expenses</h3>

        <Button size="sm" onClick={onAddItem}>
          Add New Item
        </Button>
      </div>

      <datalist id="edit-food-suggestions">
        {FOOD_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <datalist id="edit-snack-suggestions">
        {SNACK_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      {items.length === 0 ? (
        <EmptyState
          title="No items in this period"
          message="Click Add New Item to add expense for this period."
        />
      ) : (
        <div className="table-wrapper">
          <table className="editable-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Type</th>
                <th>Name / Description</th>
                <th>Payment</th>
                <th>Price</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => {
                const textValue =
                  item.type === "bus" ? item.description || "" : item.name || "";

                const textField = item.type === "bus" ? "description" : "name";

                const suggestionList =
                  item.type === "food"
                    ? "edit-food-suggestions"
                    : item.type === "snacks"
                    ? "edit-snack-suggestions"
                    : undefined;

                return (
                  <tr key={item.id}>
                    <td>
                      <select
                        value={item.period}
                        onChange={(event) =>
                          onChangeItem(item.id, "period", event.target.value)
                        }
                      >
                        {PERIODS.map((period) => (
                          <option key={period.value} value={period.value}>
                            {period.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <select
                        value={item.type}
                        onChange={(event) =>
                          onChangeItem(item.id, "type", event.target.value)
                        }
                      >
                        {EXPENSE_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <input
                        type="text"
                        value={textValue}
                        list={suggestionList}
                        placeholder={
                          item.type === "bus"
                            ? "Optional description"
                            : "Required"
                        }
                        onChange={(event) =>
                          onChangeItem(item.id, textField, event.target.value)
                        }
                      />
                    </td>

                    <td>
                      <select
                        value={item.paymentType}
                        onChange={(event) =>
                          onChangeItem(
                            item.id,
                            "paymentType",
                            event.target.value
                          )
                        }
                      >
                        {PAYMENT_TYPES.map((payment) => (
                          <option key={payment.value} value={payment.value}>
                            {payment.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.price}
                        onChange={(event) =>
                          onChangeItem(item.id, "price", event.target.value)
                        }
                      />
                    </td>

                    <td>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onDeleteItem(item.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default EditableExpenseTable;