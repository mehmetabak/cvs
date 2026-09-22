import React, { useState, useMemo, useEffect } from 'react';
import { 
  Columns, Clock, CalendarDays, ListFilter, 
  ChevronLeft, ChevronRight, Search, User, 
  BookOpen, X, Sparkles, 
  Calendar as CalendarIcon
} from 'lucide-react';
import { extractDepartmentName, isDemoEvent } from '../utils/examAnalytics';

// Tıp Fakültesi Standart Saat Aralıkları
const STANDARD_TIME_SLOTS = [
  { start: '08:15', end: '09:00', label: '1. Ders' },
  { start: '09:15', end: '10:00', label: '2. Ders' },
  { start: '10:15', end: '11:00', label: '3. Ders' },
  { start: '11:15', end: '12:00', label: '4. Ders' },
  { isBreak: true, start: '12:00', end: '13:30', label: 'Öğle Arası' },
  { start: '13:30', end: '14:15', label: '5. Ders' },
  { start: '14:30', end: '15:15', label: '6. Ders' },
  { start: '15:30', end: '16:15', label: '7. Ders' },
  { start: '16:30', end: '17:15', label: '8. Ders' }
];

const WEEK_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];

const ModernCalendarView = ({
  events = [],
  allWeeks = [],
  selectedWeek = 'all',
  onSelectWeek = () => {},
  kurulName = 'Kurul Programı',
  searchTerm = '',
  onSearchChange = () => {},
  selectedGroup = 'all',
  includeSelfStudy = true,
  onDownloadICS = () => {},
  stats = null
}) => {
  // Görünüm Modu: 'weekly' (Haftalık Tablo), 'daily' (Günlük Çizelge), 'monthly' (Aylık/Kurul Matrisi), 'agenda' (Ajanda)
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'daily';
    }
    return 'weekly';
  });

  // Seçili aktif hafta (Eğer üst bileşenden 'all' gelirse ilk mevcut haftaya odaklan)
  const [activeWeekNum, setActiveWeekNum] = useState(1);

  // Günlük görünüm için seçili gün indexi veya tarihi
  const [activeDayName, setActiveDayName] = useState('Pazartesi');

  // Detay Modal State
  const [selectedEventModal, setSelectedEventModal] = useState(null);

  // İlk mevcut haftayı senkronize et
  useEffect(() => {
    if (selectedWeek !== 'all') {
      setActiveWeekNum(Number(selectedWeek));
    } else if (allWeeks.length > 0 && !allWeeks.includes(activeWeekNum)) {
      setActiveWeekNum(allWeeks[0]);
    }
  }, [selectedWeek, allWeeks, activeWeekNum]);

  // Aktif haftanın etkinlikleri
  const weekEvents = useMemo(() => {
    return events.filter(e => {
      if (selectedWeek !== 'all') return true; // Zaten üst bileşenden filtrelenmiş
      return e.week === activeWeekNum;
    });
  }, [events, selectedWeek, activeWeekNum]);

  // Aktif haftanın gün bazında tarih eşlemesi
  const weekDayDates = useMemo(() => {
    const map = {};
    WEEK_DAYS.forEach(d => { map[d] = null; });
    weekEvents.forEach(e => {
      if (e.day && e.date && !map[e.day]) {
        map[e.day] = e.date;
      }
    });
    return map;
  }, [weekEvents]);

  // Aktif haftanın tarih aralığı özeti (Örn: 21 - 25 Eylül 2026)
  const weekDateRangeLabel = useMemo(() => {
    const dates = weekEvents
      .map(e => e.date)
      .filter(Boolean)
      .sort();
    if (dates.length === 0) return `${activeWeekNum}. Hafta`;
    const first = new Date(dates[0]);
    const last = new Date(dates[dates.length - 1]);
    const fStr = first.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    const lStr = last.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fStr} – ${lStr}`;
  }, [weekEvents, activeWeekNum]);

  // Gün bazlı ders sayıları
  const dayStats = useMemo(() => {
    const counts = {};
    WEEK_DAYS.forEach(d => { counts[d] = 0; });
    weekEvents.forEach(e => {
      if (e.day && counts[e.day] !== undefined) {
        counts[e.day]++;
      }
    });
    return counts;
  }, [weekEvents]);

  // Hafta değiştirme yardımcıları
  const currentWeekIndex = allWeeks.indexOf(activeWeekNum);
  const handlePrevWeek = () => {
    if (currentWeekIndex > 0) {
      const prev = allWeeks[currentWeekIndex - 1];
      setActiveWeekNum(prev);
      if (selectedWeek !== 'all') onSelectWeek(prev);
    }
  };
  const handleNextWeek = () => {
    if (currentWeekIndex < allWeeks.length - 1) {
      const next = allWeeks[currentWeekIndex + 1];
      setActiveWeekNum(next);
      if (selectedWeek !== 'all') onSelectWeek(next);
    }
  };

  // Belirli bir gün ve saatteki etkinlikleri bul
  const getEventsForSlot = (day, slotStart) => {
    return weekEvents.filter(e => {
      if (e.day !== day) return false;
      return e.startTime === slotStart;
    });
  };

  // Günlük görünüm için o günün sıralı dersleri
  const dailyEvents = useMemo(() => {
    return weekEvents
      .filter(e => e.day === activeDayName)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [weekEvents, activeDayName]);

  // Ajanda görünümü için tarih/gün gruplu dersler
  const groupedAgendaEvents = useMemo(() => {
    const groups = {};
    events.forEach(e => {
      const key = e.date || `${e.week || 1}-${e.day}`;
      if (!groups[key]) {
        groups[key] = {
          date: e.date,
          day: e.day,
          week: e.week,
          events: []
        };
      }
      groups[key].events.push(e);
    });

    return Object.values(groups).sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.week !== b.week) return (a.week || 0) - (b.week || 0);
      return 0;
    });
  }, [events]);

  // Aylık / Kurul günleri
  const kurulDaysOverview = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const dKey = e.date || `${e.week}. Hafta ${e.day}`;
      if (!map[dKey]) {
        map[dKey] = {
          date: e.date,
          week: e.week,
          day: e.day,
          theoryCount: 0,
          practiceCount: 0,
          hasExam: false,
          totalCount: 0
        };
      }
      map[dKey].totalCount++;
      if (e.isExam) map[dKey].hasExam = true;
      else if (e.type === 'U') map[dKey].practiceCount++;
      else if (e.type === 'T') map[dKey].theoryCount++;
    });
    return Object.values(map);
  }, [events]);

  return (
    <div className="glass-panel rounded-xl p-4 sm:p-5 space-y-4">
      
      {/* --- ÜST KONTROL ŞERİDİ: ARAMA, GÖRÜNÜM SEÇİCİ & HAFTA NAVİGASYONU --- */}
      <div className="flex flex-col gap-3.5">
        
        {/* Satır 1: Başlık & Görünüm Seçici Butonları */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
              <CalendarIcon size={13} />
              <span>Etkileşimli Tıp Takvimi</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {kurulName}
            </h2>
          </div>

          {/* Görünüm Seçici Segment (Segmented Control) */}
          <div className="grid grid-cols-4 p-1 rounded-xl bg-zinc-900 border border-zinc-800 self-stretch sm:self-auto text-xs font-semibold">
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg transition-all ${
                viewMode === 'weekly'
                  ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Haftalık Ders Tablosu"
            >
              <Columns size={13} />
              <span className="hidden sm:inline">Haftalık</span>
              <span className="sm:hidden">Hafta</span>
            </button>

            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg transition-all ${
                viewMode === 'daily'
                  ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Günlük Zaman Çizelgesi (Mobil Uyumlu)"
            >
              <Clock size={13} />
              <span className="hidden sm:inline">Günlük</span>
              <span className="sm:hidden">Gün</span>
            </button>

            <button
              onClick={() => setViewMode('monthly')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg transition-all ${
                viewMode === 'monthly'
                  ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Kurul Matrisi"
            >
              <CalendarDays size={13} />
              <span className="hidden sm:inline">Matris</span>
              <span className="sm:hidden">Matris</span>
            </button>

            <button
              onClick={() => setViewMode('agenda')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg transition-all ${
                viewMode === 'agenda'
                  ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Gruplu Ajanda Listesi"
            >
              <ListFilter size={13} />
              <span className="hidden sm:inline">Ajanda</span>
              <span className="sm:hidden">Liste</span>
            </button>
          </div>
        </div>

        {/* Satır 2: Hafta Navigasyonu & Arama */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 pt-2 border-t border-zinc-800">
          
          {/* Hafta Atlama & Navigasyon */}
          {allWeeks.length > 0 && viewMode !== 'agenda' && (
            <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={handlePrevWeek}
                disabled={currentWeekIndex <= 0}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                title="Önceki Hafta"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="px-2.5 text-center">
                <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                  <span className="font-mono">{activeWeekNum}. Hafta</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span className="text-[11px] font-normal text-zinc-400">{weekDateRangeLabel}</span>
                </div>
              </div>

              <button
                onClick={handleNextWeek}
                disabled={currentWeekIndex >= allWeeks.length - 1}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                title="Sonraki Hafta"
              >
                <ChevronRight size={16} />
              </button>

              {allWeeks.length > 1 && (
                <select
                  value={activeWeekNum}
                  onChange={(e) => {
                    const w = Number(e.target.value);
                    setActiveWeekNum(w);
                    if (selectedWeek !== 'all') onSelectWeek(w);
                  }}
                  className="ml-1 bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400"
                >
                  {allWeeks.map(w => (
                    <option key={w} value={w}>{w}. Hafta</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Arama Inputu */}
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Ders, hoca veya konu ara..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400 transition"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Satır 3: İstatistik Mini Şeridi */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800">
            <div className="py-1.5 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold font-mono">Toplam Ders</div>
              <div className="text-sm font-bold text-white font-mono">{stats.total}s</div>
            </div>
            <div className="py-1.5 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
              <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold font-mono">Teorik (T)</div>
              <div className="text-sm font-bold text-amber-400 font-mono">{stats.teorik}s</div>
            </div>
            <div className="py-1.5 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold font-mono">Pratik (U)</div>
              <div className="text-sm font-bold text-emerald-400 font-mono">{stats.pratik}s</div>
            </div>
            <div className="py-1.5 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
              <div className="text-[10px] uppercase tracking-wider text-rose-400 font-semibold font-mono">Sınavlar</div>
              <div className="text-sm font-bold text-rose-400 font-mono">{stats.sinav}</div>
            </div>
          </div>
        )}

      </div>

      {/* --- GÖRÜNÜM 1: HAFTALIK TABLO (WEEKLY TIMETABLE GRID) --- */}
      {viewMode === 'weekly' && (
        <div className="space-y-3">
          
          {/* Mobil İpucu */}
          <div className="sm:hidden flex items-center justify-between px-1 text-[11px] text-zinc-500">
            <span>Tabloyu yatay kaydırabilirsiniz</span>
            <span className="text-amber-400 font-medium">5 Günlük Matris</span>
          </div>

          {/* Yatay Kaydırılabilir Tablo Konteyneri */}
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60 pb-1">
            <div className="min-w-[760px]">
              
              {/* Başlık Satırı (Günler) */}
              <div className="grid grid-cols-6 border-b border-zinc-800 bg-zinc-900/90 sticky top-0 z-10">
                {/* Saat Sütunu Başlığı */}
                <div className="p-2.5 text-center border-r border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-center gap-1 font-mono">
                  <Clock size={12} className="text-amber-400" />
                  <span>Saat</span>
                </div>

                {/* Gün Sütunları */}
                {WEEK_DAYS.map((day) => {
                  const dateStr = weekDayDates[day];
                  const count = dayStats[day] || 0;
                  const formattedDate = dateStr
                    ? new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
                    : '';

                  return (
                    <div
                      key={day}
                      className="p-2.5 border-r border-zinc-800 last:border-r-0 text-center space-y-0.5"
                    >
                      <div className="font-bold text-xs sm:text-sm text-white">{day}</div>
                      <div className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5 font-mono">
                        {formattedDate && <span>{formattedDate}</span>}
                        {count > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-[10px] text-zinc-300 font-medium">
                            {count}s
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Saat Satırları */}
              {STANDARD_TIME_SLOTS.map((slot) => {
                if (slot.isBreak) {
                  return (
                    <div
                      key="lunch-break"
                      className="grid grid-cols-6 bg-zinc-950/80 border-b border-zinc-800/80 text-zinc-500 text-xs"
                    >
                      <div className="p-1.5 text-center font-mono font-medium text-[10px] border-r border-zinc-800/80 text-zinc-500">
                        12:00 - 13:30
                      </div>
                      <div className="col-span-5 p-1.5 text-center text-xs tracking-wide text-zinc-500 italic">
                        Öğle Arası (12:00 - 13:30)
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={slot.start}
                    className="grid grid-cols-6 border-b border-zinc-800/80 min-h-[5rem] hover:bg-zinc-900/30 transition-colors"
                  >
                    {/* Saat Dilimi */}
                    <div className="p-2 border-r border-zinc-800/80 flex flex-col items-center justify-center text-center bg-zinc-900/40">
                      <span className="font-mono text-xs font-semibold text-zinc-200">{slot.start}</span>
                      <span className="font-mono text-[10px] text-zinc-500">{slot.end}</span>
                      <span className="text-[9px] text-zinc-500 font-medium mt-0.5">{slot.label}</span>
                    </div>

                    {/* 5 Günün Hücreleri */}
                    {WEEK_DAYS.map((day) => {
                      const slotEvents = getEventsForSlot(day, slot.start);

                      if (slotEvents.length === 0) {
                        return (
                          <div
                            key={day}
                            className="p-1 border-r border-zinc-800/80 last:border-r-0 flex items-center justify-center opacity-25"
                          >
                            <span className="text-[10px] text-zinc-600 font-mono">-</span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={day}
                          className="p-1 border-r border-zinc-800/80 last:border-r-0 flex flex-col gap-1 justify-center"
                        >
                          {slotEvents.map((evt) => {
                            const isExam = evt.isExam;
                            const isDemo = isDemoEvent(evt.title);
                            const isPratik = evt.type === 'U';
                            const isSelf = evt.isSelfStudy;

                            return (
                              <button
                                key={evt.id}
                                onClick={() => setSelectedEventModal(evt)}
                                className={`w-full text-left p-2 rounded-lg border transition-all duration-150 shadow-sm relative overflow-hidden group ${
                                  isExam
                                    ? 'bg-rose-950/30 border-rose-500/40 hover:border-rose-400 text-rose-200'
                                    : isDemo
                                    ? 'bg-zinc-900 border-zinc-700/80 hover:border-zinc-500 text-zinc-200'
                                    : isPratik
                                    ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-400 text-emerald-100'
                                    : isSelf
                                    ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                    : 'bg-zinc-900/90 border-zinc-800 hover:border-amber-400/60 text-zinc-100'
                                }`}
                              >
                                {/* Sol Anabilim Dalı Renk Şeridi */}
                                <div 
                                  className="absolute left-0 top-0 bottom-0 w-1"
                                  style={{ backgroundColor: isExam ? '#f43f5e' : isDemo ? '#71717a' : isPratik ? '#10b981' : isSelf ? '#52525b' : '#f59e0b' }}
                                />

                                <div className="pl-1.5 space-y-1">
                                  {/* Rozetler */}
                                  <div className="flex items-center justify-between gap-1 flex-wrap">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                                      isExam 
                                        ? 'bg-rose-500/20 text-rose-300' 
                                        : isDemo
                                        ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                        : isPratik 
                                        ? 'bg-emerald-500/20 text-emerald-300' 
                                        : isSelf
                                        ? 'bg-zinc-800 text-zinc-400'
                                        : 'bg-amber-400/10 text-amber-300'
                                    }`}>
                                      {isExam ? 'SINAV' : isDemo ? 'Demo Tekrar' : isPratik ? 'Pratik' : isSelf ? 'Çalışma' : 'Teorik'}
                                    </span>

                                    {evt.group && evt.group !== 'TÜM' && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-amber-400 font-mono">
                                        {evt.group}
                                      </span>
                                    )}
                                  </div>

                                  {/* Ders Başlığı */}
                                  <div className="text-[11px] font-medium leading-tight line-clamp-2 text-white group-hover:text-amber-200 transition-colors">
                                    {evt.title}
                                  </div>

                                  {/* Hoca Bilgisi */}
                                  {evt.instructor && (
                                    <div className="text-[10px] text-zinc-400 truncate flex items-center gap-1">
                                      <User size={10} className="text-zinc-500 flex-shrink-0" />
                                      <span className="truncate">{evt.instructor}</span>
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

            </div>
          </div>
        </div>
      )}

      {/* --- GÖRÜNÜM 2: GÜNLÜK ZAMAN ÇİZELGESİ (DAILY TIMELINE - MOBİL UYUMLU) --- */}
      {viewMode === 'daily' && (
        <div className="space-y-4">
          
          {/* Gün Seçici Yatay Butonlar (Horizontal Day Pills) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {WEEK_DAYS.map((day) => {
              const isSelected = activeDayName === day;
              const dateStr = weekDayDates[day];
              const count = dayStats[day] || 0;
              const formattedDate = dateStr
                ? new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
                : '';

              return (
                <button
                  key={day}
                  onClick={() => setActiveDayName(day)}
                  className={`flex-1 min-w-[95px] p-2.5 rounded-lg border transition-all text-center space-y-1 ${
                    isSelected
                      ? 'bg-amber-400 border-amber-400 text-zinc-950 font-bold shadow-sm'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
                  }`}
                >
                  <div className="text-xs font-bold">{day}</div>
                  <div className="text-[10px] opacity-80 font-mono">{formattedDate || '-'}</div>
                  <div className={`text-[10px] font-semibold inline-block px-1.5 py-0.2 rounded font-mono ${
                    isSelected ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-800 text-zinc-300'
                  }`}>
                    {count} Ders
                  </div>
                </button>
              );
            })}
          </div>

          {/* Günlük Zaman Çizelgesi Akışı */}
          <div className="relative pl-6 sm:pl-8 space-y-3.5 pt-2">
            {/* Dikey Çizgi (Timeline Rail) */}
            <div className="timeline-rail" />

            {dailyEvents.length === 0 ? (
              <div className="py-14 text-center text-zinc-400 space-y-2 bg-zinc-900/40 rounded-xl border border-zinc-800 p-6">
                <BookOpen size={32} className="mx-auto text-zinc-600" />
                <p className="text-sm font-semibold text-zinc-300">{activeDayName} günü için ders bulunamadı</p>
                <p className="text-xs text-zinc-500">Arama filtresini temizlemeyi veya başka bir güne geçmeyi deneyebilirsiniz.</p>
              </div>
            ) : (
              dailyEvents.map((event, idx) => {
                const isExam = event.isExam;
                const isDemo = isDemoEvent(event.title);
                const isPratik = event.type === 'U';
                const isSelf = event.isSelfStudy;

                return (
                  <div key={event.id || idx} className="relative group">
                    {/* Zaman Çizgisi Noktası (Dot) */}
                    <div className={`absolute -left-[29px] sm:-left-[37px] top-4 w-3.5 h-3.5 rounded-full border-2 border-zinc-950 flex items-center justify-center transition-transform group-hover:scale-125 ${
                      isExam
                        ? 'bg-rose-500 ring-4 ring-rose-500/20'
                        : isDemo
                        ? 'bg-zinc-400 ring-4 ring-zinc-500/20'
                        : isPratik
                        ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                        : isSelf
                        ? 'bg-zinc-600 ring-4 ring-zinc-600/20'
                        : 'bg-amber-400 ring-4 ring-amber-400/20'
                    }`} />

                    {/* Ders Kartı */}
                    <button
                      onClick={() => setSelectedEventModal(event)}
                      className={`w-full text-left p-3.5 rounded-lg border transition-all duration-150 glass-card hover:translate-x-1 ${
                        isExam
                          ? 'border-rose-500/40 bg-rose-950/20 hover:border-rose-400'
                          : isDemo
                          ? 'border-zinc-700/80 bg-zinc-900/80 hover:border-zinc-500'
                          : isPratik
                          ? 'border-emerald-500/30 bg-emerald-950/15 hover:border-emerald-400'
                          : isSelf
                          ? 'border-zinc-800 bg-zinc-900/50'
                          : 'hover:border-amber-400/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
                        {/* Rozetler */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            isExam
                              ? 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
                              : isDemo
                              ? 'bg-zinc-800 border border-zinc-700 text-zinc-300'
                              : isPratik
                              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                              : isSelf
                              ? 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                              : 'bg-amber-400/10 border border-amber-500/30 text-amber-300'
                          }`}>
                            {isExam ? 'SINAV' : isDemo ? 'Demo Tekrarı' : isPratik ? 'Pratik (U)' : isSelf ? 'Çalışma' : 'Teorik (T)'}
                          </span>

                          {event.group && event.group !== 'TÜM' && (
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-amber-400 text-[10px] font-bold font-mono">
                              {event.group}
                            </span>
                          )}

                          <span className="text-xs text-zinc-400 font-medium">
                            {extractDepartmentName(event.title)}
                          </span>
                        </div>

                        {/* Saat */}
                        <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono font-bold bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                          <Clock size={12} className="text-amber-400" />
                          <span>{event.startTime} - {event.endTime}</span>
                        </div>
                      </div>

                      {/* Başlık */}
                      <h4 className="font-semibold text-sm text-white mb-1.5 leading-snug">
                        {event.title}
                      </h4>

                      {/* Hoca Bilgisi */}
                      {event.instructor && (
                        <div className="flex items-center gap-2 text-xs text-zinc-400 pt-1.5 border-t border-zinc-800">
                          <User size={12} className="text-zinc-500 flex-shrink-0" />
                          <span className="truncate">{event.instructor}</span>
                        </div>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* --- GÖRÜNÜM 3: AYLIK / KURUL MATRİSİ (MONTH / KURUL OVERVIEW) --- */}
      {viewMode === 'monthly' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Kurulun tüm günleri ve ders yoğunlukları:</span>
            <span className="text-amber-400 font-medium font-mono">{kurulDaysOverview.length} Program Günü</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {kurulDaysOverview.map((item, idx) => {
              const formattedDate = item.date
                ? new Date(item.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
                : '';

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (item.week) setActiveWeekNum(item.week);
                    if (item.day) setActiveDayName(item.day);
                    setViewMode('daily');
                  }}
                  className={`p-3 rounded-lg border transition-all text-left space-y-1.5 group hover:border-amber-400/50 ${
                    item.hasExam
                      ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                      : 'glass-card'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      {item.day}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {formattedDate}
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-400 font-mono">
                    {item.week}. Hafta
                  </div>

                  <div className="pt-1.5 border-t border-zinc-800 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 font-bold font-mono">{item.totalCount} Ders</span>
                    {item.hasExam ? (
                      <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px] font-mono">
                        SINAV
                      </span>
                    ) : (
                      <span className="text-zinc-500 text-[10px] font-mono">
                        T:{item.theoryCount} U:{item.practiceCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* --- GÖRÜNÜM 4: GRUPLU AJANDA LİSTESİ (AGENDA VIEW) --- */}
      {viewMode === 'agenda' && (
        <div className="space-y-4 max-h-[46rem] overflow-y-auto pr-1">
          {groupedAgendaEvents.length === 0 ? (
            <div className="py-16 text-center text-zinc-400 space-y-2">
              <BookOpen size={36} className="mx-auto text-zinc-600" />
              <p className="text-sm font-semibold text-zinc-300">Görüntülenecek ders bulunamadı</p>
            </div>
          ) : (
            groupedAgendaEvents.map((group, gIdx) => {
              const formattedDate = group.date
                ? new Date(group.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                : '';

              return (
                <div key={gIdx} className="space-y-2">
                  {/* Sticky Gün Başlığı */}
                  <div className="sticky top-0 z-10 py-1.5 px-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-white">
                      <CalendarDays size={14} className="text-amber-400" />
                      <span>{formattedDate || group.day}</span>
                      {group.day && formattedDate && (
                        <span className="text-xs font-normal text-zinc-500">({group.day})</span>
                      )}
                    </div>
                    <div className="text-xs text-amber-400 font-semibold font-mono">
                      {group.week ? `${group.week}. Hafta • ` : ''}{group.events.length} Ders
                    </div>
                  </div>

                  {/* Günün Kartları */}
                  <div className="space-y-1.5 pl-1.5">
                    {group.events.map((event, idx) => {
                      const isExam = event.isExam;
                      const isPratik = event.type === 'U';
                      const isSelf = event.isSelfStudy;

                      return (
                        <button
                          key={event.id || idx}
                          onClick={() => setSelectedEventModal(event)}
                          className={`w-full text-left p-3 rounded-lg border transition-all duration-150 glass-card hover:translate-x-1 ${
                            isExam
                              ? 'border-rose-500/40 bg-rose-950/20 hover:border-rose-400'
                              : isPratik
                              ? 'border-emerald-500/30 hover:border-emerald-400'
                              : isSelf
                              ? 'border-zinc-800 bg-zinc-900/50'
                              : 'hover:border-amber-400/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold font-mono ${
                                isExam 
                                  ? 'bg-rose-500/20 text-rose-300' 
                                  : isPratik 
                                  ? 'bg-emerald-500/20 text-emerald-300' 
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}>
                                {isExam ? 'SINAV' : isPratik ? 'Pratik' : 'Teorik'}
                              </span>

                              {event.group && event.group !== 'TÜM' && (
                                <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-amber-400 text-[10px] font-bold font-mono">
                                  {event.group}
                                </span>
                              )}

                              <span className="text-xs text-zinc-400">
                                {extractDepartmentName(event.title)}
                              </span>
                            </div>

                            <div className="font-mono text-xs font-semibold text-zinc-300">
                              {event.startTime} - {event.endTime}
                            </div>
                          </div>

                          <div className="font-medium text-xs sm:text-sm text-white mb-1">
                            {event.title}
                          </div>

                          {event.instructor && (
                            <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                              <User size={11} className="text-zinc-500" />
                              <span>{event.instructor}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* --- DERS DETAY MODALI --- */}
      {selectedEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl relative">
            
            {/* Modal Üst Başlık & Kapat */}
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                    selectedEventModal.isExam
                      ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                      : isDemoEvent(selectedEventModal.title)
                      ? 'bg-zinc-800 border border-zinc-700 text-zinc-300'
                      : selectedEventModal.type === 'U'
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : 'bg-zinc-800 border border-zinc-700 text-zinc-200'
                  }`}>
                    {selectedEventModal.isExam
                      ? 'SINAV'
                      : isDemoEvent(selectedEventModal.title)
                      ? 'Demo / Laboratuvar Tekrarı'
                      : selectedEventModal.type === 'U'
                      ? 'Pratik Ders (U)'
                      : 'Teorik Ders (T)'}
                  </span>

                  {selectedEventModal.group && selectedEventModal.group !== 'TÜM' && (
                    <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-amber-400 text-xs font-bold font-mono">
                      Grup: {selectedEventModal.group}
                    </span>
                  )}
                </div>
                <div className="text-xs text-amber-400 font-semibold font-mono">
                  {extractDepartmentName(selectedEventModal.title)}
                </div>
              </div>

              <button
                onClick={() => setSelectedEventModal(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tam Ders Adı */}
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">Ders / Konu:</label>
              <h3 className="text-base font-bold text-white mt-1 leading-snug">
                {selectedEventModal.title}
              </h3>
            </div>

            {/* Bilgi Izgarası */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 font-mono">
                  <Clock size={12} className="text-amber-400" />
                  <span>Saat & Süre</span>
                </div>
                <div className="text-sm font-bold text-white font-mono">
                  {selectedEventModal.startTime} - {selectedEventModal.endTime}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 font-mono">
                  <CalendarIcon size={12} className="text-amber-400" />
                  <span>Tarih & Gün</span>
                </div>
                <div className="text-xs font-bold text-white">
                  {selectedEventModal.day}
                  {selectedEventModal.date && (
                    <span className="block text-[11px] font-mono text-zinc-400">
                      {new Date(selectedEventModal.date).toLocaleDateString('tr-TR')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Öğretim Üyesi */}
            {selectedEventModal.instructor && (
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                  <User size={12} className="text-zinc-400" />
                  <span>Öğretim Üyesi / Görevli</span>
                </div>
                <div className="text-xs sm:text-sm font-medium text-zinc-200">
                  {selectedEventModal.instructor}
                </div>
              </div>
            )}

            {/* Takvim Formatı Önizlemesi */}
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 space-y-1">
              <span className="font-semibold text-amber-400 flex items-center gap-1.5 font-mono text-[11px]">
                <Sparkles size={12} />
                <span>Takvim Etkinlik Başlığı:</span>
              </span>
              <p className="font-mono text-[11px] text-zinc-200 bg-zinc-900 p-2 rounded border border-zinc-800 break-words">
                {selectedEventModal.title} {selectedEventModal.isExam ? '(SINAV)' : selectedEventModal.type === 'U' ? `(Pratik${selectedEventModal.group && selectedEventModal.group !== 'TÜM' ? ' - ' + selectedEventModal.group : ''})` : '(Teorik)'}
              </p>
            </div>

            <button
              onClick={() => setSelectedEventModal(null)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold py-2 rounded-lg transition text-xs"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ModernCalendarView;
