import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, Upload, BookOpen, 
  CheckCircle2, AlertTriangle, HelpCircle, 
  Sparkles, Layers, FileSpreadsheet, FileText, 
  Bell, ChevronRight, X, Info, Trash2, RefreshCw, BarChart3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { BAKIRCAY_KURULLAR_2026_2027 } from './data/kurullarData';
import { generateICS, generateCancellationICS } from './utils/icsGenerator';
import { parsePDFSchedule } from './utils/pdfParser';
import ExamAnalyticsView from './components/ExamAnalyticsView';
import ModernCalendarView from './components/ModernCalendarView';

const ScheduleToCalendar = () => {
  // --- STATE (DURUM) YÖNETİMİ ---
  const [activeView, setActiveView] = useState('calendar'); // 'calendar' | 'analytics'
  const [activeMode, setActiveMode] = useState('preset');

  // Hazır Mod State'leri
  const [selectedPresetId, setSelectedPresetId] = useState('kurul_1');

  // Excel & PDF Yükleme State'leri
  const [uploadedFile, setUploadedFile] = useState(null);
  const [workbookData, setWorkbookData] = useState(null);
  const [excelSheets, setExcelSheets] = useState([]);
  const [activeExcelSheet, setActiveExcelSheet] = useState('');

  // Ham ve İşlenmiş Etkinlikler
  const [rawEvents, setRawEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Akıllı Filtreler
  const [selectedGroup, setSelectedGroup] = useState('all'); // 'all' | 'G1' | 'G2'
  const [includeSelfStudy, setIncludeSelfStudy] = useState(true); // Tüm dersler eksiksiz gelsin diye varsayılan: true
  const [alarmMinutes, setAlarmMinutes] = useState(15); // 0, 15, 30, 60
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);

  // 1. HAZIR KURUL MODU YÜKLEME
  useEffect(() => {
    if (activeMode === 'preset') {
      const preset = BAKIRCAY_KURULLAR_2026_2027.find(k => k.id === selectedPresetId);
      if (preset && preset.events) {
        setRawEvents(preset.events);
        setError('');
        setSuccessMessage(`"${preset.shortName}" yüklendi (${preset.events.length} ders).`);
      }
    }
  }, [activeMode, selectedPresetId]);

  // 2. EXCEL AYRIŞTIRMA MANTIĞI
  const parseExcelSchedule = useCallback((data, sheetName) => {
    const events = [];
    let headerRowIndex = -1;

    for (let i = 0; i < data.length; i++) {
      const row = data[i] || [];
      const rowStr = row.join(' ').toLowerCase();
      if (rowStr.includes('gün') && rowStr.includes('saat') && rowStr.includes('konu')) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      setError('Excel formatı uyumsuz: "GÜN", "SAAT", "KONU" başlıkları bulunamadı.');
      setRawEvents([]);
      return;
    }

    const headers = data[headerRowIndex].map(h => h ? h.toString().trim().toUpperCase() : '');
    const dateColumnIndex = headers.indexOf('GÜN');
    const timeColumnIndex = headers.indexOf('SAAT');
    const topicColumnIndex = headers.indexOf('KONU');
    const instructorColumnIndex = headers.indexOf('ÖĞRETİM ÜYESİ');

    if (dateColumnIndex === -1 || timeColumnIndex === -1 || topicColumnIndex === -1) {
      setError('Excel formatı uyumsuz: Gerekli sütunlar (GÜN, SAAT, KONU) bulunamadı.');
      setRawEvents([]);
      return;
    }

    let currentDate = null;

    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const cellDateValue = row[dateColumnIndex];
      if (cellDateValue) {
        if (typeof cellDateValue === 'number') {
          const excelEpoch = new Date(1899, 11, 30);
          currentDate = new Date(excelEpoch.getTime() + cellDateValue * 86400000);
        } else {
          const dateParts = cellDateValue.toString().split(/[./]/);
          if (dateParts.length === 3) {
            currentDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
          }
        }
      }

      if (!currentDate || isNaN(currentDate.getTime())) continue;

      const timeSlot = row[timeColumnIndex]?.toString() || '';
      const topic = row[topicColumnIndex]?.toString().trim() || '';

      if (!timeSlot || !topic || topic.toUpperCase().includes('ÖĞLE ARASI')) continue;

      const timeMatch = timeSlot.match(/(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/);
      if (!timeMatch) continue;

      const [, startHour, startMinute, endHour, endMinute] = timeMatch;
      const dayOfWeek = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][currentDate.getDay()];
      const instructor = (instructorColumnIndex !== -1 && row[instructorColumnIndex]) ? row[instructorColumnIndex].toString().trim() : '';

      const isExam = /s[ıi]nav|vize|final|b[üu]t[üu]nleme/i.test(topic);
      const isSelfStudy = /ba[gğ][ıi]ms[ıi]z/i.test(topic);
      let group = 'TÜM';
      if (/\b(G1|Grup 1)\b/i.test(topic)) group = 'G1';
      else if (/\b(G2|Grup 2)\b/i.test(topic)) group = 'G2';

      events.push({
        id: `excel-${events.length + 1}`,
        title: topic,
        instructor: instructor,
        type: isExam ? 'Sınav' : isSelfStudy ? 'Çalışma' : (topic.toLowerCase().includes('uygulama') ? 'U' : 'T'),
        day: dayOfWeek,
        date: currentDate.toISOString().split('T')[0],
        startTime: `${startHour}:${startMinute}`,
        endTime: `${endHour}:${endMinute}`,
        group,
        isExam,
        isSelfStudy
      });
    }

    setRawEvents(events);
    if (events.length === 0) {
      setError(`"${sheetName}" için ders bulunamadı veya format uyumsuz.`);
    } else {
      setSuccessMessage(`"${sheetName}" sayfasından ${events.length} ders başarıyla ayrıştırıldı.`);
    }
  }, []);

  // EXCEL SAYFASI DEĞİŞTİĞİNDE
  useEffect(() => {
    if (activeMode === 'excel' && activeExcelSheet && workbookData) {
      setError('');
      const worksheet = workbookData.Sheets[activeExcelSheet];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      parseExcelSchedule(jsonData, activeExcelSheet);
    }
  }, [activeMode, activeExcelSheet, workbookData, parseExcelSchedule]);

  // DOSYA SEÇİMİ
  const handleFileSelect = (event) => {
    const selected = event.target.files[0];
    if (!selected) return;

    if (activeMode === 'excel' && !selected.name.endsWith('.xlsx')) {
      alert('Lütfen .xlsx uzantılı bir Excel dosyası seçin.');
      return;
    }
    if (activeMode === 'pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      alert('Lütfen .pdf uzantılı bir ders programı dosyası seçin.');
      return;
    }

    setUploadedFile(selected);
    setRawEvents([]);
    setError('');
    setSuccessMessage('');
  };

  // DOSYA İŞLEME BUTONU
  const processUploadedFile = async () => {
    if (!uploadedFile) return;
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      if (activeMode === 'excel') {
        const fileData = await uploadedFile.arrayBuffer();
        const workbook = XLSX.read(fileData, { type: 'array' });
        const sheetNames = workbook.SheetNames;

        if (!sheetNames || sheetNames.length === 0) {
          setError("Excel dosyasında hiç sayfa bulunamadı.");
          setLoading(false);
          return;
        }

        setWorkbookData(workbook);
        setExcelSheets(sheetNames);
        setActiveExcelSheet(sheetNames[0]);
      } else if (activeMode === 'pdf') {
        const result = await parsePDFSchedule(uploadedFile);
        if (!result.events || result.events.length === 0) {
          setError("PDF dosyasından ders programı ayrıştırılamadı. Dosyanın üniversitenin resmi formatında olduğundan emin olun.");
        } else {
          setRawEvents(result.events);
          setSuccessMessage(`PDF dosyasından ${result.events.length} ders eksiksiz çıkarıldı.`);
        }
      }
    } catch (err) {
      console.error('Dosya okuma hatası:', err);
      setError('Dosya işlenirken bir hata oluştu: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setLoading(false);
    }
  };

  // --- AKILLI FİLTRELEME ---
  const filteredEvents = useMemo(() => {
    return rawEvents.filter(event => {
      // 1. Bağımsız çalışma saati filtresi
      if (!includeSelfStudy && event.isSelfStudy) {
        return false;
      }

      // 2. Grup filtresi (G1 / G2)
      if (selectedGroup !== 'all') {
        if (selectedGroup === 'G1' && event.group === 'G2') return false;
        if (selectedGroup === 'G2' && event.group === 'G1') return false;
      }

      // 3. Hafta filtresi
      if (selectedWeek !== 'all' && event.week && event.week !== Number(selectedWeek)) {
        return false;
      }

      // 4. Arama filtresi
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const inTitle = (event.title || '').toLowerCase().includes(q);
        const inInstructor = (event.instructor || '').toLowerCase().includes(q);
        const inDay = (event.day || '').toLowerCase().includes(q);
        if (!inTitle && !inInstructor && !inDay) return false;
      }

      return true;
    });
  }, [rawEvents, includeSelfStudy, selectedGroup, selectedWeek, searchTerm]);

  // İstatistikler
  const stats = useMemo(() => {
    let teorik = 0;
    let pratik = 0;
    let sinav = 0;
    let calisma = 0;
    filteredEvents.forEach(e => {
      if (e.isExam) sinav++;
      else if (e.isSelfStudy) calisma++;
      else if (e.type === 'U') pratik++;
      else if (e.type === 'T') teorik++;
    });
    return {
      total: filteredEvents.length,
      teorik,
      pratik,
      sinav,
      calisma
    };
  }, [filteredEvents]);

  // Mevcut kurul adı
  const currentKurulName = useMemo(() => {
    if (activeMode === 'preset') {
      const p = BAKIRCAY_KURULLAR_2026_2027.find(k => k.id === selectedPresetId);
      return p ? p.shortName : 'Kurul Programı';
    }
    if (activeMode === 'pdf') {
      return uploadedFile ? uploadedFile.name.replace('.pdf', '') : 'PDF Programı';
    }
    return activeExcelSheet || 'Excel Programı';
  }, [activeMode, selectedPresetId, uploadedFile, activeExcelSheet]);

  // Mevcut kurul detay metadatası
  const currentPresetMeta = useMemo(() => {
    if (activeMode !== 'preset') return null;
    return BAKIRCAY_KURULLAR_2026_2027.find(k => k.id === selectedPresetId) || null;
  }, [activeMode, selectedPresetId]);

  // TAKVİM (.ICS) İNDİRME
  const handleDownloadICS = () => {
    if (filteredEvents.length === 0) {
      alert('İndirilecek etkinlik bulunamadı. Lütfen filtrelerinizi kontrol edin.');
      return;
    }
    generateICS({
      events: filteredEvents,
      kurulName: currentKurulName,
      alarmMinutes: Number(alarmMinutes)
    });
  };

  // ESKİ GOOGLE TAKVİM ETKİNLİKLERİNİ İPTAL ETME (.ICS)
  const handleDownloadCancellationICS = () => {
    if (rawEvents.length === 0) {
      alert('İptal edilecek etkinlik bulunamadı.');
      return;
    }
    generateCancellationICS({
      events: rawEvents,
      kurulName: currentKurulName
    });
  };

  // Mevcut kurulun haftaları
  const availableWeeks = useMemo(() => {
    const weeks = new Set();
    rawEvents.forEach(e => {
      if (e.week) weeks.add(e.week);
    });
    return Array.from(weeks).sort((a, b) => a - b);
  }, [rawEvents]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-3 sm:p-6 lg:p-10 font-sans selection:bg-amber-400 selection:text-zinc-950">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* --- ÜST BAŞLIK & REHBER BUTONU --- */}
        <header className="relative flex flex-col md:flex-row items-center justify-between gap-6 border-b border-zinc-800/80 pb-6">
          <div className="space-y-2.5 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="font-bold text-zinc-100 tracking-wide">İzmir Bakırçay Üniversitesi</span>
              <span className="text-zinc-600 font-light">•</span>
              <span className="text-zinc-300 font-medium">Tıp Fakültesi</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 border border-zinc-700 font-semibold">
                Dönem 2 / 2026–2027
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center justify-center md:justify-start gap-2.5">
              <span>Ders Programı</span>
              <span className="text-zinc-600 font-light">/</span>
              <span className="text-amber-400">Eksiksiz Takvim (.ics)</span>
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-2xl">
              10:15, 13:30 ve 16:30 dahil tüm ders saatleri, sınavlar ve pratikler %100 eksiksiz aktarılır.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition"
            >
              <HelpCircle size={15} className="text-amber-400" />
              <span>Takvime Nasıl Eklenir?</span>
            </button>
          </div>
        </header>

        {/* --- ANA BÖLÜM / GÖRÜNÜM SEÇİMİ (TAKVİM & SINAV ANALİZİ) --- */}
        <div className="flex items-center justify-center">
          <div className="inline-flex p-1 bg-zinc-900 rounded-xl border border-zinc-800 max-w-md w-full">
            <button
              onClick={() => setActiveView('calendar')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                activeView === 'calendar'
                  ? 'bg-amber-400 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Calendar size={15} />
              <span>Program & Takvim</span>
            </button>
            <button
              onClick={() => setActiveView('analytics')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                activeView === 'analytics'
                  ? 'bg-amber-400 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BarChart3 size={15} />
              <span>Sınav & Ders Oran Analizi</span>
            </button>
          </div>
        </div>

        {/* --- MOD SEÇİM SEKMELERİ (3 MOD) --- */}
        <nav aria-label="Program Kaynağı Seçimi" className="flex flex-wrap gap-2 p-1 bg-zinc-900 rounded-xl border border-zinc-800 max-w-2xl mx-auto">
          <button
            onClick={() => { setActiveMode('preset'); setError(''); }}
            className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-lg text-xs sm:text-sm font-semibold tab-transition ${
              activeMode === 'preset'
                ? 'bg-zinc-800 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <Sparkles size={15} className={activeMode === 'preset' ? 'text-amber-400' : 'text-zinc-500'} />
            <span>2026-2027 Kurulları</span>
            <span className="px-1.5 py-0.2 text-[10px] font-mono uppercase font-bold rounded bg-zinc-700/80 text-zinc-300">Tam</span>
          </button>

          <button
            onClick={() => { setActiveMode('pdf'); setError(''); }}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-lg text-xs sm:text-sm font-semibold tab-transition ${
              activeMode === 'pdf'
                ? 'bg-zinc-800 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <FileText size={15} className={activeMode === 'pdf' ? 'text-amber-400' : 'text-zinc-500'} />
            <span>PDF Yükle</span>
            <span className="px-1.5 py-0.2 text-[10px] font-mono uppercase font-bold rounded bg-zinc-700/80 text-zinc-300">Yeni</span>
          </button>

          <button
            onClick={() => { setActiveMode('excel'); setError(''); }}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-lg text-xs sm:text-sm font-semibold tab-transition ${
              activeMode === 'excel'
                ? 'bg-zinc-800 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <FileSpreadsheet size={15} className={activeMode === 'excel' ? 'text-amber-400' : 'text-zinc-500'} />
            <span>Excel (.xlsx)</span>
          </button>
        </nav>

        {/* --- KURUL HIZLI SEÇİMİ (ANALİTİK MODUNDA DA ERİŞİLEBİLİR) --- */}
        {activeView === 'analytics' && activeMode === 'preset' && (
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto p-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
            {BAKIRCAY_KURULLAR_2026_2027.map(k => (
              <button
                key={k.id}
                onClick={() => setSelectedPresetId(k.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                  selectedPresetId === k.id
                    ? 'bg-amber-400 text-zinc-950 border-amber-400 font-bold shadow-sm'
                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/80 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {k.shortName}
              </button>
            ))}
          </div>
        )}

        {/* --- GÖRÜNÜM İÇERİĞİ: TAKVİM VEYA SINAV ANALİZİ --- */}
        {activeView === 'calendar' ? (
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* === SOL SÜTUN: KONTROL VE AYARLAR (5 KOLON) === */}
          <div className="lg:col-span-5 space-y-5">

            {/* ADIM 1: PROGRAM / DOSYA SEÇİMİ */}
            <div className="glass-panel rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-zinc-800 text-amber-400 border border-zinc-700 flex items-center justify-center text-xs font-bold">1</div>
                  <span>{activeMode === 'preset' ? 'Kurul Seçimi' : activeMode === 'pdf' ? 'PDF Programı Seç' : 'Excel Dosyası Seç'}</span>
                </h2>
                {activeMode === 'preset' && (
                  <span className="text-xs text-zinc-300 font-medium bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-md font-mono">
                    Dönem 2
                  </span>
                )}
              </div>

              {/* MOD 1: HAZIR KURULLAR */}
              {activeMode === 'preset' && (
                <div className="space-y-2">
                  {BAKIRCAY_KURULLAR_2026_2027.map(kurul => {
                    const isSelected = selectedPresetId === kurul.id;
                    return (
                      <button
                        key={kurul.id}
                        onClick={() => setSelectedPresetId(kurul.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-zinc-900 border-amber-500/60 shadow-sm text-white'
                            : 'bg-zinc-900/40 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60 hover:border-zinc-700'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-xs sm:text-sm flex items-center gap-2">
                            <span>{kurul.shortName}</span>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
                          </div>
                          <div className="text-[11px] text-zinc-400 flex items-center gap-2 flex-wrap">
                            <span>📅 {kurul.startDate} – {kurul.endDate}</span>
                            <span>•</span>
                            <span className="text-amber-400 font-mono font-medium">{kurul.eventCount} Ders</span>
                          </div>
                        </div>
                        <ChevronRight size={16} className={isSelected ? 'text-amber-400' : 'text-zinc-600'} />
                      </button>
                    );
                  })}

                  {currentPresetMeta && (
                    <div className="mt-3 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1">
                      <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                        <Info size={13} className="text-amber-400" />
                        <span>Resmi Fakülte Programı:</span>
                      </div>
                      <p className="text-zinc-200">{currentPresetMeta.name}</p>
                      <p className="text-[11px] text-zinc-500 font-mono">Tarih: {currentPresetMeta.startDate} – {currentPresetMeta.endDate}</p>
                    </div>
                  )}
                </div>
              )}

              {/* MOD 2 & MOD 3: DOSYA YÜKLEME */}
              {(activeMode === 'pdf' || activeMode === 'excel') && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3">
                    <input
                      type="file"
                      accept={activeMode === 'pdf' ? '.pdf' : '.xlsx'}
                      onChange={handleFileSelect}
                      id="schedule-upload"
                      className="hidden"
                    />
                    <label
                      htmlFor="schedule-upload"
                      className="w-full text-center cursor-pointer bg-zinc-900/40 text-zinc-300 border border-dashed border-zinc-800 rounded-xl p-5 hover:bg-zinc-800/60 hover:border-amber-500/50 transition-all flex flex-col items-center justify-center gap-2"
                    >
                      <Upload size={24} className="text-amber-400" />
                      <span className="font-medium text-xs sm:text-sm">
                        {uploadedFile ? `✅ ${uploadedFile.name}` : activeMode === 'pdf' ? 'Ders programı PDF dosyasını seçin' : 'Excel (.xlsx) dosyasını seçin'}
                      </span>
                      <span className="text-[11px] text-zinc-500">Tıklayın veya dosyayı buraya bırakın</span>
                    </label>

                    <button
                      onClick={processUploadedFile}
                      disabled={loading || !uploadedFile}
                      className="w-full bg-amber-400 hover:bg-amber-300 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-zinc-950/20 border-b-zinc-950"></div>
                      ) : (
                        <BookOpen size={16} />
                      )}
                      <span>{loading ? 'Ayrıştırılıyor...' : 'Programı Ayrıştır ve Yükle'}</span>
                    </button>
                  </div>

                  {/* Excel Sayfa Seçimi */}
                  {activeMode === 'excel' && excelSheets.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-zinc-800">
                      <label className="text-[11px] font-semibold uppercase text-zinc-400 tracking-wider">Kurul / Sayfa Seçimi:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {excelSheets.map(sheet => (
                          <button
                            key={sheet}
                            onClick={() => setActiveExcelSheet(sheet)}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all border ${
                              activeExcelSheet === sheet
                                ? 'bg-amber-400 text-zinc-950 border-amber-400 font-bold'
                                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-750'
                            }`}
                          >
                            {sheet}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hata & Başarı Bildirimleri */}
              {error && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle size={15} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {successMessage && !error && (
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-amber-400 flex-shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}
            </div>

            {/* ADIM 2: AKILLI FİLTRELER */}
            <div className="glass-panel rounded-xl p-5 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-zinc-800 text-amber-400 border border-zinc-700 flex items-center justify-center text-xs font-bold">2</div>
                <span>Akıllı Takvim Filtreleri</span>
              </h2>

              <div className="space-y-3.5">
                {/* Grup Seçimi (G1 / G2 / Tümü) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
                      <Layers size={13} className="text-amber-400" />
                      <span>Laboratuvar Grubu</span>
                    </label>
                    <span className="text-[11px] text-zinc-500">Çakışmayı önler</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => setSelectedGroup('all')}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        selectedGroup === 'all'
                          ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Tüm Sınıf
                    </button>
                    <button
                      onClick={() => setSelectedGroup('G1')}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        selectedGroup === 'G1'
                          ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Sadece G1
                    </button>
                    <button
                      onClick={() => setSelectedGroup('G2')}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        selectedGroup === 'G2'
                          ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Sadece G2
                    </button>
                  </div>
                </div>

                {/* Bağımsız Çalışma Saati Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-zinc-200">Bağımsız Çalışma Saatleri</div>
                    <div className="text-[11px] text-zinc-500">
                      {includeSelfStudy ? 'Çalışma saatleri takvime ekleniyor' : 'Sadece dersler ve sınavlar ekleniyor'}
                    </div>
                  </div>
                  <button
                    onClick={() => setIncludeSelfStudy(!includeSelfStudy)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                      includeSelfStudy ? 'bg-amber-400' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-zinc-950 transition-transform ${
                        includeSelfStudy ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Hatırlatıcı / Alarm Süresi */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
                    <Bell size={13} className="text-amber-400" />
                    <span>Ders Başlama Hatırlatıcısı</span>
                  </label>
                  <select
                    value={alarmMinutes}
                    onChange={(e) => setAlarmMinutes(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400 transition"
                  >
                    <option value={15}>Ders başlamadan 15 dakika önce</option>
                    <option value={30}>Ders başlamadan 30 dakika önce</option>
                    <option value={60}>Ders başlamadan 1 saat önce</option>
                    <option value={0}>Hatırlatıcı olmasın (Sessiz)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ADIM 3: TAKVİMİ İNDİR */}
            <div className="glass-panel rounded-xl p-5 space-y-3.5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-zinc-800 text-amber-400 border border-zinc-700 flex items-center justify-center text-xs font-bold">3</div>
                <span>Eksiksiz Takvimi İndir (.ics)</span>
              </h2>

              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Program:</span>
                  <span className="font-semibold text-zinc-200 truncate max-w-[200px]">{currentKurulName}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Aktarılacak Ders:</span>
                  <span className="font-bold text-amber-400 font-mono">{filteredEvents.length} Ders Saati</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Seçili Grup:</span>
                  <span className="font-medium text-zinc-300">{selectedGroup === 'all' ? 'Tüm Sınıf' : selectedGroup}</span>
                </div>
              </div>

              <button
                onClick={handleDownloadICS}
                disabled={filteredEvents.length === 0}
                className="w-full bg-amber-400 hover:bg-amber-300 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 font-black py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm text-sm"
              >
                <Calendar size={18} />
                <span>Eksiksiz Takvimi İndir (.ics)</span>
              </button>

              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                <button
                  onClick={() => setShowCleanupModal(true)}
                  className="text-xs text-zinc-400 hover:text-amber-400 flex items-center gap-1.5 transition underline decoration-dotted"
                >
                  <Trash2 size={13} />
                  <span>Google Takvime daha önce ekledim, nasıl temizlerim?</span>
                </button>
              </div>
            </div>

          </div>

          {/* === SAĞ SÜTUN: ETKİLEŞİMLİ MODERN TAKVİM GÖRÜNÜMÜ (7 KOLON) === */}
          <div className="lg:col-span-7 space-y-4">
            <ModernCalendarView
              events={filteredEvents}
              allWeeks={availableWeeks}
              selectedWeek={selectedWeek}
              onSelectWeek={setSelectedWeek}
              kurulName={currentKurulName}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedGroup={selectedGroup}
              includeSelfStudy={includeSelfStudy}
              onDownloadICS={handleDownloadICS}
              stats={stats}
            />
          </div>

        </main>
        ) : (
          <ExamAnalyticsView events={rawEvents} kurulName={currentKurulName} />
        )}

        {/* --- GOOGLE TAKVİM TEMİZLEME REHBERİ MODALI --- */}
        {showCleanupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5 text-amber-400">
                  <Trash2 size={20} />
                  <h3 className="text-base sm:text-lg font-bold text-white">Google Takvim'den Eski/Eksik Dersleri Temizleme</h3>
                </div>
                <button
                  onClick={() => setShowCleanupModal(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs sm:text-sm text-zinc-300">
                <div className="p-3.5 rounded-lg bg-zinc-950 border border-emerald-500/30 space-y-2">
                  <div className="font-semibold text-emerald-400 flex items-center gap-2">
                    <span>🌟 1. YÖNTEM: Ayrı Bir Takvim Olarak Eklediyseniz (En Kolay Yol - 5 Saniye)</span>
                  </div>
                  <ol className="list-decimal list-inside text-xs text-zinc-300 space-y-1 pl-1">
                    <li>Bilgisayarınızda veya telefonunuzda <b>calendar.google.com</b> adresini açın.</li>
                    <li>Sol menüde <b>"Diğer Takvimler"</b> veya <b>"Takvimlerim"</b> altında eklediğiniz takvimi bulun.</li>
                    <li>Üzerine gelip <b>üç noktaya (⋮)</b> tıklayın → <b>Ayarlar ve Paylaşım</b> seçeneğini seçin.</li>
                    <li>En alta kaydırıp <b>"Takvimi Sil"</b> butonuna basın. Tüm eski dersler anında silinir!</li>
                    <li>Ardından ana sayfadaki sarı <b>"Eksiksiz Takvimi İndir (.ics)"</b> butonuna basıp yeni dosyayı yükleyin.</li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2.5">
                  <div className="font-semibold text-amber-400 flex items-center gap-2">
                    <span>🔄 2. YÖNTEM: Otomatik İptal / Temizleme Dosyası Kullanma</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Aşağıdaki butona basarak özel hazırlanmış <b>İptal Takvimi (.ics)</b> dosyasını indirin. Bu dosyayı Google Takvim'e aktardığınızda, aynı ID'ye sahip eski etkinlikleri otomatik olarak iptal edecektir:
                  </p>
                  <button
                    onClick={handleDownloadCancellationICS}
                    className="w-full py-2.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 font-bold text-xs transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} />
                    <span>Eski Eklenenleri İptal Etme Dosyasını İndir (.ics)</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>🔍 3. YÖNTEM: Ana Takviminizden Arama ile Toplu Silme</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    calendar.google.com üst arama kutusuna <b>"İzmir Bakırçay Üniversitesi"</b> veya <b>"Kurul I"</b> yazıp Enter'a basın. Çıkan etkinlikleri seçip Çöp Kutusu simgesiyle silebilirsiniz.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  onClick={handleDownloadICS}
                  className="w-full sm:flex-1 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold py-2.5 px-4 rounded-lg transition flex items-center justify-center gap-2 text-xs"
                >
                  <Calendar size={15} />
                  <span>Yeni Eksiksiz Takvimi İndir (.ics)</span>
                </button>
                <button
                  onClick={() => setShowCleanupModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- YARDIM & TAKVİME EKLEME MODALI --- */}
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-amber-400" />
                  <h3 className="text-base font-bold text-white">Takvime Nasıl Aktarılır?</h3>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-zinc-300">
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <span>📱 iPhone & iPad (Apple Calendar)</span>
                  </div>
                  <p className="text-zinc-400">
                    Safari üzerinden ".ics İndir" butonuna dokunun. Çıkan onay penceresinde "Takvime Ekle" veya "Tümünü Ekle" seçeneğini seçin. Tüm dersler alarmlarıyla birlikte takviminize işlenecektir.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <span>🌐 Google Calendar (Android & Web)</span>
                  </div>
                  <p className="text-zinc-400">
                    calendar.google.com adresinde Ayarlar ⚙️ → "İçe ve Dışa Aktar" bölümünden indirdiğiniz .ics dosyasını yükleyin. (İpucu: Sol menüden '+' ile yeni bir "Bakırçay Tıp" takvimi açıp ona yüklerseniz, dilediğinizde tek tıkla gizleyebilir veya silebilirsiniz).
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <span>💻 Mac & Windows Outlook</span>
                  </div>
                  <p className="text-zinc-400">
                    İndirilen .ics dosyasına çift tıklamanız yeterlidir. Takvim uygulamanız otomatik olarak açılacak ve etkinlikleri yeni veya mevcut takviminize ekleyecektir.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowHelpModal(false)}
                className="w-full bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold py-2 rounded-lg transition text-xs"
              >
                Anladım, Kapat
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ScheduleToCalendar;