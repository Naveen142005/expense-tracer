import { formatCurrency } from "../../utils/totalUtils";

function BalanceCard({ balance = 0 }) {
  return (
    <div className="card balance-card">
      <p className="card-label">Current Cash Balance</p>
      <h2>{formatCurrency(balance)}</h2>
      <p className="muted-text">Only cash expenses reduce this balance.</p>
    </div>
  );
}

export default BalanceCard;