import React, { useState, useMemo, useEffect } from 'react';
import { 
  Columns, Clock, CalendarDays, ListFilter, 
  ChevronLeft, ChevronRight, Search, User, 
  BookOpen, X, Sparkles, 
  Calendar as CalendarIcon
} from 'lucide-react';
import { extractDepartmentName } from '../utils/examAnalytics';

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

  // Ekran boyutu küçüldüğünde mobilde rahat kullanım için uyarı
  useEffect(() => {
    const handleResize = () => {
      // Sadece kullanıcı henüz seçim yapmamışsa otomatik geçiş önerilebilir
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    <div className="glass-panel rounded-2xl border border-slate-800 p-4 sm:p-6 space-y-5">
      
      {/* --- ÜST KONTROL ŞERİDİ: ARAMA, GÖRÜNÜM SEÇİCİ & HAFTA NAVİGASYONU --- */}
      <div className="flex flex-col gap-4">
        
        {/* Satır 1: Başlık & Görünüm Seçici Butonları */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <CalendarIcon size={14} />
              <span>Etkileşimli Tıp Takvimi</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              {kurulName}
            </h2>
          </div>

          {/* Görünüm Seçici Segment (Segmented Control) */}
          <div className="grid grid-cols-4 p-1 rounded-xl bg-slate-900 border border-slate-800 self-stretch sm:self-auto text-xs font-semibold">
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all ${
                viewMode === 'weekly'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Haftalık Ders Tablosu"
            >
              <Columns size={14} />
              <span className="hidden sm:inline">Haftalık</span>
              <span className="sm:hidden">Hafta</span>
            </button>

            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all ${
                viewMode === 'daily'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Günlük Zaman Çizelgesi (Mobil Uyumlu)"
            >
              <Clock size={14} />
              <span className="hidden sm:inline">Günlük</span>
              <span className="sm:hidden">Gün</span>
            </button>

            <button
              onClick={() => setViewMode('monthly')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all ${
                viewMode === 'monthly'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Kurul Matrisi"
            >
              <CalendarDays size={14} />
              <span className="hidden sm:inline">Matris</span>
              <span className="sm:hidden">Matris</span>
            </button>

            <button
              onClick={() => setViewMode('agenda')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all ${
                viewMode === 'agenda'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Gruplu Ajanda Listesi"
            >
              <ListFilter size={14} />
              <span className="hidden sm:inline">Ajanda</span>
              <span className="sm:hidden">Liste</span>
            </button>
          </div>
        </div>

        {/* Satır 2: Hafta Navigasyonu & Arama */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          
          {/* Hafta Atlama & Navigasyon */}
          {allWeeks.length > 0 && viewMode !== 'agenda' && (
            <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
              <button
                onClick={handlePrevWeek}
                disabled={currentWeekIndex <= 0}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                title="Önceki Hafta"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="px-3 text-center">
                <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                  <span>{activeWeekNum}. Hafta</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  <span className="text-[11px] font-normal text-slate-400">{weekDateRangeLabel}</span>
                </div>
              </div>

              <button
                onClick={handleNextWeek}
                disabled={currentWeekIndex >= allWeeks.length - 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                title="Sonraki Hafta"
              >
                <ChevronRight size={18} />
              </button>

              {allWeeks.length > 1 && (
                <select
                  value={activeWeekNum}
                  onChange={(e) => {
                    const w = Number(e.target.value);
                    setActiveWeekNum(w);
                    if (selectedWeek !== 'all') onSelectWeek(w);
                  }}
                  className="ml-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none"
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
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Ders, hoca veya konu ara..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Satır 3: İstatistik Mini Şeridi */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/60">
            <div className="py-2 px-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Toplam Ders</div>
              <div className="text-base font-bold text-white">{stats.total}s</div>
            </div>
            <div className="py-2 px-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
              <div className="text-[10px] uppercase tracking-wider text-indigo-400 font-semibold">Teorik (T)</div>
              <div className="text-base font-bold text-indigo-300">{stats.teorik}s</div>
            </div>
            <div className="py-2 px-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Pratik (U)</div>
              <div className="text-base font-bold text-emerald-300">{stats.pratik}s</div>
            </div>
            <div className="py-2 px-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
              <div className="text-[10px] uppercase tracking-wider text-rose-400 font-semibold">Sınavlar</div>
              <div className="text-base font-bold text-rose-300">{stats.sinav}</div>
            </div>
          </div>
        )}

      </div>

      {/* --- GÖRÜNÜM 1: HAFTALIK TABLO (WEEKLY TIMETABLE GRID) --- */}
      {viewMode === 'weekly' && (
        <div className="space-y-3">
          
          {/* Mobil İpucu */}
          <div className="sm:hidden flex items-center justify-between px-2 text-[11px] text-slate-400">
            <span>Tabloyu yatay kaydırabilirsiniz</span>
            <span className="text-indigo-400 font-medium">5 Günlük Matris</span>
          </div>

          {/* Yatay Kaydırılabilir Tablo Konteyneri */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 pb-2">
            <div className="min-w-[760px]">
              
              {/* Başlık Satırı (Günler) */}
              <div className="grid grid-cols-6 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
                {/* Saat Sütunu Başlığı */}
                <div className="p-3 text-center border-r border-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
                  <Clock size={13} className="text-indigo-400" />
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
                      className="p-3 border-r border-slate-800/80 last:border-r-0 text-center space-y-0.5"
                    >
                      <div className="font-bold text-xs sm:text-sm text-white">{day}</div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                        {formattedDate && <span>{formattedDate}</span>}
                        {count > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-indigo-300 font-medium">
                            {count}s
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Saat Satırları */}
              {STANDARD_TIME_SLOTS.map((slot, sIdx) => {
                if (slot.isBreak) {
                  return (
                    <div
                      key="lunch-break"
                      className="grid grid-cols-6 bg-slate-900/40 border-b border-slate-800/60 text-slate-400 text-xs"
                    >
                      <div className="p-2 text-center font-mono font-medium text-[11px] border-r border-slate-800/60 text-slate-400">
                        12:00 - 13:30
                      </div>
                      <div className="col-span-5 p-2 text-center text-xs tracking-wide text-slate-400 italic">
                        Öğle Arası (12:00 - 13:30)
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={slot.start}
                    className="grid grid-cols-6 border-b border-slate-800/60 min-h-[5.25rem] hover:bg-slate-900/20 transition-colors"
                  >
                    {/* Saat Dilimi */}
                    <div className="p-2 border-r border-slate-800/60 flex flex-col items-center justify-center text-center bg-slate-900/30">
                      <span className="font-mono text-xs font-semibold text-slate-200">{slot.start}</span>
                      <span className="font-mono text-[10px] text-slate-400">{slot.end}</span>
                      <span className="text-[9px] text-slate-400 font-medium mt-0.5">{slot.label}</span>
                    </div>

                    {/* 5 Günün Hücreleri */}
                    {WEEK_DAYS.map((day) => {
                      const slotEvents = getEventsForSlot(day, slot.start);

                      if (slotEvents.length === 0) {
                        return (
                          <div
                            key={day}
                            className="p-1 border-r border-slate-800/60 last:border-r-0 flex items-center justify-center opacity-30 hover:opacity-80 transition"
                          >
                            <span className="text-[10px] text-slate-400 font-mono">-</span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={day}
                          className="p-1.5 border-r border-slate-800/60 last:border-r-0 flex flex-col gap-1.5 justify-center"
                        >
                          {slotEvents.map((evt) => {
                            const isExam = evt.isExam;
                            const isPratik = evt.type === 'U';
                            const isSelf = evt.isSelfStudy;

                            return (
                              <button
                                key={evt.id}
                                onClick={() => setSelectedEventModal(evt)}
                                className={`w-full text-left p-2 rounded-lg border transition-all duration-150 hover:scale-[1.02] shadow-sm relative overflow-hidden group ${
                                  isExam
                                    ? 'bg-rose-950/40 border-rose-500/50 hover:border-rose-400 text-rose-200'
                                    : isPratik
                                    ? 'bg-emerald-950/30 border-emerald-500/40 hover:border-emerald-400 text-emerald-100'
                                    : isSelf
                                    ? 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                                    : 'bg-slate-900/90 border-slate-700/80 hover:border-indigo-500 text-slate-100'
                                }`}
                              >
                                {/* Sol Anabilim Dalı Renk Şeridi */}
                                <div 
                                  className="absolute left-0 top-0 bottom-0 w-1"
                                  style={{ backgroundColor: isExam ? '#f43f5e' : isPratik ? '#10b981' : '#6366f1' }}
                                />

                                <div className="pl-1.5 space-y-1">
                                  {/* Rozetler */}
                                  <div className="flex items-center justify-between gap-1 flex-wrap">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                      isExam 
                                        ? 'bg-rose-500/30 text-rose-300' 
                                        : isPratik 
                                        ? 'bg-emerald-500/30 text-emerald-300' 
                                        : 'bg-indigo-500/30 text-indigo-300'
                                    }`}>
                                      {isExam ? 'SINAV' : isPratik ? 'Pratik' : 'Teorik'}
                                    </span>

                                    {evt.group && evt.group !== 'TÜM' && (
                                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300">
                                        {evt.group}
                                      </span>
                                    )}
                                  </div>

                                  {/* Ders Başlığı */}
                                  <div className="text-[11px] font-medium leading-tight line-clamp-2 text-white group-hover:text-indigo-200 transition-colors">
                                    {evt.title}
                                  </div>

                                  {/* Hoca Bilgisi */}
                                  {evt.instructor && (
                                    <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                                      <User size={10} className="text-slate-400 flex-shrink-0" />
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
                  className={`flex-1 min-w-[100px] p-3 rounded-xl border transition-all text-center space-y-1 ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-950/50'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  <div className="text-xs font-bold">{day}</div>
                  <div className="text-[11px] opacity-90">{formattedDate || '-'}</div>
                  <div className={`text-[10px] font-semibold inline-block px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {count} Ders Saati
                  </div>
                </button>
              );
            })}
          </div>

          {/* Günlük Zaman Çizelgesi Akışı */}
          <div className="relative pl-6 sm:pl-8 space-y-4 pt-2">
            {/* Dikey Çizgi (Timeline Rail) */}
            <div className="timeline-rail" />

            {dailyEvents.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2 bg-slate-900/40 rounded-xl border border-slate-800 p-6">
                <BookOpen size={36} className="mx-auto opacity-30 text-slate-400" />
                <p className="text-sm font-semibold text-slate-300">{activeDayName} günü için ders bulunamadı</p>
                <p className="text-xs text-slate-400">Arama filtresini temizlemeyi veya başka bir güne geçmeyi deneyebilirsiniz.</p>
              </div>
            ) : (
              dailyEvents.map((event, idx) => {
                const isExam = event.isExam;
                const isPratik = event.type === 'U';
                const isSelf = event.isSelfStudy;

                return (
                  <div key={event.id || idx} className="relative group">
                    {/* Zaman Çizgisi Noktası (Dot) */}
                    <div className={`absolute -left-[29px] sm:-left-[37px] top-4 w-4 h-4 rounded-full border-2 border-slate-950 flex items-center justify-center transition-transform group-hover:scale-125 ${
                      isExam
                        ? 'bg-rose-500 ring-4 ring-rose-500/20'
                        : isPratik
                        ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                        : isSelf
                        ? 'bg-slate-600 ring-4 ring-slate-600/20'
                        : 'bg-indigo-500 ring-4 ring-indigo-500/20'
                    }`} />

                    {/* Ders Kartı */}
                    <button
                      onClick={() => setSelectedEventModal(event)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 glass-card hover:translate-x-1 ${
                        isExam
                          ? 'border-rose-500/40 bg-rose-950/25 hover:border-rose-400'
                          : isPratik
                          ? 'border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-400'
                          : isSelf
                          ? 'border-slate-800 bg-slate-900/60'
                          : 'hover:border-indigo-500/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                        {/* Rozetler */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                            isExam
                              ? 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
                              : isPratik
                              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                              : isSelf
                              ? 'bg-slate-800 border border-slate-700 text-slate-400'
                              : 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                          }`}>
                            {isExam ? 'SINAV' : isPratik ? 'Pratik (U)' : isSelf ? 'Çalışma' : 'Teorik (T)'}
                          </span>

                          {event.group && event.group !== 'TÜM' && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                              {event.group}
                            </span>
                          )}

                          <span className="text-xs text-slate-400 font-medium">
                            {extractDepartmentName(event.title)}
                          </span>
                        </div>

                        {/* Saat */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono font-bold bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800">
                          <Clock size={13} className="text-indigo-400" />
                          <span>{event.startTime} - {event.endTime}</span>
                        </div>
                      </div>

                      {/* Başlık */}
                      <h4 className="font-semibold text-sm sm:text-base text-white mb-2 leading-snug">
                        {event.title}
                      </h4>

                      {/* Hoca Bilgisi */}
                      {event.instructor && (
                        <div className="flex items-center gap-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                          <User size={13} className="text-indigo-400 flex-shrink-0" />
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
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Kurulun tüm günleri ve ders yoğunlukları:</span>
            <span className="text-indigo-400 font-medium">{kurulDaysOverview.length} Program Günü</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
                  className={`p-3.5 rounded-xl border transition-all text-left space-y-2 group hover:scale-[1.02] ${
                    item.hasExam
                      ? 'bg-rose-950/30 border-rose-500/40 hover:border-rose-400'
                      : 'bg-slate-900/80 border-slate-800 hover:border-indigo-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {item.day}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {formattedDate}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    {item.week}. Hafta
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-bold">{item.totalCount} Ders Saati</span>
                    {item.hasExam ? (
                      <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                        SINAV
                      </span>
                    ) : (
                      <span className="text-indigo-400 text-[10px]">
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
        <div className="space-y-5 max-h-[46rem] overflow-y-auto pr-1">
          {groupedAgendaEvents.length === 0 ? (
            <div className="py-20 text-center text-slate-400 space-y-3">
              <BookOpen size={40} className="mx-auto opacity-30 text-slate-400" />
              <p className="text-base font-semibold text-slate-300">Görüntülenecek ders bulunamadı</p>
            </div>
          ) : (
            groupedAgendaEvents.map((group, gIdx) => {
              const formattedDate = group.date
                ? new Date(group.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                : '';

              return (
                <div key={gIdx} className="space-y-3">
                  {/* Sticky Gün Başlığı */}
                  <div className="sticky top-0 z-10 py-2 px-3.5 rounded-xl bg-slate-900/95 border border-slate-800 backdrop-blur-md flex items-center justify-between shadow">
                    <div className="flex items-center gap-2 font-bold text-sm text-white">
                      <CalendarDays size={15} className="text-indigo-400" />
                      <span>{formattedDate || group.day}</span>
                      {group.day && formattedDate && (
                        <span className="text-xs font-normal text-slate-400">({group.day})</span>
                      )}
                    </div>
                    <div className="text-xs text-indigo-400 font-semibold">
                      {group.week ? `${group.week}. Hafta • ` : ''}{group.events.length} Ders Saati
                    </div>
                  </div>

                  {/* Günün Kartları */}
                  <div className="space-y-2 pl-2">
                    {group.events.map((event, idx) => {
                      const isExam = event.isExam;
                      const isPratik = event.type === 'U';
                      const isSelf = event.isSelfStudy;

                      return (
                        <button
                          key={event.id || idx}
                          onClick={() => setSelectedEventModal(event)}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 glass-card hover:translate-x-1 ${
                            isExam
                              ? 'border-rose-500/40 bg-rose-950/20 hover:border-rose-400'
                              : isPratik
                              ? 'border-emerald-500/30 hover:border-emerald-500/60'
                              : isSelf
                              ? 'border-slate-800 bg-slate-900/50'
                              : 'hover:border-indigo-500/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                isExam 
                                  ? 'bg-rose-500/20 text-rose-300' 
                                  : isPratik 
                                  ? 'bg-emerald-500/20 text-emerald-300' 
                                  : 'bg-indigo-500/20 text-indigo-300'
                              }`}>
                                {isExam ? 'SINAV' : isPratik ? 'Pratik' : 'Teorik'}
                              </span>

                              {event.group && event.group !== 'TÜM' && (
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[11px] font-bold">
                                  {event.group}
                                </span>
                              )}

                              <span className="text-xs text-slate-400">
                                {extractDepartmentName(event.title)}
                              </span>
                            </div>

                            <div className="font-mono text-xs font-semibold text-slate-300">
                              {event.startTime} - {event.endTime}
                            </div>
                          </div>

                          <div className="font-medium text-sm text-white mb-1.5">
                            {event.title}
                          </div>

                          {event.instructor && (
                            <div className="text-xs text-slate-400 flex items-center gap-1.5">
                              <User size={12} className="text-indigo-400" />
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

      {/* --- DERS DETAY MODALI (HERHANGİ BİR DERSE TIKLANDIĞINDA) --- */}
      {selectedEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl relative">
            
            {/* Modal Üst Başlık & Kapat */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                    selectedEventModal.isExam
                      ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                      : selectedEventModal.type === 'U'
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                  }`}>
                    {selectedEventModal.isExam
                      ? 'SINAV'
                      : selectedEventModal.type === 'U'
                      ? 'Pratik Ders (U)'
                      : 'Teorik Ders (T)'}
                  </span>

                  {selectedEventModal.group && selectedEventModal.group !== 'TÜM' && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                      Grup: {selectedEventModal.group}
                    </span>
                  )}
                </div>
                <div className="text-xs text-indigo-400 font-semibold">
                  {extractDepartmentName(selectedEventModal.title)}
                </div>
              </div>

              <button
                onClick={() => setSelectedEventModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tam Ders Adı */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ders / Konu:</label>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1 leading-snug">
                {selectedEventModal.title}
              </h3>
            </div>

            {/* Bilgi Izgarası */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Clock size={13} className="text-indigo-400" />
                  <span>Saat & Süre</span>
                </div>
                <div className="text-sm font-bold text-white font-mono">
                  {selectedEventModal.startTime} - {selectedEventModal.endTime}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <CalendarIcon size={13} className="text-indigo-400" />
                  <span>Tarih & Gün</span>
                </div>
                <div className="text-xs font-bold text-white">
                  {selectedEventModal.day}
                  {selectedEventModal.date && (
                    <span className="block text-[11px] font-mono text-slate-300">
                      {new Date(selectedEventModal.date).toLocaleDateString('tr-TR')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Öğretim Üyesi */}
            {selectedEventModal.instructor && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <User size={13} className="text-indigo-400" />
                  <span>Öğretim Üyesi / Görevli</span>
                </div>
                <div className="text-xs sm:text-sm font-medium text-slate-200">
                  {selectedEventModal.instructor}
                </div>
              </div>
            )}

            {/* Takvim Formatı Önizlemesi */}
            <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-xs text-indigo-200 space-y-1">
              <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                <Sparkles size={13} />
                <span>Google & Apple Takvim Başlığı:</span>
              </span>
              <p className="font-mono text-[11px] text-indigo-100 bg-slate-900/80 p-2 rounded-lg border border-slate-800 break-words">
                {selectedEventModal.title} {selectedEventModal.isExam ? '(SINAV)' : selectedEventModal.type === 'U' ? `(Pratik${selectedEventModal.group && selectedEventModal.group !== 'TÜM' ? ' - ' + selectedEventModal.group : ''})` : '(Teorik)'}
              </p>
            </div>

            <button
              onClick={() => setSelectedEventModal(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 rounded-xl transition text-xs"
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
