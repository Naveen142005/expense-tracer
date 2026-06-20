import { useState } from "react";
import { BALANCE_TYPES } from "../../utils/constants";
import { useFeedback } from "../../context/FeedbackContext";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";

const initialForm = {
  balanceType: "",
  action: "add",
  amount: "",
  reason: "",
};

function BalanceAdjustForm({
  onAdjustBalance,
  loading = false,
  disabled = false,
}) {
  const { notify } = useFeedback();
  const [form, setForm] = useState(initialForm);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.balanceType) {
      notify({
        type: "warning",
        title: "Balance type required",
        message: "Select Cash Balance or GPay Balance.",
      });
      return;
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      notify({
        type: "warning",
        title: "Invalid amount",
        message: "Enter an amount greater than zero.",
      });
      return;
    }

    const updated = await onAdjustBalance({
      balanceType: form.balanceType,
      action: form.action,
      amount,
      reason: form.reason.trim() || "Manual balance adjustment",
    });

    if (!updated) return;

    setForm(initialForm);
  }

  return (
    <form className="card balance-adjust-form" onSubmit={handleSubmit}>
      <h3>Adjust Balance</h3>

      <div className="form-grid">
        <Select
          label="Balance Type"
          name="balanceType"
          value={form.balanceType}
          onChange={handleChange}
          options={[
            { label: "Select balance", value: "" },
            ...BALANCE_TYPES,
          ]}
          required
          disabled={loading || disabled}
        />

        <Select
          label="Action"
          name="action"
          value={form.action}
          onChange={handleChange}
          options={[
            { label: "Add Balance", value: "add" },
            { label: "Reduce Balance", value: "reduce" },
          ]}
          disabled={loading || disabled}
        />

        <Input
          label="Amount"
          name="amount"
          type="number"
          value={form.amount}
          onChange={handleChange}
          placeholder="Enter amount"
          min="1"
          step="1"
          required
          disabled={loading || disabled}
        />

        <Input
          label="Reason"
          name="reason"
          value={form.reason}
          onChange={handleChange}
          placeholder="Example: Added funds, correction"
          disabled={loading || disabled}
        />
      </div>

      <Button
        type="submit"
        variant="secondary"
        loading={loading}
        disabled={disabled}
      >
        Apply
      </Button>
    </form>
  );
}

export default BalanceAdjustForm;
