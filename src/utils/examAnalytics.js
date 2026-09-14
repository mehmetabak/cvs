/**
 * Tıp Fakültesi Sınav & Ders Saati Oran Analizi Motoru
 * - Grup bazlı (G1/G2) tekrarlanan pratik seanslarını teke indirir (Net Öğrenci Müfredat Saati)
 * - Teorik ve Pratik sınav ağırlıklarını ayrı ayrı ve toplam not bazında hesaplar
 * - Soru sayılarını tam sayıya (örn. 100 soru) kusursuz dengeler
 */

// Sınav dışı tutulması gereken genel ders/etkinlik anahtar kelimeleri
const NON_EXAM_KEYWORDS = [
  'bağımsız çalışma', 'bagimsiz calisma', 'bamsz',
  'seçmeli ders', 'secmeli ders', 'semeli',
  'sosyal sorumluluk',
  'öğrenci bilgi sistemi', 'ubys',
  'kurul tanıtım', 'kurul tanitim',
  'danışmanlık', 'danismanlik',
  'öğle arası', 'ogle arasi',
  'dekan-öğrenci', 'dekan öğrenci', 'şenliği', 'senligi',
  'tatil', 'bayram', 'sınav soru tartışması'
];

/**
 * Ders başlığından ana anabilim dalını/ders adını tespit eder
 */
