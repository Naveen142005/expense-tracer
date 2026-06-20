import EmptyState from "../common/EmptyState";
import { formatDisplayDate } from "../../utils/dateUtils";
import { formatCurrency } from "../../utils/totalUtils";

function formatBalanceType(balanceType) {
  return balanceType === "gpay" ? "GPay" : "Cash";
}

function formatAction(action = "") {
  if (action === "add") return "Added";
  if (action === "reduce") return "Reduced";
  if (action.startsWith("edit_") && action.endsWith("_deduction")) {
    return "Edit deduction";
  }
  if (action.startsWith("edit_") && action.endsWith("_refund")) {
    return "Edit refund";
  }
  if (action.includes("expense")) return "Expense deduction";

  return action || "-";
}

function BalanceHistoryTable({ items = [] }) {
  return (
    <div className="card table-card">
      <h3>Balance History</h3>

      {items.length === 0 ? (
        <EmptyState
          title="No balance history"
          message="Cash and GPay balance history will appear here."
        />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>Balance</th>
                <th>Action</th>
                <th>Requested</th>
                <th>Applied</th>
                <th>Shortfall Change</th>
                <th>Old Balance</th>
                <th>New Balance</th>
                <th>Total After</th>
                <th>Reason</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{formatDisplayDate(item.date)}</td>
                  <td>{formatBalanceType(item.balanceType)}</td>
                  <td>{formatAction(item.action)}</td>
                  <td>{formatCurrency(item.amount)}</td>
                  <td>
                    {formatCurrency(item.appliedAmount ?? item.amount)}
                  </td>
                  <td>
                    {item.shortfall > 0
                      ? `+${formatCurrency(item.shortfall)}`
                      : item.shortfallResolved > 0
                      ? `-${formatCurrency(item.shortfallResolved)}`
                      : "-"}
                  </td>
                  <td>{formatCurrency(item.oldBalance)}</td>
                  <td>{formatCurrency(item.newBalance)}</td>
                  <td>
                    {item.newTotalBalance === undefined
                      ? "-"
                      : formatCurrency(item.newTotalBalance)}
                  </td>
                  <td>{item.reason || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default BalanceHistoryTable;
