import type { HTMLAttributes } from 'react';

export type FieldProps = {
  name: string;
  label: string;
  value: string;
  error?: string | undefined;
  inputMode: HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string | undefined;
  placeholder?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
};

export function Field({
  name,
  label,
  value,
  error,
  inputMode,
  autoComplete = 'off',
  placeholder,
  onChange,
  onBlur,
}: FieldProps) {
  const errorId = `${name}-error`;

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type="text"
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
