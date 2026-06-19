function Input({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder = "",
  error = "",
  helperText = "",
  required = false,
  min,
  step,
  list,
  disabled = false,
}) {
  return (
    <div className="form-field">
      {label && (
        <label htmlFor={name}>
          {label} {required && <span className="required">*</span>}
        </label>
      )}

      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        step={step}
        list={list}
        disabled={disabled}
        className={error ? "input input--error" : "input"}
      />

      {helperText && !error && <small>{helperText}</small>}
      {error && <small className="error-text">{error}</small>}
    </div>
  );
}

export default Input;