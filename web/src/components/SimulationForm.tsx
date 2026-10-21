import type { SimulationRequest } from '@consignado/shared';
import { useRef, useState, type FormEvent, type HTMLAttributes } from 'react';
import {
  emptyFormValues,
  validateForm,
  type FormErrors,
  type FormField,
  type FormValues,
} from '../lib/form';
import { maskBrl, maskCnpj, maskCpf, maskDigits } from '../lib/masks';
import { Field } from './Field';

type FieldConfig = {
  name: FormField;
  label: string;
  mask: (value: string) => string;
  inputMode: HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  placeholder: string;
};

const keepAsTyped = (value: string) => value;

const fields: readonly FieldConfig[] = [
  {
    name: 'name',
    label: 'Nome completo',
    mask: keepAsTyped,
    inputMode: 'text',
    autoComplete: 'name',
    placeholder: 'Como no documento',
  },
  {
    name: 'email',
    label: 'E-mail',
    mask: keepAsTyped,
    inputMode: 'email',
    autoComplete: 'email',
    placeholder: 'voce@exemplo.com',
  },
  { name: 'cpf', label: 'CPF', mask: maskCpf, inputMode: 'numeric', placeholder: '000.000.000-00' },
  {
    name: 'employerCnpj',
    label: 'CNPJ do empregador',
    mask: maskCnpj,
    inputMode: 'numeric',
    placeholder: '00.000.000/0000-00',
  },
  {
    name: 'salary',
    label: 'Salário bruto mensal',
    mask: maskBrl,
    inputMode: 'decimal',
    placeholder: '0,00',
  },
  {
    name: 'existingDeductions',
    label: 'Descontos consignados existentes',
    mask: maskBrl,
    inputMode: 'decimal',
    placeholder: '0,00',
  },
  {
    name: 'requestedAmount',
    label: 'Valor desejado',
    mask: maskBrl,
    inputMode: 'decimal',
    placeholder: '0,00',
  },
  {
    name: 'termMonths',
    label: 'Prazo (meses)',
    mask: (value) => maskDigits(value, 2),
    inputMode: 'numeric',
    placeholder: 'De 6 a 96',
  },
];

export type SimulationFormProps = {
  onSubmit: (request: SimulationRequest) => void;
  disabled?: boolean;
  serverErrors?: FormErrors;
};

const noErrors: FormErrors = {};

export function SimulationForm({
  onSubmit,
  disabled = false,
  serverErrors = noErrors,
}: SimulationFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<FormValues>(emptyFormValues);
  const [visible, setVisible] = useState<ReadonlySet<FormField>>(new Set());
  const [edited, setEdited] = useState<ReadonlySet<FormField>>(new Set());
  const [shownServerErrors, setShownServerErrors] = useState(serverErrors);

  if (shownServerErrors !== serverErrors) {
    setShownServerErrors(serverErrors);
    setEdited(new Set());
  }

  const validation = validateForm(values);
  const clientErrors = validation.success ? noErrors : validation.errors;

  function errorFor(field: FormField): string | undefined {
    const clientError = visible.has(field) ? clientErrors[field] : undefined;

    return clientError ?? (edited.has(field) ? undefined : serverErrors[field]);
  }

  function handleChange(field: FieldConfig, value: string) {
    setValues((current) => ({ ...current, [field.name]: field.mask(value) }));
    setEdited((current) => new Set(current).add(field.name));
  }

  function handleBlur(field: FormField) {
    setVisible((current) => new Set(current).add(field));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled) {
      return;
    }

    if (validation.success) {
      onSubmit(validation.data);
      return;
    }

    setVisible(new Set(fields.map((field) => field.name)));

    const firstInvalid = fields.find((field) => validation.errors[field.name]);
    const input = firstInvalid && formRef.current?.elements.namedItem(firstInvalid.name);

    if (input instanceof HTMLInputElement) {
      input.focus();
    }
  }

  return (
    <form ref={formRef} className="simulation-form" noValidate onSubmit={handleSubmit}>
      <div className="form-fields">
        {fields.map((field) => (
          <Field
            key={field.name}
            name={field.name}
            label={field.label}
            value={values[field.name]}
            error={errorFor(field.name)}
            inputMode={field.inputMode}
            autoComplete={field.autoComplete}
            placeholder={field.placeholder}
            onChange={(value) => handleChange(field, value)}
            onBlur={() => handleBlur(field.name)}
          />
        ))}
      </div>
      <button type="submit" disabled={disabled}>
        Simular
      </button>
    </form>
  );
}
