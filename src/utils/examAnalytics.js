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
  'dekan-öğrenci', 'dekan öğrenci', 'dekan–öğrenci', 'dekan',
  'şenliği', 'senligi', 'öçm', 'ocm', 'özel çalışma modülü',
  'panel', 'resmi tatil', 'resmî tatil',
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

  // Resmi Tatiller ve Bayramlar
  if (/resm[ıi]\s*tatil|kurban\s*bayram|ramazan\s*bayram|cumhuriyet\s*bayram|çocuk\s*bayram|gençlik\s*ve\s*spor/i.test(clean)) {
    return 'Resmi Tatil';
  }

  // Özel etkinlikler & Sınav Dışı Saatler
  if (/ba[gğ][ıi]ms[ıi]z\s*ç/i.test(clean)) return 'Bağımsız Çalışma Saati';
  if (/se[çc]meli\s*ders/i.test(clean)) return 'Seçmeli Ders';
  if (/sosyal\s*sorumluluk/i.test(clean)) return 'Sosyal Sorumluluk ve Proje';
  if (/dan[ıi][şs]manl[ıi]k/i.test(clean)) return 'Danışmanlık Saati';
  if (/ubys|öğrenci bilgi/i.test(clean)) return 'UBYS Tanıtımı';
  if (/kurul\s*tan[ıi]t[ıi]m/i.test(clean)) return 'Kurul Tanıtımı';
  if (/mesleki\s*beceri/i.test(clean)) return 'Mesleki Beceri';
  if (/ö[çc]m\s*şenli[gğ]i|ocm\s*senligi/i.test(clean)) return 'ÖÇM Şenliği';
  if (/\bö[çc]m\b|\bocm\b|özel\s*çalışma\s*modülü/i.test(clean)) return 'ÖÇM';
  if (/dekan[–\-\s]*öğrenci/i.test(clean)) return 'Dekan-Öğrenci Buluşması';
  if (/^panel/i.test(clean)) return 'Panel';

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

  // Sınavlar, tatiller, çalışma saatleri, ÖÇM ve paneller sınava soru olarak girmez
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
  // Anatomi, Histoloji, Fizyoloji, Mikrobiyoloji, Patoloji pratik sınavına da girebilir
  const hasPractice = ['anatomi', 'histoloji', 'fizyoloji', 'mikrobiyoloji', 'patoloji', 'farmakoloji'].some(d => lower.includes(d));

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
 * Grafik Renk Paleti (Sade, modern gri-siyah-sarı temalı tıp analitik renkleri)
 */
export const DEPARTMENT_COLORS = [
  '#f59e0b', // Amber / Sarı (Birincil ders)
  '#d97706', // Koyu Kehribar / Bronz
  '#eab308', // Parlak Altın Sarısı
  '#a1a1aa', // Platin Gri
  '#fbbf24', // Açık Sarı
  '#71717a', // Çelik Gri
  '#ca8a04', // Antik Altın
  '#e4e4e7', // Gümüş Açık Gri
  '#b45309', // Koyu Pirinç / Hardal
  '#52525b', // Füme Gri
  '#fde047', // Açık Saman Sarısı
  '#3f3f46'  // Koyu Kurşuni
];

export const getDepartmentColor = (index) => {
  return DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length];
};

/**
 * Müfredattaki net teorik ve pratik ders saati oranından otomatik sınav ağırlığı hesaplar
 */
export const calculateAutoWeights = (departmentList = []) => {
  const activeTheory = departmentList.filter(d => d.includeInTheory);
  const activePractice = departmentList.filter(d => d.includeInPractice);

  const totalTheory = activeTheory.reduce((sum, d) => sum + (d.netTheoryHours || 0), 0);
  const totalPractice = activePractice.reduce((sum, d) => sum + (d.netPracticeHours || 0), 0);
  const totalAcademic = totalTheory + totalPractice;

  if (totalAcademic === 0 || totalPractice === 0) {
    return {
      theoryWeight: 100,
      practiceWeight: 0,
      totalTheory,
      totalPractice
    };
  }

  const rawTheoryPercent = (totalTheory / totalAcademic) * 100;
  const theoryWeight = Math.round(rawTheoryPercent);
  const practiceWeight = 100 - theoryWeight;

  return {
    theoryWeight,
    practiceWeight,
    totalTheory,
    totalPractice
  };
};

/**
 * Hafta bazında teorik, pratik ve bağımsız çalışma yükünü analiz eder
 */
