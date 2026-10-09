/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Valor numérico como string (ex: "1234.56" ou ""), igual o resto do app usa com parseFloat. */
  value: string;
  /** Emite o valor numérico atualizado como string (ex: "1234.56"), ou "" se zerado. */
  onChange: (value: string) => void;
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Input de valor em reais no estilo "app de banco": os dígitos digitados
 * empurram da direita pra esquerda, formatando com ponto de milhar e vírgula
 * decimal automaticamente (ex: digitar "1234" vira "12,34"). Não dá pra
 * digitar vírgula/ponto direto — só dígitos, o resto é formatado sozinho.
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, ...rest }, ref) => {
    const cents = Math.round((parseFloat(value || '0') || 0) * 100);
    const display = value === '' ? '' : centsToDisplay(cents);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digitsOnly = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
      if (digitsOnly === '') {
        onChange('');
        return;
      }
      const newCents = parseInt(digitsOnly, 10);
      onChange((newCents / 100).toFixed(2));
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={handleChange}
        className={className}
        {...rest}
      />
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';

export default CurrencyInput;
