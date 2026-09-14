import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, Upload, Clock, BookOpen, User, 
  CheckCircle2, AlertTriangle, Search, Filter, HelpCircle, 
  GraduationCap, Sparkles, Layers, FileSpreadsheet, FileText, 
  Bell, ChevronRight, X, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { BAKIRCAY_KURULLAR_2026_2027 } from './data/kurullarData';
import { generateICS } from './utils/icsGenerator';
import { parsePDFSchedule } from './utils/pdfParser';

const ScheduleToCalendar = () => {
  // --- STATE (DURUM) YÖNETİMİ ---
  // Çalışma modu: 'preset' (Hazır 2026-2027 Kurulları) | 'pdf' (PDF Yükleme) | 'excel' (Klasik Excel)
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
  const [includeSelfStudy, setIncludeSelfStudy] = useState(false); // Bağımsız çalışma saati
  const [alarmMinutes, setAlarmMinutes] = useState(15); // 0, 15, 30, 60
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // 1. HAZIR KURUL MODU YÜKLEME
  useEffect(() => {
    if (activeMode === 'preset') {
      const preset = BAKIRCAY_KURULLAR_2026_2027.find(k => k.id === selectedPresetId);
      if (preset && preset.events) {
        setRawEvents(preset.events);
        setError('');
        setSuccessMessage(`"${preset.shortName}" yüklendi.`);
      }
    }
  }, [activeMode, selectedPresetId]);

  // 2. EXCEL AYRIŞTIRMA MANTIĞI (Mevcut Mantık Korundu & İyileştirildi)
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

      const timeMatch = timeSlot.match(/(\d{2}):(\d{2})\s*[-–]\s*(\d{2}):(\d{2})/);
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
          setSuccessMessage(`PDF dosyasından ${result.events.length} ders başarıyla çıkarıldı.`);
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
    filteredEvents.forEach(e => {
      if (e.isExam) sinav++;
      else if (e.type === 'U') pratik++;
      else if (e.type === 'T') teorik++;
    });
    return {
      total: filteredEvents.length,
      teorik,
      pratik,
      sinav
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

  // Mevcut kurulun haftaları
  const availableWeeks = useMemo(() => {
    const weeks = new Set();
    rawEvents.forEach(e => {
      if (e.week) weeks.add(e.week);
    });
    return Array.from(weeks).sort((a, b) => a - b);
  }, [rawEvents]);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-3 sm:p-6 lg:p-10 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* --- ÜST BAŞLIK & REHBER BUTONU --- */}
        <header className="relative flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-800/80 pb-8">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs sm:text-sm font-medium">
              <GraduationCap size={16} className="text-indigo-400" />
              <span>İzmir Bakırçay Üniversitesi • Tıp Fakültesi (2026-2027)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white flex items-center justify-center md:justify-start gap-3">
              <span>Ders Programı</span>
              <span className="text-indigo-400 font-light">→</span>
              <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">Akıllı Takvim (.ics)</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
              Fakülte ders programlarını saniyeler içinde Apple Calendar, Google Calendar ve Outlook uyumlu takvime dönüştürün.
            </p>
          </div>

          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-slate-300 hover:text-white text-sm font-medium transition shadow-sm hover:border-slate-600"
          >
            <HelpCircle size={18} className="text-indigo-400" />
            <span>Takvime Nasıl Eklenir?</span>
          </button>
        </header>

        {/* --- MOD SEÇİM SEKMELERİ (3 MOD) --- */}
        <nav aria-label="Program Kaynağı Seçimi" className="flex flex-wrap gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800/80 max-w-2xl mx-auto shadow-inner">
          <button
            onClick={() => { setActiveMode('preset'); setError(''); }}
            className={`flex-1 min-w-[170px] flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold tab-transition ${
              activeMode === 'preset'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sparkles size={16} className={activeMode === 'preset' ? 'text-white' : 'text-indigo-400'} />
            <span>2026-2027 Kurulları</span>
            <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-indigo-500/30 text-indigo-200">Hazır</span>
          </button>

          <button
            onClick={() => { setActiveMode('pdf'); setError(''); }}
            className={`flex-1 min-w-[150px] flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold tab-transition ${
              activeMode === 'pdf'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText size={16} className={activeMode === 'pdf' ? 'text-white' : 'text-indigo-400'} />
            <span>PDF Yükle</span>
            <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-indigo-500/30 text-indigo-200">Yeni</span>
          </button>

          <button
            onClick={() => { setActiveMode('excel'); setError(''); }}
            className={`flex-1 min-w-[150px] flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold tab-transition ${
              activeMode === 'excel'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileSpreadsheet size={16} className={activeMode === 'excel' ? 'text-white' : 'text-indigo-400'} />
            <span>Excel (.xlsx)</span>
          </button>
        </nav>

        {/* --- ANA 2 SÜTUNLU YAPI --- */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* === SOL SÜTUN: KONTROL VE AYARLAR (5 KOLON) === */}
          <div className="lg:col-span-5 space-y-6">

            {/* ADIM 1: PROGRAM / DOSYA SEÇİMİ */}
            <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold">1</div>
                  <span>{activeMode === 'preset' ? 'Kurul Seçimi' : activeMode === 'pdf' ? 'PDF Programı Seç' : 'Excel Dosyası Seç'}</span>
                </h2>
                {activeMode === 'preset' && (
                  <span className="text-xs text-indigo-300 font-medium bg-indigo-950/70 border border-indigo-800/60 px-2.5 py-1 rounded-full">
                    Dönem 2 (4 Kurul)
                  </span>
                )}
              </div>

              {/* MOD 1: HAZIR KURULLAR */}
              {activeMode === 'preset' && (
                <div className="space-y-2.5">
                  {BAKIRCAY_KURULLAR_2026_2027.map(kurul => {
                    const isSelected = selectedPresetId === kurul.id;
                    return (
                      <button
                        key={kurul.id}
                        onClick={() => setSelectedPresetId(kurul.id)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-950/50 text-white'
                            : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="font-semibold text-sm sm:text-base flex items-center gap-2">
                            <span>{kurul.shortName}</span>
                            {isSelected && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                            <span>📅 {kurul.startDate} – {kurul.endDate}</span>
                            <span>•</span>
                            <span>{kurul.totalWeeks} Hafta ({kurul.eventCount} Etkinlik)</span>
                          </div>
                        </div>
                        <ChevronRight size={18} className={isSelected ? 'text-indigo-400' : 'text-slate-600'} />
                      </button>
                    );
                  })}

                  {currentPresetMeta && (
                    <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                        <Info size={14} className="text-indigo-400" />
                        <span>Resmi Fakülte Bilgisi:</span>
                      </div>
                      <p>{currentPresetMeta.name}</p>
                      <p className="text-[11px] text-slate-400">Başlama: {currentPresetMeta.startDate} • Bitiş: {currentPresetMeta.endDate}</p>
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
                      className="w-full text-center cursor-pointer bg-slate-800/60 text-slate-300 border-2 border-dashed border-slate-700 rounded-xl p-5 hover:bg-slate-800 hover:border-indigo-500 transition-all flex flex-col items-center justify-center gap-2"
                    >
                      <Upload size={28} className="text-indigo-400" />
                      <span className="font-medium text-sm">
                        {uploadedFile ? `✅ ${uploadedFile.name}` : activeMode === 'pdf' ? 'Ders programı PDF dosyasını seçin' : 'Excel (.xlsx) dosyasını seçin'}
                      </span>
                      <span className="text-xs text-slate-400">Tıklayın veya dosyayı buraya bırakın</span>
                    </label>

                    <button
                      onClick={processUploadedFile}
                      disabled={loading || !uploadedFile}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-b-white"></div>
                      ) : (
                        <BookOpen size={18} />
                      )}
                      <span>{loading ? 'Ayrıştırılıyor...' : 'Programı Ayrıştır ve Yükle'}</span>
                    </button>
                  </div>

                  {/* Excel Sayfa Seçimi */}
                  {activeMode === 'excel' && excelSheets.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-slate-800">
                      <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Kurul / Sayfa Seçimi:</label>
                      <div className="flex flex-wrap gap-2">
                        {excelSheets.map(sheet => (
                          <button
                            key={sheet}
                            onClick={() => setActiveExcelSheet(sheet)}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                              activeExcelSheet === sheet
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
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
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {successMessage && !error && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}
            </div>

            {/* ADIM 2: TIP FAKÜLTESİ AKILLI FİLTRELERİ */}
            <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold">2</div>
                <span>Akıllı Takvim Filtreleri</span>
              </h2>

              <div className="space-y-4">
                {/* Grup Seçimi (G1 / G2 / Tümü) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                      <Layers size={14} className="text-indigo-400" />
                      <span>Pratik / Laboratuvar Grubu</span>
                    </label>
                    <span className="text-[11px] text-slate-400">Çakışmaları önler</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setSelectedGroup('all')}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                        selectedGroup === 'all'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Tüm Sınıf
                    </button>
                    <button
                      onClick={() => setSelectedGroup('G1')}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                        selectedGroup === 'G1'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Sadece G1
                    </button>
                    <button
                      onClick={() => setSelectedGroup('G2')}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                        selectedGroup === 'G2'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Sadece G2
                    </button>
                  </div>
                </div>

                {/* Bağımsız Çalışma Saati Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-slate-200">Bağımsız Çalışma Saatleri</div>
                    <div className="text-xs text-slate-400">Takvimde boş çalışma saatlerini göster</div>
                  </div>
                  <button
                    onClick={() => setIncludeSelfStudy(!includeSelfStudy)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      includeSelfStudy ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        includeSelfStudy ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Hatırlatıcı / Alarm Süresi */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                    <Bell size={14} className="text-indigo-400" />
                    <span>Ders Başlama Hatırlatıcısı</span>
                  </label>
                  <select
                    value={alarmMinutes}
                    onChange={(e) => setAlarmMinutes(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
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
            <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">3</div>
                <span>Takvimi İndir (.ics)</span>
              </h2>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Hazırlanan Program:</span>
                  <span className="font-semibold text-slate-200 truncate max-w-[200px]">{currentKurulName}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Aktarılacak Ders Sayısı:</span>
                  <span className="font-bold text-emerald-400 text-sm">{filteredEvents.length} Ders</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Seçili Grup:</span>
                  <span className="font-medium text-slate-300">{selectedGroup === 'all' ? 'Tüm Sınıf' : selectedGroup}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Çalışma Saatleri:</span>
                  <span className="font-medium text-slate-300">{includeSelfStudy ? 'Dahil' : 'Hariç'}</span>
                </div>
              </div>

              <button
                onClick={handleDownloadICS}
                disabled={filteredEvents.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/50 hover:scale-[1.01]"
              >
                <Calendar size={20} />
                <span>Takvimi İndir (.ics)</span>
              </button>

              <p className="text-[11px] text-center text-slate-400">
                İndirdiğiniz .ics dosyasını iPhone, Mac, Google Calendar ve Outlook'a doğrudan aktarabilirsiniz.
              </p>
            </div>

          </div>

          {/* === SAĞ SÜTUN: PROGRAM ÖNİZLEMESİ (7 KOLON) === */}
          <div className="lg:col-span-7 space-y-4">
            <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800">
              
              {/* Üst Arama & Hafta Filtresi */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Ders adı, hoca veya konu ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Hafta Filtresi */}
                {availableWeeks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-400" />
                    <select
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="all">Tüm Haftalar</option>
                      {availableWeeks.map(w => (
                        <option key={w} value={w}>{w}. Hafta</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* İstatistik Şeridi */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                  <div className="text-xs text-slate-400">Toplam Ders</div>
                  <div className="text-lg font-bold text-white">{stats.total}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                  <div className="text-xs text-indigo-400">Teorik (T)</div>
                  <div className="text-lg font-bold text-indigo-300">{stats.teorik}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                  <div className="text-xs text-emerald-400">Pratik (U)</div>
                  <div className="text-lg font-bold text-emerald-300">{stats.pratik}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                  <div className="text-xs text-rose-400">Sınavlar</div>
                  <div className="text-lg font-bold text-rose-300">{stats.sinav}</div>
                </div>
              </div>

              {/* Ders Kartları Listesi */}
              <div className="space-y-3 max-h-[42rem] overflow-y-auto pr-1.5">
                {filteredEvents.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 space-y-3">
                    <BookOpen size={40} className="mx-auto opacity-30 text-slate-400" />
                    <p className="text-base font-semibold text-slate-300">Görüntülenecek ders bulunamadı</p>
                    <p className="text-xs max-w-sm mx-auto">
                      Arama filtrenizi temizlemeyi veya bağımsız çalışma saatlerini açmayı deneyebilirsiniz.
                    </p>
                  </div>
                ) : (
                  filteredEvents.map((event, idx) => {
                    const isTeorik = event.type === 'T';
                    const isPratik = event.type === 'U';
                    const isExam = event.isExam;
                    const isSelf = event.isSelfStudy;

                    return (
                      <div
                        key={event.id || idx}
                        className={`p-4 rounded-xl border transition-all duration-200 glass-card ${
                          isExam
                            ? 'border-rose-500/40 bg-rose-950/20 hover:border-rose-400'
                            : isPratik
                            ? 'border-emerald-500/20 hover:border-emerald-500/50'
                            : 'hover:border-indigo-500/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Tür Rozeti */}
                            {isExam ? (
                              <span className="px-2.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[11px] font-bold tracking-wide">
                                SINAV
                              </span>
                            ) : isPratik ? (
                              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                                Pratik (U)
                              </span>
                            ) : isTeorik ? (
                              <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold">
                                Teorik (T)
                              </span>
                            ) : isSelf ? (
                              <span className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-medium">
                                Çalışma
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-medium">
                                {event.type}
                              </span>
                            )}

                            {/* Grup Rozeti */}
                            {event.group && event.group !== 'TÜM' && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                                {event.group}
                              </span>
                            )}

                            {/* Hafta Rozeti */}
                            {event.week && (
                              <span className="text-[11px] text-slate-400">
                                {event.week}. Hafta
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-shrink-0">
                            <Clock size={13} className="text-indigo-400" />
                            <span className="font-mono font-medium text-slate-300">{event.startTime} - {event.endTime}</span>
                          </div>
                        </div>

                        {/* Ders Başlığı */}
                        <h3 className="font-medium text-sm sm:text-base text-white leading-snug mb-2">
                          {event.title}
                        </h3>

                        {/* Alt Bilgiler: Hoca, Gün ve Tarih */}
                        <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                          <div className="flex items-center gap-2">
                            {event.instructor ? (
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <User size={13} className="text-indigo-400 flex-shrink-0" />
                                <span className="truncate max-w-[280px]">{event.instructor}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Öğretim üyesi belirtilmemiş</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                            <span>{event.day}</span>
                            {event.date && <span>• {new Date(event.date).toLocaleDateString('tr-TR')}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </main>

        {/* --- YARDIM & TAKVİME EKLEME MODALI --- */}
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Calendar size={22} className="text-indigo-400" />
                  <h3 className="text-lg font-bold text-white">Takvime Nasıl Aktarılır?</h3>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-sm text-slate-300">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>📱 iPhone & iPad (Apple Calendar)</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Safari üzerinden ".ics İndir" butonuna dokunun. Çıkan onay penceresinde "Takvime Ekle" veya "Tümünü Ekle" seçeneğini seçin. Tüm dersler alarmlarıyla birlikte takviminize işlenecektir.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>🌐 Google Calendar (Android & Web)</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Bilgisayarınızda veya telefon tarayıcınızda calendar.google.com adresine gidin. Ayarlar ⚙️ → "İçe ve Dışa Aktar" bölümünden indirdiğiniz .ics dosyasını yükleyin.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>💻 Mac & Windows Outlook</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    İndirilen .ics dosyasına çift tıklamanız yeterlidir. Takvim uygulamanız otomatik olarak açılacak ve etkinlikleri yeni veya mevcut takviminize ekleyecektir.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowHelpModal(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition"
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