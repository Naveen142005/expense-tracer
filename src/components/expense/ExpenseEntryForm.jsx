import { useEffect, useState } from "react";
import {
  FOOD_SUGGESTIONS,
  PAYMENT_TYPES,
  SNACK_SUGGESTIONS,
} from "../../utils/constants";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";

function getLabelByType(type) {
  if (type === "food") return "Food Name";
  if (type === "snacks") return "Snack Name";
  if (type === "bus") return "Description";
  return "Name / Description";
}

function getPlaceholderByType(type) {
  if (type === "food") return "Example: idly";
  if (type === "snacks") return "Example: biscuit";
  if (type === "bus") return "Example: Bus to office";
  return "Example: recharge, medicine, college";
}

function ExpenseEntryForm({
  activePeriod,
  selectedType,
  onAddItem,
  disabled = false,
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    paymentType: "cash",
  });

  useEffect(() => {
    setForm({
      name: "",
      description: "",
      price: "",
      paymentType: "cash",
    });
  }, [selectedType]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const price = Number(form.price);
    const textValue = form.name.trim();

    if (selectedType !== "bus" && !textValue) {
      alert("Name / description is required");
      return;
    }

    if (!price || price <= 0) {
      alert("Enter valid price");
      return;
    }

    onAddItem({
      id: crypto.randomUUID(),
      period: activePeriod,
      type: selectedType,
      name: selectedType === "bus" ? "" : textValue,
      description: selectedType === "bus" ? form.description.trim() : "",
      price,
      paymentType: form.paymentType,
      isDraft: true,
    });

    setForm({
      name: "",
      description: "",
      price: "",
      paymentType: "cash",
    });
  }

  const inputLabel = getLabelByType(selectedType);
  const inputPlaceholder = getPlaceholderByType(selectedType);

  return (
    <form className="card expense-entry-form" onSubmit={handleSubmit}>
      <h3>Add Expense Item</h3>

      <div className="form-grid">
        {selectedType === "food" && (
          <>
            <Input
              label={inputLabel}
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder={inputPlaceholder}
              list="food-suggestions"
              required
              disabled={disabled}
            />

            <datalist id="food-suggestions">
              {FOOD_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </>
        )}

        {selectedType === "snacks" && (
          <>
            <Input
              label={inputLabel}
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder={inputPlaceholder}
              list="snack-suggestions"
              required
              disabled={disabled}
            />

            <datalist id="snack-suggestions">
              {SNACK_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </>
        )}

        {selectedType === "bus" && (
          <Input
            label={inputLabel}
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder={inputPlaceholder}
            disabled={disabled}
          />
        )}

        {selectedType === "custom" && (
          <Input
            label={inputLabel}
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder={inputPlaceholder}
            required
            disabled={disabled}
          />
        )}

        <Input
          label="Price"
          name="price"
          type="number"
          value={form.price}
          onChange={handleChange}
          placeholder="Enter price"
          min="1"
          step="1"
          required
          disabled={disabled}
        />

        <Select
          label="Payment Type"
          name="paymentType"
          value={form.paymentType}
          onChange={handleChange}
          options={PAYMENT_TYPES}
          disabled={disabled}
        />
      </div>

      <Button type="submit" disabled={disabled}>
        Add Item
      </Button>
    </form>
  );
}

export default ExpenseEntryForm;
