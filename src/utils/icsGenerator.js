/**
 * RFC 5545 uyumlu iCalendar (.ics) takvim dosyası oluşturucu
 */

export const generateICS = ({ events, kurulName = 'Kurul', alarmMinutes = 15 }) => {
  if (!events || events.length === 0) return false;

  const now = new Date();
  const formatICSDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeICS = (str) => {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  const cleanKurul = kurulName.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ_\- ]/g, '').trim();

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bakircay Tip Fakultesi Ders Programi//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Bakırçay Tıp - ${cleanKurul}`,
    'X-WR-TIMEZONE:Europe/Istanbul'
  ].join('\r\n') + '\r\n';

  events.forEach((event, index) => {
    if (!event.date || !event.startTime || !event.endTime) return;

    const [startHour, startMinute] = event.startTime.split(':');
    const [endHour, endMinute] = event.endTime.split(':');

    // Tarih Date objesi veya string olabilir
    const baseDate = new Date(event.date);
    if (isNaN(baseDate.getTime())) return;

    const startDateTime = new Date(baseDate);
    startDateTime.setHours(parseInt(startHour, 10), parseInt(startMinute, 10), 0, 0);

    const endDateTime = new Date(baseDate);
    endDateTime.setHours(parseInt(endHour, 10), parseInt(endMinute, 10), 0, 0);

    const uid = `bakircay-tip-${cleanKurul.replace(/\s+/g, '-')}-${startDateTime.getTime()}-${index}@tip.bakircay.edu.tr`;

    // Başlıkta tür ve grup rozeti ekleyelim
    let typeBadge = '';
    if (event.type === 'T') typeBadge = '[Teorik] ';
    else if (event.type === 'U') typeBadge = `[Pratik${event.group && event.group !== 'TÜM' ? `-${event.group}` : ''}] `;
    else if (event.isExam) typeBadge = '[SINAV] ';
    else if (event.isSelfStudy) typeBadge = '[Çalışma] ';

    const fullSummary = `${typeBadge}${event.title}`.trim();

    const descParts = [
      `Ders: ${event.title}`,
      event.type ? `Tür: ${event.type === 'T' ? 'Teorik' : event.type === 'U' ? 'Uygulama/Pratik' : event.type}` : null,
      event.group && event.group !== 'TÜM' ? `Grup: ${event.group}` : null,
      event.instructor ? `Öğretim Üyesi: ${event.instructor}` : null,
      `Kurul: ${cleanKurul}`,
      event.week ? `Hafta: ${event.week}. Hafta` : null,
      '',
      'İzmir Bakırçay Üniversitesi Tıp Fakültesi'
    ].filter(Boolean);

    const eventBlock = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatICSDate(now)}`,
      `DTSTART:${formatICSDate(startDateTime)}`,
      `DTEND:${formatICSDate(endDateTime)}`,
      `SUMMARY:${escapeICS(fullSummary)}`,
      `DESCRIPTION:${escapeICS(descParts.join('\n'))}`,
      'LOCATION:İzmir Bakırçay Üniversitesi Tıp Fakültesi',
      'STATUS:CONFIRMED'
    ];

    if (alarmMinutes && Number(alarmMinutes) > 0) {
      eventBlock.push(
        'BEGIN:VALARM',
        `TRIGGER:-PT${alarmMinutes}M`,
        'ACTION:DISPLAY',
        `DESCRIPTION:Hatırlatma: ${escapeICS(fullSummary)} dersi ${alarmMinutes} dakika sonra başlayacak.`,
        'END:VALARM'
      );
    }

    eventBlock.push('END:VEVENT');
    icsContent += eventBlock.join('\r\n') + '\r\n';
  });

  icsContent += 'END:VCALENDAR\r\n';

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `ders-programi-${cleanKurul.toLowerCase().replace(/\s+/g, '-')}.ics`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
};
