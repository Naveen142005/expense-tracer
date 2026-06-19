import EmptyState from "../common/EmptyState";
import { formatDisplayDate } from "../../utils/dateUtils";
import { formatCurrency } from "../../utils/totalUtils";

function BalanceHistoryTable({ items = [] }) {
  return (
    <div className="card table-card">
      <h3>Balance History</h3>

      {items.length === 0 ? (
        <EmptyState
          title="No balance history"
          message="Balance add/reduce history will appear here."
        />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>Action</th>
                <th>Amount</th>
                <th>Old Balance</th>
                <th>New Balance</th>
                <th>Reason</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{formatDisplayDate(item.date)}</td>
                  <td>{item.action}</td>
                  <td>{formatCurrency(item.amount)}</td>
                  <td>{formatCurrency(item.oldBalance)}</td>
                  <td>{formatCurrency(item.newBalance)}</td>
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