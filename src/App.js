import React, { useState, useCallback, useEffect } from 'react';
import { Calendar, Download, Upload, Clock, BookOpen, User, Moon, Sun, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

// --- ANA BİLEŞEN ---
const ScheduleToCalendar = () => {

  // --- STATE (DURUM) YÖNETİMİ ---
  // Uygulamanın anlık durumunu tutan değişkenler
  const [file, setFile] = useState(null); // Seçilen Excel dosyası
  const [workbookData, setWorkbookData] = useState(null); // Okunan Excel verisinin tamamı (tüm sayfalar)
  const [kurullar, setKurullar] = useState([]); // Excel dosyasındaki sayfa (kurul) isimleri
  const [activeKurul, setActiveKurul] = useState(''); // Şu an seçili olan kurulun adı
  const [parsedEvents, setParsedEvents] = useState([]); // Seçili kuruldan parse edilen ders etkinlikleri
  const [loading, setLoading] = useState(false); // Dosya işlenirken gösterilecek yükleme durumu
  const [error, setError] = useState(''); // Olası hataları kullanıcıya göstermek için
  const [isDarkMode, setIsDarkMode] = useState(false); // Arayüz temasını (aydınlık/karanlık) yönetir

  // --- TEMA YÖNETİMİ ---
  // Bu useEffect, bileşen ilk yüklendiğinde çalışır ve kullanıcının tema tercihini belirler.
  useEffect(() => {
    // 1. localStorage'da kayıtlı bir tema var mı diye kontrol et.
    const storedTheme = localStorage.getItem('theme');
    // 2. Eğer kayıt yoksa, işletim sisteminin tercihini kontrol et.
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
      setIsDarkMode(true);
    }
  }, []);

  // Bu useEffect, isDarkMode durumu her değiştiğinde çalışır.
  useEffect(() => {
    // Temayı <html> elementine bir class olarak ekler/kaldırır.
    // Tailwind'in `darkMode: 'class'` ayarı bu class'ı kullanarak temayı değiştirir.
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark'); // Tercihi gelecekteki ziyaretler için kaydet.
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);
  
  // --- TEMEL FONKSİYONLAR ---

  // EXCEL'İ AYRIŞTIRMA (PARSE) MANTIĞI
  const parseScheduleData = (data) => {
    // ... Bu fonksiyonun iç mantığı önceki versiyonla aynı kalmıştır,
    // sadece daha fazla yorum satırı eklenmiştir.
    const events = [];
    let headerRowIndex = -1;

    // Adım 1: Başlık satırını bul (GÜN, SAAT, KONU gibi anahtar kelimeleri içeren satır)
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
        setParsedEvents([]);
        return;
    }

    // Adım 2: Başlıkları kullanarak gerekli sütunların indeks numaralarını bul
    const headers = data[headerRowIndex].map(h => h ? h.toString().trim().toUpperCase() : '');
    const dateColumnIndex = headers.indexOf('GÜN');
    const timeColumnIndex = headers.indexOf('SAAT');
    const topicColumnIndex = headers.indexOf('KONU');
    const instructorColumnIndex = headers.indexOf('ÖĞRETİM ÜYESİ');

    if (dateColumnIndex === -1 || timeColumnIndex === -1 || topicColumnIndex === -1) {
        setError('Excel formatı uyumsuz: Gerekli sütunlar (GÜN, SAAT, KONU) bulunamadı.');
        setParsedEvents([]);
        return;
    }

    let currentDate = null;

    // Adım 3: Başlık satırından sonraki tüm satırları tek tek dolaşarak veriyi işle
    for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        // Birleştirilmiş "GÜN" hücrelerini yönetmek için: Eğer hücrede tarih varsa güncelle, yoksa bir öncekini kullan
        const cellDateValue = row[dateColumnIndex];
        if (cellDateValue) {
            if (typeof cellDateValue === 'number') { // Excel'in tarihleri sayı olarak saklaması durumu
                const excelEpoch = new Date(1899, 11, 30);
                currentDate = new Date(excelEpoch.getTime() + cellDateValue * 86400000);
            } else { // Metin olarak "gg/aa/yyyy" veya "gg.aa.yyyy" formatı
                const dateParts = cellDateValue.toString().split(/[\/.]/);
                if (dateParts.length === 3) {
                    currentDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
                }
            }
        }

        if (!currentDate || isNaN(currentDate.getTime())) continue; // Geçerli bir tarih yoksa bu satırı atla

        const timeSlot = row[timeColumnIndex]?.toString() || '';
        const topic = row[topicColumnIndex]?.toString().trim() || '';
        
        if (!timeSlot || !topic || topic.toUpperCase().includes('ÖĞLE ARASI')) continue;

        const timeMatch = timeSlot.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
        if (!timeMatch) continue;

        const [, startHour, startMinute, endHour, endMinute] = timeMatch;
        const dayOfWeek = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][currentDate.getDay()];
        const instructor = (instructorColumnIndex !== -1 && row[instructorColumnIndex]) ? row[instructorColumnIndex].toString().trim() : '';
        
        // Tüm bilgileri bir obje olarak events dizisine ekle
        events.push({
            title: topic,
            instructor: instructor,
            location: '',
            day: dayOfWeek,
            date: new Date(currentDate.getTime()),
            startTime: `${startHour}:${startMinute}`,
            endTime: `${endHour}:${endMinute}`,
            description: `${topic}${instructor ? '\n\nÖğretim Üyesi:\n' + instructor : ''}`
        });
    }
    setParsedEvents(events);
    if(events.length === 0) {
      setError(`"${activeKurul}" için ders bulunamadı veya bu sayfadaki format uyumsuz.`);
    }
  };
  
  // KULLANICI DOSYA SEÇTİĞİNDE
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.name.endsWith('.xlsx')) {
      setFile(selectedFile);
      // Yeni dosya seçildiğinde tüm eski verileri temizle
      setWorkbookData(null);
      setKurullar([]);
      setActiveKurul('');
      setParsedEvents([]);
      setError('');
    } else {
      alert('Lütfen .xlsx uzantılı bir Excel dosyası seçin.');
    }
  };

  // "İŞLE" BUTONUNA BASILDIĞINDA
  const processFile = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(''); // Yeni işlem öncesi eski hataları temizle
    try {
      const fileData = await file.arrayBuffer();
      const workbook = XLSX.read(fileData, { type: 'array' });
      const sheetNames = workbook.SheetNames;

      if (!sheetNames || sheetNames.length === 0) {
        setError("Yüklenen Excel dosyasında hiç sayfa (kurul) bulunamadı.");
        setLoading(false);
        return;
      }
      
      setWorkbookData(workbook);
      setKurullar(sheetNames);
      setActiveKurul(sheetNames[0]); // Otomatik olarak ilk kurulu seç
    } catch (err) {
      console.error('Dosya okuma hatası:', err);
      setError('Dosya işlenirken bir hata oluştu. Dosyanın bozuk olmadığından emin olun.');
    } finally {
      setLoading(false);
    }
  }, [file]);
  
  // AKTİF KURUL DEĞİŞTİĞİNDE TETİKLENİR
  useEffect(() => {
    if (activeKurul && workbookData) {
      setError(''); // Kurul değiştirildiğinde eski hataları temizle
      const worksheet = workbookData.Sheets[activeKurul];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      parseScheduleData(jsonData);
    }
  }, [activeKurul, workbookData]);

  // TAKVİM (.ICS) DOSYASI OLUŞTURMA
  const generateICSFile = () => {
    // ... Bu fonksiyonun iç mantığı önceki versiyonla aynı kalmıştır ...
    if (parsedEvents.length === 0) return;
    const now = new Date();
    const formatDateTime = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Ders Programi Olusturucu//TR\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n';
    parsedEvents.forEach((event, index) => {
      const uid = `ders-${activeKurul.replace(/\s/g, '')}-${now.getTime()}-${index}@example.com`;
      const [startHour, startMinute] = event.startTime.split(':');
      const startDateTime = new Date(event.date);
      startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
      const [endHour, endMinute] = event.endTime.split(':');
      const endDateTime = new Date(event.date);
      endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
      icsContent += 'BEGIN:VEVENT\n';
      icsContent += `UID:${uid}\n`;
      icsContent += `DTSTAMP:${formatDateTime(now)}\n`;
      icsContent += `DTSTART:${formatDateTime(startDateTime)}\n`;
      icsContent += `DTEND:${formatDateTime(endDateTime)}\n`;
      icsContent += `SUMMARY:${event.title}\n`;
      icsContent += `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}\n`;
      icsContent += 'BEGIN:VALARM\nTRIGGER:-PT15M\nACTION:DISPLAY\n';
      icsContent += `DESCRIPTION:Hatırlatma: ${event.title} dersi 15 dakika sonra başlayacak.\n`;
      icsContent += 'END:VALARM\nEND:VEVENT\n';
    });
    icsContent += 'END:VCALENDAR';
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ders-programi-${activeKurul.replace(/\s/g, '-')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // --- RENDER (ARAYÜZÜN OLUŞTURULMASI) ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8 font-sans transition-colors duration-300">
      <div className="max-w-7xl mx-auto relative">

        {/* --- Tema Değiştirme Butonu --- */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="absolute top-0 right-0 z-10 p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 transition-colors"
          aria-label="Toggle dark mode"
        >
          {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
        </button>

        {/* --- Sayfa Başlığı --- */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-6 py-3 rounded-full shadow-md mb-4">
            <Calendar className="text-indigo-500" size={32} />
            <h1 className="text-2xl sm:text-3xl font-bold">Ders Programı → Takvim</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">Excel (.xlsx) dosyanızı seçin, istediğiniz kurulun takvimini (.ics) saniyeler içinde indirin.</p>
        </header>

        {/* --- Ana İçerik Alanı (2 Sütunlu Yapı) --- */}
        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* --- Sol Sütun: Kontrol Paneli --- */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 space-y-8 border border-transparent dark:border-slate-700">
            
            {/* Adım 1: Dosya Yükleme */}
            <section>
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-3">
                <Upload className="text-indigo-500" size={24} />
                1. Program Dosyasını Yükle
              </h2>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <input type="file" accept=".xlsx" onChange={handleFileSelect} id="file-upload" className="hidden" />
                <label htmlFor="file-upload" className="flex-grow w-full text-center cursor-pointer bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 hover:bg-slate-100 dark:hover:bg-slate-600 transition truncate">
                  {file ? `✅ ${file.name}` : 'Dosya seçmek için tıkla (.xlsx)'}
                </label>
                <button
                  onClick={processFile} disabled={loading || !file}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/50 focus:outline-none focus:ring-4 focus:ring-indigo-300"
                >
                  {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <BookOpen size={20} />}
                  <span>İşle</span>
                </button>
              </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-700" />

            {/* Adım 2: Kurul Seçimi */}
            {kurullar.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-3">
                  <FileText className="text-indigo-500" size={24} />
                  2. Kurul Seç
                </h2>
                <div className="flex flex-wrap gap-2">
                  {kurullar.map(kurul => (
                    <button
                      key={kurul}
                      onClick={() => setActiveKurul(kurul)}
                      className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 focus:ring-indigo-500 ${activeKurul === kurul
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                        }`}
                    >
                      {kurul}
                    </button>
                  ))}
                </div>
              </section>
            )}
            
            {/* Adım 3: İndirme Alanı */}
            {kurullar.length > 0 && (
              <section>
                <hr className="border-slate-200 dark:border-slate-700 mb-8" />
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-3">
                  <Download className={parsedEvents.length > 0 ? "text-green-500" : "text-slate-500"} size={24} />
                  3. Takvimi İndir
                </h2>
                {parsedEvents.length > 0 ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
                      <CheckCircle className="text-green-600 dark:text-green-400" size={24}/>
                      <p className="text-green-800 dark:text-green-200 font-medium">
                        "{activeKurul}" için {parsedEvents.length} ders bulundu. İndirmeye hazır!
                      </p>
                    </div>
                    <button
                      onClick={generateICSFile}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg hover:shadow-green-500/50 focus:outline-none focus:ring-4 focus:ring-green-300"
                    >
                      <Calendar size={20} />
                      {activeKurul} için .ics İndir
                    </button>
                  </div>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex items-center gap-3">
                      <AlertTriangle className="text-yellow-600 dark:text-yellow-400" size={24}/>
                      <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                        {error ? error : `"${activeKurul}" için ders bulunamadı.`}
                      </p>
                    </div>
                )}
              </section>
            )}
          </div>

          {/* --- Sağ Sütun: Önizleme --- */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 border border-transparent dark:border-slate-700">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
              <Clock className="text-indigo-500" size={24} />
              Program Önizlemesi
            </h2>
            <div className="space-y-4 max-h-[36rem] overflow-y-auto pr-2">
              {!file ? (
                <div className="text-center text-slate-500 dark:text-slate-400 py-20 flex flex-col items-center">
                  <Upload size={48} className="mb-4 opacity-50" />
                  <p className="font-semibold text-lg">Başlamak için bir dosya yükleyin</p>
                  <p>Excel dosyanızı yükleyip "İşle" butonuna basın.</p>
                </div>
              ) : parsedEvents.length === 0 ? (
                <div className="text-center text-slate-500 dark:text-slate-400 py-20 flex flex-col items-center">
                  <BookOpen size={48} className="mb-4 opacity-50" />
                  <p className="font-semibold text-lg">Önizleme için veri bekleniyor</p>
                  <p>{kurullar.length > 0 ? `"${activeKurul}" kurulunda ders bulunamadı.` : 'Dosya henüz işlenmedi.'}</p>
                </div>
              ) : (
                parsedEvents.map((event, index) => (
                  <div key={index} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border-l-4 border-indigo-500 hover:shadow-lg hover:scale-[1.02] transition-all duration-200">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold pr-2">{event.title}</h3>
                      <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2.5 py-1 rounded-full flex-shrink-0">
                        {event.day}
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400 mb-2">
                      <span className="flex items-center gap-1.5"><Clock size={14} />{event.startTime} - {event.endTime}</span>
                      <span className="flex items-center gap-1.5"><Calendar size={14} />{event.date.toLocaleDateString('tr-TR')}</span>
                    </div>
                    {event.instructor && (
                      <p className="text-sm flex items-center gap-2 pt-1 text-slate-700 dark:text-slate-300">
                        <User size={14} className="text-indigo-500 flex-shrink-0"/> 
                        <span className='font-medium'>{event.instructor}</span>
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ScheduleToCalendar;