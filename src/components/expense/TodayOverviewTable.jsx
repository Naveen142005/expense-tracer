import EmptyState from "../common/EmptyState";
import { formatCurrency } from "../../utils/totalUtils";

function TodayOverviewTable({ items = [] }) {
  return (
    <div className="card table-card">
      <h3>Today Overview</h3>

      {items.length === 0 ? (
        <EmptyState
          title="No expenses today"
          message="Saved and current draft expenses will appear here."
        />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Period</th>
                <th>Type</th>
                <th>Name / Description</th>
                <th>Payment</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{item.period}</td>
                  <td>{item.type}</td>
                  <td>{item.name || item.description || "-"}</td>
                  <td>{item.paymentType}</td>
                  <td>{formatCurrency(item.price)}</td>
                  <td>{item.isDraft ? "Draft" : "Saved"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TodayOverviewTable;