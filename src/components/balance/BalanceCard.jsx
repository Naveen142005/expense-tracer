import { formatCurrency } from "../../utils/totalUtils";

function BalanceCard({ balance = {} }) {
  const totalBalance = balance.totalBalance || 0;
  const cashBalance = balance.cashBalance || 0;
  const gpayBalance = balance.gpayBalance || 0;

  return (
    <div className="wallet-balance-grid">
      <div className="card balance-card balance-card--total">
        <p className="card-label">Total Balance</p>
        <h2>{formatCurrency(totalBalance)}</h2>
        <p className="muted-text">Cash Balance + GPay Balance</p>
      </div>

      <div className="card balance-card balance-card--cash">
        <p className="card-label">Cash Balance</p>
        <h2>{formatCurrency(cashBalance)}</h2>
        <p className="muted-text">Cash expenses reduce this balance.</p>
      </div>

      <div className="card balance-card balance-card--gpay">
        <p className="card-label">GPay Balance</p>
        <h2>{formatCurrency(gpayBalance)}</h2>
        <p className="muted-text">GPay expenses reduce this balance.</p>
      </div>
    </div>
  );
}

export default BalanceCard;