export const computeWeeklyWorkload = (events = []) => {
  if (!events || events.length === 0) return { weeks: [], peakWeek: null, maxWeeklyHours: 0 };

  const weekMap = {};

  events.forEach(event => {
    if (!event.week || event.title?.toUpperCase().includes('ÖĞLE ARASI')) return;

    const w = event.week;
    if (!weekMap[w]) {
      weekMap[w] = {
        week: w,
        theoryCount: 0,
        practiceSlotsG1: 0,
        practiceSlotsG2: 0,
        practiceSlotsAll: 0,
        selfStudyCount: 0,
        examCount: 0,
        otherCount: 0
      };
    }

    const item = weekMap[w];
    if (event.isExam || /^sınav/i.test(event.title)) {
      item.examCount += 1;
    } else if (event.isSelfStudy || /ba[gğ][ıi]ms[ıi]z\s*ç/i.test(event.title)) {
      item.selfStudyCount += 1;
    } else if (event.type === 'U') {
      if (event.group === 'G1') item.practiceSlotsG1 += 1;
      else if (event.group === 'G2') item.practiceSlotsG2 += 1;
      else item.practiceSlotsAll += 1;
    } else if (event.type === 'T') {
      item.theoryCount += 1;
    } else {
      item.otherCount += 1;
    }
  });

  const weeks = Object.values(weekMap).map(w => {
    // Net pratik: G1/G2 tekrarı teke indirilir
    const netPractice = Math.max(w.practiceSlotsG1, w.practiceSlotsG2) + w.practiceSlotsAll;
    const academicHours = w.theoryCount + netPractice;
    const totalTrackedHours = academicHours + w.selfStudyCount + w.examCount;

    return {
      week: w.week,
      theoryHours: w.theoryCount,
      practiceHours: netPractice,
      selfStudyHours: w.selfStudyCount,
      examHours: w.examCount,
      academicHours,
      totalTrackedHours
    };
  }).sort((a, b) => a.week - b.week);

  let maxHours = 0;
  let peakWeek = null;
  weeks.forEach(w => {
    if (w.academicHours > maxHours) {
      maxHours = w.academicHours;
      peakWeek = w.week;
    }
  });

  return {
    weeks,
    peakWeek,
    maxWeeklyHours: maxHours
  };
};

/**
 * Tıp Fakültesi Müfredat Verilerinden Matematiksel Stratejik Analizler Üretir (AI Destekli Analitik Motoru)
 * - AI Slop içermez; doğrudan resmi ders saatleri, soru sayıları ve tıp fakültesi baraj kurallarına dayanır.
 */
export const computeStrategicMedicalInsights = (examResult, weeklyWorkload, kurulName = '') => {
  if (!examResult || !examResult.departments || examResult.departments.length === 0) return null;

  const academicDepts = examResult.departments
    .filter(d => (d.includeInTheory && d.questions > 0) || (d.includeInPractice && d.practicePoints > 0))
    .sort((a, b) => b.totalExamWeightPercent - a.totalExamWeightPercent);

  // 1. Lokomotif Dersler (Kurulun en az %50-%65'ini oluşturan ana omurga)
  let cumulativeWeight = 0;
  const corePillars = [];
  for (const dept of academicDepts) {
    corePillars.push(dept);
    cumulativeWeight += dept.totalExamWeightPercent;
    if (cumulativeWeight >= 55) break;
  }

  // 2. Baraj Eşiği Analizi (%50 Baraj Kuralı)
  // Tıp fakültelerinde her anabilim dalından en az %50 doğru yapma kuralı vardır
  const barajSubjects = academicDepts
    .filter(d => d.questions >= 4)
    .map(d => {
      const barajThreshold = Math.ceil(d.questions * 0.5);
      return {
        name: d.name,
        questions: d.questions,
        barajThreshold,
        riskLevel: d.questions >= 25 ? 'Yüksek Risk' : d.questions >= 12 ? 'Orta Risk' : 'Dikkat'
      };
    });

  // 3. Çalışma Verimlilik İndeksi (Soru Başına Ders Saati)
  const yieldRanks = academicDepts
    .filter(d => d.questions > 0 && d.netTheoryHours > 0)
    .map(d => {
      const hoursPerQuestion = Number((d.netTheoryHours / d.questions).toFixed(2));
      let badge = 'Dengeli';
      let badgeColor = 'blue';

      if (hoursPerQuestion <= 1.05 && d.practicePoints > 0) {
        badge = 'Yüksek Getiri (Çifte Etki)';
        badgeColor = 'emerald';
      } else if (hoursPerQuestion <= 1.0) {
        badge = 'Yüksek Soru Verimi';
        badgeColor = 'cyan';
      } else if (hoursPerQuestion > 1.25) {
        badge = 'Yoğun İçerik';
        badgeColor = 'amber';
      }

      return {
        name: d.name,
        questions: d.questions,
        netTheoryHours: d.netTheoryHours,
        netPracticeHours: d.netPracticeHours,
        practicePoints: d.practicePoints,
        hoursPerQuestion,
        badge,
        badgeColor
      };
    })
    .sort((a, b) => a.hoursPerQuestion - b.hoursPerQuestion);

  // 4. Pratik Sınav Kaldıraç Etkisi
  const practiceDepts = academicDepts.filter(d => d.includeInPractice && d.practicePoints > 0);
  const totalPracticePoints = practiceDepts.reduce((sum, d) => sum + d.practicePoints, 0);

  // 5. Haftalık Yük Değerlendirmesi
  const peakWeekObj = weeklyWorkload?.weeks?.find(w => w.week === weeklyWorkload?.peakWeek);
  const finalWeek = weeklyWorkload?.weeks?.[weeklyWorkload?.weeks?.length - 1];

  return {
    corePillars,
    cumulativeWeight: Number(cumulativeWeight.toFixed(1)),
    barajSubjects,
    yieldRanks,
    practiceDepts,
    totalPracticePoints,
    peakWeekObj,
    finalWeek,
    totalActiveAcademicHours: examResult.totalTheoryHours + examResult.totalPracticeHours
  };
};
