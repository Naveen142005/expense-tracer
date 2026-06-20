import EmptyState from "../common/EmptyState";
import { formatCurrency } from "../../utils/totalUtils";

function PaymentWiseReport({ data = {} }) {
  const rows = Object.entries(data);

  return (
    <div className="card report-table-card">
      <h3>Payment-wise Total</h3>

      {rows.length === 0 ? (
        <EmptyState title="No payment report" message="No data available." />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Payment Type</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(([paymentType, total]) => (
                <tr key={paymentType}>
                  <td>{paymentType}</td>
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

export default PaymentWiseReport;