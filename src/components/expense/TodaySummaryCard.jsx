import { formatCurrency } from "../../utils/totalUtils";

function TodaySummaryCard({
  savedTodayTotal = 0,
  savedTodayCashTotal = 0,
  savedTodayGPayTotal = 0,
}) {
  return (
    <div className="card summary-card">
      <h3>Today Summary</h3>

      <div className="summary-grid">
        <div>
          <p>Submitted Items</p>
          <strong>{formatCurrency(savedTodayTotal)}</strong>
        </div>

        <div>
          <p>Submitted via Cash</p>
          <strong>{formatCurrency(savedTodayCashTotal)}</strong>
        </div>

        <div>
          <p>Submitted via GPay</p>
          <strong>{formatCurrency(savedTodayGPayTotal)}</strong>
        </div>

        <div className="summary-total">
          <p>Today Total</p>
          <strong>{formatCurrency(savedTodayTotal)}</strong>
        </div>
      </div>
    </div>
  );
}

export default TodaySummaryCard;
