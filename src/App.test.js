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

  // Switch back to Calendar View
  const calendarTab = screen.getByText(/Program & Takvim/i);
  fireEvent.click(calendarTab);

  // Check ModernCalendarView elements
  expect(screen.getByText(/Etkileşimli Tıp Takvimi/i)).toBeInTheDocument();
  expect(screen.getByTitle(/Haftalık Ders Tablosu/i)).toBeInTheDocument();
  expect(screen.getByTitle(/Günlük Zaman Çizelgesi/i)).toBeInTheDocument();
  expect(screen.getByTitle(/Kurul Matrisi/i)).toBeInTheDocument();
  expect(screen.getByTitle(/Gruplu Ajanda Listesi/i)).toBeInTheDocument();

  // Test switching to Daily view
  const dailyBtn = screen.getByTitle(/Günlük Zaman Çizelgesi/i);
  fireEvent.click(dailyBtn);
  expect(screen.getAllByText(/Pazartesi/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Salı/i).length).toBeGreaterThan(0);

  // Test switching to Matrix view
  const matrixBtn = screen.getByTitle(/Kurul Matrisi/i);
  fireEvent.click(matrixBtn);
  expect(screen.getByText(/Program Günü/i)).toBeInTheDocument();

  // Test switching to Agenda view
  const agendaBtn = screen.getByTitle(/Gruplu Ajanda Listesi/i);
  fireEvent.click(agendaBtn);
});

