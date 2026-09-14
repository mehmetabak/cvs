import { render, screen } from '@testing-library/react';
import App from './App';

test('renders header and preset kurullar', () => {
  render(<App />);
  const titleElements = screen.getAllByText(/Ders Programı/i);
  expect(titleElements.length).toBeGreaterThan(0);

  const presetTab = screen.getByText(/2026-2027 Kurulları/i);
  expect(presetTab).toBeInTheDocument();

  const kurulButtons = screen.getAllByText(/Kurul I \(Sinir Sistemi\)/i);
  expect(kurulButtons.length).toBeGreaterThan(0);
});