export const extractDepartmentName = (title) => {
  if (!title) return 'Diğer';
  const clean = title.trim();

  // Sınav kontrolü
  if (/^sınav|^sinav|^t-\s*sınav|^kurul teorik sınavı/i.test(clean)) {
    return 'Sınavlar';
  }

  // Özel etkinlikler
  if (/ba[gğ][ıi]ms[ıi]z\s*ç/i.test(clean)) return 'Bağımsız Çalışma Saati';
  if (/se[çc]meli\s*ders/i.test(clean)) return 'Seçmeli Ders';
  if (/sosyal\s*sorumluluk/i.test(clean)) return 'Sosyal Sorumluluk ve Proje';
  if (/dan[ıi][şs]manl[ıi]k/i.test(clean)) return 'Danışmanlık Saati';
  if (/ubys|öğrenci bilgi/i.test(clean)) return 'UBYS Tanıtımı';
  if (/kurul\s*tan[ıi]t[ıi]m/i.test(clean)) return 'Kurul Tanıtımı';
  if (/mesleki\s*beceri/i.test(clean)) return 'Mesleki Beceri';

  // DEMO ile başlayanlar (Örn: "DEMO: Anatomi Tekrarı" -> "Anatomi")
  let stripped = clean.replace(/^DEMO:\s*/i, '').replace(/^DEMO\s*/i, '');

  // Parantez öncesi ana disiplin: Örn: "Anatomi (Medulla Spinalis)" -> "Anatomi"
  const parenMatch = stripped.match(/^([^(]+)/);
  let dept = parenMatch ? parenMatch[1].trim() : stripped;

  // Standartlaştırma
  if (/^anatomi/i.test(dept)) return 'Anatomi';
  if (/^fizyoloji/i.test(dept)) return 'Fizyoloji';
  if (/histoloji/i.test(dept)) return 'Histoloji ve Embriyoloji';
  if (/biyokimya/i.test(dept)) return 'Tıbbi Biyokimya';
  if (/biyofizik/i.test(dept)) return 'Biyofizik';
  if (/mikrobiyoloji/i.test(dept)) return 'Tıbbi Mikrobiyoloji';
  if (/patoloji/i.test(dept)) return 'Tıbbi Patoloji';
  if (/farmakoloji/i.test(dept)) return 'Tıbbi Farmakoloji';
  if (/biyoistatistik/i.test(dept)) return 'Biyoistatistik';
  if (/halk\s*sağlığı|halk\s*sagligi/i.test(dept)) return 'Halk Sağlığı';
  if (/tıp\s*eğitimi|tip\s*egitimi/i.test(dept)) return 'Tıp Eğitimi';
  if (/tıp\s*tarihi|tip\s*tarihi/i.test(dept)) return 'Tıp Tarihi ve Etik';
  if (/dsbb/i.test(dept)) return 'DSBB';
  if (/tıbbi\s*biyoloji/i.test(dept)) return 'Tıbbi Biyoloji';

  return dept || 'Diğer';
};

/**
 * Anabilim dalı için varsayılan sınav dahil olma durumunu belirler
 */
export const getDefaultExamStatus = (deptName) => {
  const lower = deptName.toLowerCase();

  // Sınavlar ve çalışma saatleri sınava soru olarak girmez
  if (NON_EXAM_KEYWORDS.some(k => lower.includes(k)) || lower === 'sınavlar') {
    return {
      includeInTheory: false,
      includeInPractice: false,
      isNonAcademic: true
    };
  }

  // Mesleki Beceri: Teorik sınava soru vermez, ancak uygulama/pratik sınavına girer!
  if (lower.includes('mesleki beceri')) {
    return {
      includeInTheory: false,
      includeInPractice: true,
      isNonAcademic: false
    };
  }

  // Standart tıp dersleri:
  // Anatomi, Histoloji pratik sınavına da girer
  const hasPractice = ['anatomi', 'histoloji', 'fizyoloji', 'mikrobiyoloji', 'patoloji'].some(d => lower.includes(d));

  return {
    includeInTheory: true,
    includeInPractice: hasPractice,
    isNonAcademic: false
  };
};

/**
 * Ham etkinlikleri analiz ederek anabilim dallarına göre net müfredat saatlerini hesaplar
 */
export const computeDepartmentStats = (events = []) => {
  const depts = {};

  events.forEach(event => {
    if (!event.title || event.title.toUpperCase().includes('ÖĞLE ARASI')) return;

    const deptName = extractDepartmentName(event.title);
    if (!depts[deptName]) {
      const defaultStatus = getDefaultExamStatus(deptName);
      depts[deptName] = {
        name: deptName,
        totalRawSlots: 0,
        rawTheorySlots: 0,
        rawPracticeSlots: 0,
        g1Slots: 0,
        g2Slots: 0,
        bothGroupSlots: 0,
        // Net saatler
        netTheoryHours: 0,
        netPracticeHours: 0,
        netTotalHours: 0,
        includeInTheory: defaultStatus.includeInTheory,
        includeInPractice: defaultStatus.includeInPractice,
        isNonAcademic: defaultStatus.isNonAcademic
      };
    }

    const d = depts[deptName];
    d.totalRawSlots += 1;

    const isPractice = event.type === 'U';
    if (isPractice) {
      d.rawPracticeSlots += 1;
      if (event.group === 'G1') d.g1Slots += 1;
      else if (event.group === 'G2') d.g2Slots += 1;
      else d.bothGroupSlots += 1;
    } else {
      d.rawTheorySlots += 1;
    }
  });

  // Net Saatlerin Hesaplanması:
  // Kural: Bir öğrenci tek bir gruba tabidir.
  // Teorik dersler tüm sınıfa verildiği için netTheoryHours = rawTheorySlots.
  // Pratik dersler G1 ve G2 olarak tekrar ediliyorsa; bir öğrencinin aldığı pratik saat max(G1, G2) + bothGroupSlots kadardır.
  Object.values(depts).forEach(d => {
    d.netTheoryHours = d.rawTheorySlots;

    if (d.rawPracticeSlots > 0) {
      if (d.g1Slots > 0 && d.g2Slots > 0) {
        // Tekrarlanan seanslar: Ortalama/Maksimum tekil grup saati
        d.netPracticeHours = Math.max(d.g1Slots, d.g2Slots) + d.bothGroupSlots;
      } else {
        // Ya tek grup olarak verilmiş ya da tüm sınıfa aynı anda verilmiş
        d.netPracticeHours = d.g1Slots + d.g2Slots + d.bothGroupSlots;
      }
    } else {
      d.netPracticeHours = 0;
    }

    d.netTotalHours = d.netTheoryHours + d.netPracticeHours;
  });

  return Object.values(depts).sort((a, b) => b.netTotalHours - a.netTotalHours);
};

/**
 * Seçilen ders durumlarına, toplam soru sayısına ve teorik/pratik ağırlıklarına göre tam dağılımı hesaplar
 */
export const calculateExamDistribution = ({
  departmentList,
  totalQuestions = 100,
  theoryWeightPercent = 80,
  practiceWeightPercent = 20
}) => {
  // 1. Sınava dahil edilen teorik saatler
  const theoryDepts = departmentList.filter(d => d.includeInTheory && d.netTheoryHours > 0);
  const totalTheoryHours = theoryDepts.reduce((sum, d) => sum + d.netTheoryHours, 0);

  // 2. Sınava dahil edilen pratik saatler
  const practiceDepts = departmentList.filter(d => d.includeInPractice && d.netPracticeHours > 0);
  const totalPracticeHours = practiceDepts.reduce((sum, d) => sum + d.netPracticeHours, 0);

  // 3. Teorik Soru Sayılarının Hesaplanması (Hamilton-Hare / En Büyük Kalan Yöntemi ile tam 100 soru dengesi)
  let allocatedQuestions = 0;
  const theoryAllocations = theoryDepts.map(d => {
    const rawRatio = totalTheoryHours > 0 ? (d.netTheoryHours / totalTheoryHours) : 0;
    const exactQuestions = rawRatio * totalQuestions;
    const floorQuestions = Math.floor(exactQuestions);
    const remainder = exactQuestions - floorQuestions;
    allocatedQuestions += floorQuestions;

    return {
      name: d.name,
      netTheoryHours: d.netTheoryHours,
      theoryRatio: rawRatio,
      questions: floorQuestions,
      remainder
    };
  });

  // Kalan soruları en yüksek kesirli kısımlara 1'er 1'er dağıt
  let diff = totalQuestions - allocatedQuestions;
  theoryAllocations.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < diff && i < theoryAllocations.length; i++) {
    theoryAllocations[i].questions += 1;
  }

  // 4. Pratik Puan Dağılımı Hesabı (100 puan üzerinden)
  const practiceAllocations = {};
  practiceDepts.forEach(d => {
    const ratio = totalPracticeHours > 0 ? (d.netPracticeHours / totalPracticeHours) : 0;
    practiceAllocations[d.name] = {
      netPracticeHours: d.netPracticeHours,
      practiceRatio: ratio,
      points100: Number((ratio * 100).toFixed(1))
    };
  });

  // 5. Her Anabilim Dalı İçin Birleştirilmiş Sonuç & Genel Kurul Notuna Etki
  const resultDepartments = departmentList.map(dept => {
    const tAlloc = theoryAllocations.find(a => a.name === dept.name);
    const pAlloc = practiceAllocations[dept.name];

    const questions = tAlloc ? tAlloc.questions : 0;
    const questionRatioPercent = Number(((questions / totalQuestions) * 100).toFixed(1));
    const practicePoints = pAlloc ? pAlloc.points100 : 0;

    // Genel Kurul Notuna Ağırlık Hesabı:
    // (Teorik Soru Oranı * Teorik Ağırlık) + (Pratik Puan Oranı * Pratik Ağırlık)
    const theoryContribution = (questionRatioPercent * (theoryWeightPercent / 100));
    const practiceContribution = (practicePoints * (practiceWeightPercent / 100));
    const totalExamWeightPercent = Number((theoryContribution + practiceContribution).toFixed(1));

    return {
      ...dept,
      questions,
      questionRatioPercent,
      practicePoints,
      totalExamWeightPercent
    };
  });

  return {
    departments: resultDepartments,
    totalTheoryHours,
    totalPracticeHours,
    totalQuestions,
    theoryWeightPercent,
    practiceWeightPercent,
    hasPracticeExam: practiceDepts.length > 0 && practiceWeightPercent > 0
  };
};

/**
 * Grafik Renk Paleti (Şık, göz yormayan profesyonel tıp analitik renkleri)
 */
export const DEPARTMENT_COLORS = [
  '#6366f1', // Indigo (Anatomi vb.)
  '#06b6d4', // Cyan (Fizyoloji)
  '#10b981', // Emerald (Histoloji)
  '#f59e0b', // Amber (Biyokimya)
  '#f43f5e', // Rose (Biyofizik)
  '#8b5cf6', // Violet (Mikrobiyoloji)
  '#ec4899', // Pink (Patoloji)
  '#14b8a6', // Teal (Farmakoloji)
  '#3b82f6', // Blue (Biyoistatistik)
  '#d97706', // Warm Amber (Halk Sağlığı)
  '#a855f7', // Purple (Mesleki Beceri)
  '#64748b'  // Slate (Diğer)
];

export const getDepartmentColor = (index) => {
  return DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length];
};
