import EmptyState from "../common/EmptyState";
import { formatDisplayDate } from "../../utils/dateUtils";
import { formatCurrency } from "../../utils/totalUtils";

function FullHistoryTable({ items = [] }) {
  return (
    <div className="card table-card">
      <h3>Full Expense History</h3>

      {items.length === 0 ? (
        <EmptyState title="No expenses found" message="No data available." />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>Period</th>
                <th>Type</th>
                <th>Name / Description</th>
                <th>Payment</th>
                <th>Price</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{formatDisplayDate(item.date)}</td>
                  <td>{item.period}</td>
                  <td>{item.type}</td>
                  <td>{item.name || item.description || "-"}</td>
                  <td>{item.paymentType}</td>
                  <td>{formatCurrency(item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default FullHistoryTable;