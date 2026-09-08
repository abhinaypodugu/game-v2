import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';

it('smoke: App renders heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /catan/i })).toBeInTheDocument();
});
