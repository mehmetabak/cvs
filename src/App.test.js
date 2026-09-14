import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('renders header, preset kurullar and switches to exam analytics view', () => {
  render(<App />);
  const titleElements = screen.getAllByText(/Ders Programı/i);
  expect(titleElements.length).toBeGreaterThan(0);

  const presetTab = screen.getByText(/2026-2027 Kurulları/i);
  expect(presetTab).toBeInTheDocument();

  // Test switching to Exam Analytics view
  const analyticsTab = screen.getByText(/Sınav & Ders Oran Analizi/i);
  expect(analyticsTab).toBeInTheDocument();

  fireEvent.click(analyticsTab);

  // In Exam Analytics View
  expect(screen.getByText(/Soru Sayısı Dağılımı/i)).toBeInTheDocument();
  expect(screen.getByText(/Tahmini Not Simülatörü/i)).toBeInTheDocument();
  expect(screen.getByText(/Sınav Ağırlık Ayarları/i)).toBeInTheDocument();
  expect(screen.getAllByText(/Anatomi/i).length).toBeGreaterThan(0);
});
