import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PhoneInput } from './PhoneInput';

describe('PhoneInput', () => {
  it('keeps digits only and stops at 10 digits', async () => {
    render(<PhoneInput aria-label="Phone" />);
    const input = screen.getByLabelText('Phone');
    await userEvent.type(input, '+91 98765-abc43210 999');
    expect(input).toHaveValue('9198765432');
  });

  it('shows the +91 prefix and a numeric keypad on mobile', () => {
    render(<PhoneInput aria-label="Phone" />);
    expect(screen.getByText('+91')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toHaveAttribute('inputmode', 'numeric');
  });
});
