import { formatCurrency } from "../../utils/totalUtils";

function EditSummaryCard({ total = 0, cashTotal = 0, gpayTotal = 0, count = 0 }) {
  return (
    <div className="card edit-summary-card">
      <h3>Selected Date Summary</h3>

      <div className="summary-grid">
        <div>
          <p>Total Items</p>
          <strong>{count}</strong>
        </div>

        <div>
          <p>Total Spend</p>
          <strong>{formatCurrency(total)}</strong>
        </div>

        <div>
          <p>Cash Spend</p>
          <strong>{formatCurrency(cashTotal)}</strong>
        </div>

        <div>
          <p>GPay Spend</p>
          <strong>{formatCurrency(gpayTotal)}</strong>
        </div>
      </div>

      <p className="warning-text" style={{opacity: 0}}>
        {/* Note: Editing data here will not change Current Balance. Please adjust
        balance manually if needed. */}
      </p>
    </div>
  );
}

export default EditSummaryCard;