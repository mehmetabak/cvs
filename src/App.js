import React, { useState, useCallback } from 'react';
import { Calendar, Download, Upload, Clock, BookOpen, MapPin, User } from 'lucide-react';
import * as XLSX from 'xlsx';

const ScheduleToCalendar = () => {
  const [parsedEvents, setParsedEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);

  // Dosya seçimi
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.name.endsWith('.xlsx')) {
      setFile(selectedFile);
      setParsedEvents([]); // Yeni dosya seçildiğinde eski sonuçları temizle
    } else {
      alert('Lütfen .xlsx uzantılı bir Excel dosyası seçin.');
    }
  };

  // Excel dosyasını oku
  const readExcelFile = useCallback(async () => {
    if (!file) {
      alert('Lütfen önce bir Excel dosyası seçin.');
      return;
    }

    try {
      setLoading(true);
      
      const fileData = await file.arrayBuffer();
      const workbook = XLSX.read(fileData, { type: 'array' });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        alert('Excel dosyasında sayfa bulunamadı.');
        return;
      }
      
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      // header: 1 -> veriyi [[], [], ...] formatında array olarak alır
      // defval: '' -> boş hücreleri null yerine boş string olarak alır
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      if (!jsonData || jsonData.length === 0) {
        alert('Excel dosyasında veri bulunamadı.');
        return;
      }
      
      parseScheduleData(jsonData);
    } catch (error) {
      console.error('Dosya okuma hatası:', error);
      alert('Dosya işleme hatası: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [file]);

  // Program verilerini parse et (GÜNCELLENMİŞ FONKSİYON)
  const parseScheduleData = (data) => {
    const events = [];
    let headerRowIndex = -1;

    // 1. Başlık satırını bul (GÜN, SAAT, KONU içeren satır)
    for (let i = 0; i < data.length; i++) {
        const row = data[i] || [];
        const rowStr = row.join(' ').toLowerCase();
        if (rowStr.includes('gün') && rowStr.includes('saat') && rowStr.includes('konu')) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex === -1) {
        alert('Ders programı başlık satırı (GÜN, SAAT, KONU içeren) bulunamadı.');
        return;
    }

    const headers = data[headerRowIndex].map(h => h ? h.toString().trim().toUpperCase() : '');

    // 2. Gerekli sütunların indekslerini bul
    const dateColumnIndex = headers.indexOf('GÜN');
    const timeColumnIndex = headers.indexOf('SAAT');
    const topicColumnIndex = headers.indexOf('KONU');
    const instructorColumnIndex = headers.indexOf('ÖĞRETİM ÜYESİ');

    if (dateColumnIndex === -1 || timeColumnIndex === -1 || topicColumnIndex === -1) {
        alert('Gerekli sütunlar (GÜN, SAAT, KONU) bulunamadı. Lütfen Excel dosyanızı kontrol edin.');
        return;
    }

    let currentDate = null;

    // 3. Veri satırlarını işle
    for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        // Birleştirilmiş hücreler için tarihi yönet
        const cellDateValue = row[dateColumnIndex];
        if (cellDateValue) {
            if (typeof cellDateValue === 'number') {
                // Excel tarih seri numarasını JavaScript tarihine çevir
                const excelEpoch = new Date(1899, 11, 30);
                currentDate = new Date(excelEpoch.getTime() + cellDateValue * 86400000);
            } else {
                // Metin formatındaki tarihi işle (ör: 9/22/2025)
                const dateParts = cellDateValue.toString().split('/');
                if (dateParts.length === 3) {
                    // Ay, Gün, Yıl formatını varsayıyoruz (JS'de ay 0'dan başlar)
                    currentDate = new Date(dateParts[2], dateParts[0] - 1, dateParts[1]);
                }
            }
        }

        if (!currentDate) continue; // Geçerli bir tarih bulunana kadar satırları atla

        const timeSlot = row[timeColumnIndex] ? row[timeColumnIndex].toString() : '';
        const topic = row[topicColumnIndex] ? row[topicColumnIndex].toString().trim() : '';

        // Eğer saat veya konu bilgisi yoksa veya "ÖĞLE ARASI" gibi bir satırsa atla
        if (!timeSlot || !topic || topic.toUpperCase() === 'ÖĞLE ARASI') continue;

        const timeMatch = timeSlot.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
        if (!timeMatch) continue;

        const [, startHour, startMinute, endHour, endMinute] = timeMatch;
        const dayOfWeek = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][currentDate.getDay()];
        const instructor = (instructorColumnIndex !== -1 && row[instructorColumnIndex]) ? row[instructorColumnIndex].toString().trim() : '';

        events.push({
            title: topic,
            instructor: instructor,
            location: '', // Bu formatta konum ayrı bir sütunda değil
            day: dayOfWeek,
            date: new Date(currentDate.getTime()), // Tarih objesinin kopyasını sakla
            startTime: `${startHour}:${startMinute}`,
            endTime: `${endHour}:${endMinute}`,
            description: `${topic}${instructor ? '\n\nÖğretim Üyesi:\n' + instructor : ''}`
        });
    }

    setParsedEvents(events);
    if(events.length === 0 && data.length > headerRowIndex + 1) {
        alert("Başlıklar bulundu fakat ders verisi okunamadı. Lütfen Excel formatını kontrol edin.");
    }
  };

  // ICS formatında calendar dosyası oluştur (GÜNCELLENMİŞ FONKSİYON)
  const generateICSFile = () => {
    if (parsedEvents.length === 0) return;

    const now = new Date();

    const formatDateTime = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    let icsContent = 'BEGIN:VCALENDAR\n';
    icsContent += 'VERSION:2.0\n';
    icsContent += 'PRODID:-//Ders Programi Olusturucu//TR\n';
    icsContent += 'CALSCALE:GREGORIAN\n';
    icsContent += 'METHOD:PUBLISH\n';

    parsedEvents.forEach((event, index) => {
      const uid = `ders-${now.getTime()}-${index}@example.com`;
      
      const [startHour, startMinute] = event.startTime.split(':');
      const startDateTime = new Date(event.date);
      startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);

      const [endHour, endMinute] = event.endTime.split(':');
      const endDateTime = new Date(event.date);
      endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

      icsContent += 'BEGIN:VEVENT\n';
      icsContent += 'UID:' + uid + '\n';
      icsContent += 'DTSTAMP:' + formatDateTime(now) + '\n';
      icsContent += 'DTSTART:' + formatDateTime(startDateTime) + '\n';
      icsContent += 'DTEND:' + formatDateTime(endDateTime) + '\n';
      icsContent += 'SUMMARY:' + event.title + '\n';
      // Açıklama satır sonlarını ICS formatına uygun hale getir
      icsContent += 'DESCRIPTION:' + event.description.replace(/\n/g, '\\n') + '\n';
      if (event.location) {
        icsContent += 'LOCATION:' + event.location + '\n';
      }
      
      // Tekrarlayan etkinlik (RRULE) kaldırıldı, çünkü her dersin kesin tarihi var.
      
      icsContent += 'BEGIN:VALARM\n';
      icsContent += 'TRIGGER:-PT15M\n';
      icsContent += 'ACTION:DISPLAY\n';
      icsContent += 'DESCRIPTION:Hatırlatma: ' + event.title + ' dersi 15 dakika sonra başlayacak.\n';
      icsContent += 'END:VALARM\n';
      icsContent += 'END:VEVENT\n';
    });

    icsContent += 'END:VCALENDAR';

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ders-programi.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-lg mb-4">
            <Calendar className="text-blue-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-800">Ders Programı → Takvim</h1>
          </div>
          <p className="text-gray-600 text-lg">Excel (.xlsx) formatındaki ders programınızı takvim dosyasına (.ics) dönüştürün.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-3">
              <Upload className="text-blue-600" size={24} />
              1. Program Yükle
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Excel Dosyasını Seç
                </label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {file && (
                  <p className="mt-2 text-sm text-green-600">
                    ✅ Seçilen dosya: {file.name}
                  </p>
                )}
              </div>

              <button
                onClick={readExcelFile}
                disabled={loading || !file}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Okunuyor...
                  </>
                ) : (
                  <>
                    <BookOpen size={20} />
                    Programı İşle
                  </>
                )}
              </button>

              {parsedEvents.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                   <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-3">
                    <Download className="text-green-600" size={24} />
                    2. Takvimi İndir
                  </h2>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-green-800 font-medium text-center">
                      ✅ {parsedEvents.length} ders başarıyla okundu! <br/> Şimdi takvim dosyasını indirebilirsiniz.
                    </p>
                  </div>

                  <button
                    onClick={generateICSFile}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-green-300"
                  >
                    <Calendar size={18} />
                    ICS Dosyasını İndir
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-3">
              <Clock className="text-indigo-600" size={24} />
              Program Önizlemesi
            </h2>

            <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-2">
              {parsedEvents.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Programı işledikten sonra dersler burada görünecektir.</p>
                </div>
              ) : (
                parsedEvents.map((event, index) => (
                  <div key={index} className="bg-gray-50 rounded-xl p-4 border-l-4 border-blue-500 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-800 pr-2">{event.title}</h3>
                      <span className="text-sm font-medium text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-full flex-shrink-0">
                        {event.day}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} />
                        {event.startTime} - {event.endTime}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        {event.date.toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    
                    {event.instructor && (
                      <p className="text-sm text-gray-700 flex items-center gap-2 pt-1">
                        <User size={14} className="text-blue-600"/> 
                        <span className='font-medium'>{event.instructor}</span>
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleToCalendar;