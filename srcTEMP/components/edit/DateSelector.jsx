import Button from "../common/Button";
import Input from "../common/Input";

function DateSelector({ selectedDate, onDateChange, onShowData, loading }) {
  function handleSubmit(event) {
    event.preventDefault();
    onShowData();
  }

  return (
    <form className="card date-selector" onSubmit={handleSubmit}>
      <h3>Select Date</h3>

      <div className="date-selector__row">
        <Input
          label="Date"
          name="date"
          type="date"
          value={selectedDate}
          onChange={(event) => onDateChange(event.target.value)}
          required
          disabled={loading}
        />

        <div className="date-selector__button">
          <Button type="submit" loading={loading}>
            Show Data
          </Button>
        </div>
      </div>
    </form>
  );
}

export default DateSelector;