import EmptyState from "../common/EmptyState";
import { formatCurrency } from "../../utils/totalUtils";

function ItemWiseReport({ data = {} }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);

  return (
    <div className="card report-table-card">
      <h3>Item-wise Total</h3>

      {rows.length === 0 ? (
        <EmptyState title="No item report" message="No data available." />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Item / Description</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(([itemName, total]) => (
                <tr key={itemName}>
                  <td>{itemName}</td>
                  <td>{formatCurrency(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ItemWiseReport;