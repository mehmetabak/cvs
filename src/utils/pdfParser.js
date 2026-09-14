import * as pdfjsLib from 'pdfjs-dist/build/pdf';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];

/**
 * Kullanıcı tarafından yüklenen PDF ders programını eksiksiz ayrıştırır
 */
export const parsePDFSchedule = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let allLines = [];
  let kurulTitle = file.name.replace(/\.[^/.]+$/, '');
  let detectedStartDate = null;
  let detectedEndDate = null;

  // Tüm sayfalardaki metinleri topla
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Y-ekseni ve X-eksenine göre sırala
    const items = textContent.items.map(item => ({
      str: item.str.trim(),
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5])
    })).filter(i => i.str);

    items.sort((a, b) => b.y - a.y || a.x - b.x);

    let pageLines = [];
    let currentLine = [];
    let lastY = null;

    items.forEach(item => {
      if (lastY === null || Math.abs(item.y - lastY) < 5) {
        currentLine.push(item);
      } else {
        if (currentLine.length > 0) {
          currentLine.sort((a, b) => a.x - b.x);
          pageLines.push(currentLine.map(i => i.str).join(' '));
        }
        currentLine = [item];
      }
      lastY = item.y;
    });
    if (currentLine.length > 0) {
      currentLine.sort((a, b) => a.x - b.x);
      pageLines.push(currentLine.map(i => i.str).join(' '));
    }

    allLines.push({ pageNum, lines: pageLines });
  }

  // Tarih ve Kurul Adı tespiti
  for (const p of allLines) {
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

  let baseStartDate = new Date();
  if (detectedStartDate) {
    const [d, m, y] = detectedStartDate.split('.');
    baseStartDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  } else {
    const day = baseStartDate.getDay();
    const diff = baseStartDate.getDate() - day + (day === 0 ? -6 : 1);
    baseStartDate = new Date(baseStartDate.setDate(diff));
  }

  let currentWeek = 1;
  let currentDay = 'Pazartesi';
  let currentDayIdx = 0;
  const events = [];

  // Düzleştirilmiş tüm satırlar
  const flatLines = [];
  allLines.forEach(p => {
    p.lines.forEach(l => {
      if (l.trim()) flatLines.push(l.trim());
    });
  });

  let i = 0;
  while (i < flatLines.length) {
    const line = flatLines[i];

    // Hafta kontrolü
    const wMatch = line.match(/^(\d+)\.\s*HAFTA/i);
    if (wMatch) {
      currentWeek = parseInt(wMatch[1], 10);
      i++;
      continue;
    }

    // Gün kontrolü
    for (let dIdx = 0; dIdx < DAYS.length; dIdx++) {
      const dName = DAYS[dIdx];
      if (line === dName || (line.startsWith(dName) && line.length < 15)) {
        currentDay = dName;
        currentDayIdx = dIdx;
        break;
      }
    }

    // Saat kontrolü (08:15 - 09:00 VEYA tek satırda '08:15 -' ve alt satırda '09:00')
    const mSingle = line.match(/^(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/);
    const mStart = line.match(/^(\d{2}:\d{2})\s*[-–]/);

    let startTime = null;
    let endTime = null;

    if (mSingle) {
      startTime = mSingle[1];
      endTime = mSingle[2];
      i++;
    } else if (mStart && i + 1 < flatLines.length && flatLines[i + 1].match(/^\d{2}:\d{2}$/)) {
      startTime = mStart[1];
      endTime = flatLines[i + 1];
      i += 2;
    } else {
      i++;
      continue;
    }

    // İçerik satırlarını topla
    const contentLines = [];
    while (i < flatLines.length) {
      const nxt = flatLines[i];
      if (nxt.match(/^\d+\.\s*HAFTA/i)) break;
      if (DAYS.some(d => nxt === d || (nxt.startsWith(d) && nxt.length < 15))) break;
      if (nxt.match(/^\d{2}:\d{2}\s*[-–]/) || nxt.match(/^\d{2}:\d{2}$/)) break;
      if (!['SAAT', 'T/U', 'KONU', 'ÖĞRETİM ÜYESİ', 'RETM YES'].includes(nxt)) {
        contentLines.push(nxt);
      }
      i++;
    }

    const joined = contentLines.join(' ').trim();
    if (!joined || joined.toUpperCase().includes('ÖĞLE ARASI') || joined.toUpperCase().includes('GLE ARASI')) {
      continue;
    }

    let lessonType = 'T';
    let rest = contentLines;
    if (contentLines.length > 0 && ['T', 'U', 'T-', 'U-'].includes(contentLines[0])) {
      lessonType = contentLines[0].replace('-', '').trim();
      rest = contentLines.slice(1);
    }

    const topicParts = [];
    const instParts = [];
    let foundInst = false;

    rest.forEach(item => {
      if (['Prof.', 'Doç.', 'Do.', 'Dr.', 'Uzm.', 'Öğr. Gör.', 'r. Gr.', 'Kurul Başkanı'].some(t => item.includes(t))) {
        foundInst = true;
      }
      if (foundInst) instParts.append ? instParts.append(item) : instParts.push(item);
      else topicParts.push(item);
    });

    if (topicParts.length === 0 && instParts.length > 0) {
      topicParts.push(instParts.shift());
    }

    const topic = topicParts.join(' ').trim() || joined;
    const instructor = instParts.join(' ').trim();

    const isSelfStudy = /ba[gğ][ıi]ms[ıi]z/i.test(topic);
    const isExam = /s[ıi]nav|vize|final|b[üu]t[üu]nleme/i.test(topic);

    let group = 'TÜM';
    if (/\b(G1|Grup 1)\b/i.test(topic) && /\b(G2|Grup 2)\b/i.test(topic)) group = 'G1-G2';
    else if (/\b(G1|Grup 1)\b/i.test(topic)) group = 'G1';
    else if (/\b(G2|Grup 2)\b/i.test(topic)) group = 'G2';

    const eventDate = new Date(baseStartDate);
    eventDate.setDate(baseStartDate.getDate() + (currentWeek - 1) * 7 + currentDayIdx);

    events.push({
      id: `pdf-ev-${currentWeek}-${events.length + 1}`,
      week: currentWeek,
      day: currentDay,
      date: eventDate.toISOString().split('T')[0],
      startTime,
      endTime,
      type: isExam ? 'Sınav' : isSelfStudy ? 'Çalışma' : lessonType,
      title: topic,
      instructor,
      group,
      isSelfStudy,
      isExam
    });
  }

  return {
    kurulTitle,
    detectedStartDate,
    detectedEndDate,
    events
  };
};
