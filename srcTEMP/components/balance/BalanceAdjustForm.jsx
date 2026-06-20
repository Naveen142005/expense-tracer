import { useState } from "react";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";

function BalanceAdjustForm({ onAdjustBalance, loading = false }) {
  const [form, setForm] = useState({
    action: "add",
    amount: "",
    reason: "",
  });

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      alert("Enter valid amount");
      return;
    }

    await onAdjustBalance({
      action: form.action,
      amount,
      reason: form.reason.trim() || "Manual balance adjustment",
    });

    setForm({
      action: "add",
      amount: "",
      reason: "",
    });
  }

  return (
    <form className="card balance-adjust-form" onSubmit={handleSubmit}>
      <h3>Adjust Balance</h3>

      <div className="form-grid">
        <Select
          label="Action"
          name="action"
          value={form.action}
          onChange={handleChange}
          options={[
            { label: "Add Balance", value: "add" },
            { label: "Reduce Balance", value: "reduce" },
          ]}
          disabled={loading}
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
          disabled={loading}
        />

        <Input
          label="Reason"
          name="reason"
          value={form.reason}
          onChange={handleChange}
          placeholder="Example: Added cash, correction"
          disabled={loading}
        />
      </div>

      <Button type="submit" variant="secondary" loading={loading}>
        Apply
      </Button>
    </form>
  );
}

export default BalanceAdjustForm;