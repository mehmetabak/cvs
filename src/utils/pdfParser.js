import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// CDN fallback worker to ensure it works across all bundlers without worker config issues
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];

/**
 * Kullanıcı tarafından yüklenen PDF ders programını istemci tarafında ayrıştırır
 */
export const parsePDFSchedule = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let allPagesText = [];
  let kurulTitle = file.name.replace(/\.[^/.]+$/, '');
  let detectedStartDate = null;
  let detectedEndDate = null;

  // Sayfaları gez ve metin bloklarını topla
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Y-ekseni ve X-ekseni sıralı öğeleri birleştir
    const items = textContent.items.map(item => ({
      str: item.str,
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
      width: item.width,
      height: item.height
    }));

    // Satırları Y koordinatına göre grupla (yakın Y değerlerini aynı satır kabul et)
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    
    let lines = [];
    let currentLine = [];
    let lastY = null;

    items.forEach(item => {
      if (!item.str.trim()) return;
      if (lastY === null || Math.abs(item.y - lastY) < 5) {
        currentLine.push(item);
      } else {
        if (currentLine.length > 0) {
          currentLine.sort((a, b) => a.x - b.x);
          lines.push(currentLine.map(i => i.str.trim()).join(' '));
        }
        currentLine = [item];
      }
      lastY = item.y;
    });
    if (currentLine.length > 0) {
      currentLine.sort((a, b) => a.x - b.x);
      lines.push(currentLine.map(i => i.str.trim()).join(' '));
    }

    allPagesText.push({
      pageNum,
      lines,
      rawText: lines.join('\n')
    });
  }

  // Kurul adı ve başlama tarihi tespiti
  for (const p of allPagesText) {
    for (const line of p.lines) {
      if (line.includes('Kurul') && (line.includes('Dönem') || line.includes('Ders Programı'))) {
        kurulTitle = line;
      }
      const dateMatches = line.match(/(\d{1,2}\.\d{1,2}\.\d{4})/g);
      if (dateMatches && dateMatches.length >= 2 && !detectedStartDate) {
        detectedStartDate = dateMatches[0];
        detectedEndDate = dateMatches[1];
      }
    }
  }

  // Varsayılan başlangıç tarihi (bulunamazsa bugünün haftanın pazartesisi)
  let baseStartDate = new Date();
  if (detectedStartDate) {
    const [d, m, y] = detectedStartDate.split('.');
    baseStartDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  } else {
    // En yakın pazartesi
    const day = baseStartDate.getDay();
    const diff = baseStartDate.getDate() - day + (day === 0 ? -6 : 1);
    baseStartDate = new Date(baseStartDate.setDate(diff));
  }

  let currentWeek = 1;
  let currentDay = 'Pazartesi';
  let currentDayIdx = 0;
  const events = [];

  for (const p of allPagesText) {
    for (let i = 0; i < p.lines.length; i++) {
      const line = p.lines[i];

      // Hafta tespiti (Örn: "1. HAFTA", "2. HAFTA")
      const weekMatch = line.match(/(\d+)\.\s*HAFTA/i);
      if (weekMatch) {
        currentWeek = parseInt(weekMatch[1], 10);
      }

      // Gün tespiti
      for (let dIdx = 0; dIdx < DAY_NAMES.length; dIdx++) {
        const dName = DAY_NAMES[dIdx];
        if (line === dName || line.startsWith(dName + ' ') || line.endsWith(' ' + dName)) {
          currentDay = dName;
          currentDayIdx = dIdx;
          break;
        }
      }

      // Saat dilimi tespiti (Örn: "08:15 - 09:00" veya "08:15-09:00")
      const timeMatch = line.match(/(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/);
      if (timeMatch) {
        const startTime = timeMatch[1];
        const endTime = timeMatch[2];

        // Saat sonrasındaki veya altındaki metinler
        let contentPart = line.replace(timeMatch[0], '').trim();
        let nextLines = [];
        
        // Sonraki birkaç satırı hoca / konu için tara
        for (let j = 1; j <= 3 && i + j < p.lines.length; j++) {
          const nextL = p.lines[i + j];
          if (nextL.match(/\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}/) || 
              DAY_NAMES.some(d => nextL === d) ||
              nextL.match(/\d+\.\s*HAFTA/i)) {
            break;
          }
          nextLines.push(nextL);
        }

        const combinedText = [contentPart, ...nextLines].join(' ').trim();
        if (!combinedText || combinedText.toUpperCase().includes('ÖĞLE ARASI') || combinedText.toUpperCase().includes('GLE ARASI')) {
          continue;
        }

        let type = 'T';
        if (combinedText.startsWith('T ') || combinedText.includes(' T ')) type = 'T';
        if (combinedText.startsWith('U ') || combinedText.includes(' U ') || combinedText.toLowerCase().includes('uygulama') || combinedText.toLowerCase().includes('demo')) type = 'U';

        // Tarih hesapla: Başlangıç tarihi + (hafta - 1) * 7 gün + gün indeksi
        const eventDate = new Date(baseStartDate);
        eventDate.setDate(baseStartDate.getDate() + (currentWeek - 1) * 7 + currentDayIdx);

        // Grup tespiti
        let group = 'TÜM';
        if (/\b(G1|Grup 1)\b/i.test(combinedText)) group = 'G1';
        else if (/\b(G2|Grup 2)\b/i.test(combinedText)) group = 'G2';

        const isSelfStudy = /ba[gğ][ıi]ms[ıi]z/i.test(combinedText);
        const isExam = /s[ıi]nav|vize|final|b[üu]t[üu]nleme/i.test(combinedText);

        events.push({
          id: `pdf-event-${currentWeek}-${events.length + 1}`,
          week: currentWeek,
          day: currentDay,
          date: eventDate.toISOString().split('T')[0],
          startTime,
          endTime,
          type: isExam ? 'Sınav' : isSelfStudy ? 'Çalışma' : type,
          title: combinedText,
          instructor: '',
          group,
          isSelfStudy,
          isExam
        });
      }
    }
  }

  return {
    kurulTitle,
    detectedStartDate,
    detectedEndDate,
    events
  };
};
