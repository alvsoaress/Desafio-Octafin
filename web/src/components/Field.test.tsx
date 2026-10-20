import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Field } from './Field';

function renderField(error?: string) {
  render(
    <Field
      name="cpf"
      label="CPF"
      value=""
      error={error}
      inputMode="numeric"
      onChange={vi.fn()}
      onBlur={vi.fn()}
    />,
  );

  return screen.getByLabelText('CPF');
}

describe('Field', () => {
  it('liga o rótulo ao campo', () => {
    expect(renderField()).toHaveAttribute('id', 'cpf');
  });

  it('descreve o campo com o erro e o marca como inválido', () => {
    const input = renderField('Informe um CPF válido.');

    expect(input).toHaveAccessibleDescription('Informe um CPF válido.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('sem erro, não tem descrição nem aria-invalid', () => {
    const input = renderField();

    expect(input).not.toHaveAccessibleDescription();
    expect(input).not.toHaveAttribute('aria-invalid');
  });
});
