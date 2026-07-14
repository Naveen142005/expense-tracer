function Select({
  label,
  name,
  value,
  onChange,
  options = [],
  error = "",
  required = false,
  disabled = false,
}) {
  return (
    <div className="form-field">
      {label && (
        <label htmlFor={name}>
          {label} {required && <span className="required">*</span>}
        </label>
      )}

      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={error ? "input input--error" : "input"}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error && (
        <small id={`${name}-error`} className="error-text" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

export default Select;
