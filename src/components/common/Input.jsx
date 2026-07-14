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
  max,
  step,
  list,
  autoFocus = false,
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
        max={max}
        step={step}
        list={list}
        autoFocus={autoFocus}
        disabled={disabled}
        className={error ? "input input--error" : "input"}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      />

      {helperText && !error && <small>{helperText}</small>}
      {error && (
        <small id={`${name}-error`} className="error-text" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

export default Input;
