import EmptyState from "../common/EmptyState";
import { formatCurrency } from "../../utils/totalUtils";

function TypeWiseReport({ data = {} }) {
  const rows = Object.entries(data);

  return (
    <div className="card report-table-card">
      <h3>Type-wise Total</h3>

      {rows.length === 0 ? (
        <EmptyState title="No type report" message="No data available." />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(([type, total]) => (
                <tr key={type}>
                  <td>{type}</td>
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

export default TypeWiseReport;