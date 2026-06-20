import Button from "../common/Button";
import EmptyState from "../common/EmptyState";
import { formatCurrency } from "../../utils/totalUtils";

function ExpenseDraftList({
  draftItems = [],
  onDeleteItem,
  onClearAll,
  disabled = false,
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Current Draft Items</h3>

        {draftItems.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onClearAll}
            disabled={disabled}
          >
            Clear All
          </Button>
        )}
      </div>

      {draftItems.length === 0 ? (
        <EmptyState
          title="No draft items"
          message="Add expenses before submitting."
        />
      ) : (
        <div className="draft-list">
          {draftItems.map((item) => (
            <div key={item.id} className="draft-item">
              <div>
                <strong>{item.name || item.description || "-"}</strong>
                <p>
                  {item.period} • {item.type} • {item.paymentType}
                </p>
              </div>

              <div className="draft-item__right">
                <strong>{formatCurrency(item.price)}</strong>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onDeleteItem(item.id)}
                  disabled={disabled}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExpenseDraftList;
