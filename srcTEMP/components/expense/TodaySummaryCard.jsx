import { formatCurrency } from "../../utils/totalUtils";

function TodaySummaryCard({
  savedTodayTotal = 0,
  currentTransactionTotal = 0,
  currentTransactionCashTotal = 0,
  currentTransactionGPayTotal = 0,
}) {
  const displayTodayTotal = savedTodayTotal + currentTransactionTotal;

  return (
    <div className="card summary-card">
      <h3>Today Summary</h3>

      <div className="summary-grid">
        <div>
          <p>Saved Today Total</p>
          <strong>{formatCurrency(savedTodayTotal)}</strong>
        </div>

        <div>
          <p>Current Transaction</p>
          <strong>{formatCurrency(currentTransactionTotal)}</strong>
        </div>

        <div>
          <p>Cash in Current Transaction</p>
          <strong>{formatCurrency(currentTransactionCashTotal)}</strong>
        </div>

        <div>
          <p>GPay in Current Transaction</p>
          <strong>{formatCurrency(currentTransactionGPayTotal)}</strong>
        </div>

        <div className="summary-total">
          <p>Today Total</p>
          <strong>{formatCurrency(displayTodayTotal)}</strong>
        </div>
      </div>
    </div>
  );
}

export default TodaySummaryCard;