import React, { useState, useMemo, useEffect } from 'react';
import { 
  PieChart, Sliders, Calculator, Layers, 
  BookOpen, Target, 
  Settings2, RefreshCw, Info, Check, X, Percent
} from 'lucide-react';
import { 
  computeDepartmentStats, 
  calculateExamDistribution, 
  getDepartmentColor 
} from '../utils/examAnalytics';

const ExamAnalyticsView = ({ events = [], kurulName = 'Kurul Programı' }) => {
  // Sınav Ayarları
  const [totalQuestions, setTotalQuestions] = useState(100);
  const [theoryWeight, setTheoryWeight] = useState(80);
  const [practiceWeight, setPracticeWeight] = useState(20);

  // İnteraktif Ders Listesi (Kullanıcı açıp kapatabilir)
  const [departments, setDepartments] = useState([]);
  const [hoveredDept, setHoveredDept] = useState(null);

  // Not Simülatörü State'leri
  const [simTheoryScore, setSimTheoryScore] = useState(70);
  const [simPracticeScore, setSimPracticeScore] = useState(80);

  // Etkinlikler değiştikçe anabilim dallarını yeniden hesapla
  useEffect(() => {
    if (events && events.length > 0) {
      const computed = computeDepartmentStats(events);
      setDepartments(computed);
    } else {
      setDepartments([]);
    }
  }, [events]);

  // Dağılım Hesaplaması
  const examResult = useMemo(() => {
    if (departments.length === 0) return null;
    return calculateExamDistribution({
      departmentList: departments,
      totalQuestions: Number(totalQuestions) || 100,
      theoryWeightPercent: Number(theoryWeight) || 80,
      practiceWeightPercent: Number(practiceWeight) || 20
    });
  }, [departments, totalQuestions, theoryWeight, practiceWeight]);

  // Tekil dersin teorik sınav dahil olma durumunu değiştir
  const toggleTheoryExam = (deptName) => {
    setDepartments(prev => prev.map(d => {
      if (d.name === deptName) {
        return { ...d, includeInTheory: !d.includeInTheory };
      }
      return d;
    }));
  };

  // Tekil dersin pratik sınav dahil olma durumunu değiştir
  const togglePracticeExam = (deptName) => {
    setDepartments(prev => prev.map(d => {
      if (d.name === deptName) {
        return { ...d, includeInPractice: !d.includeInPractice };
      }
      return d;
    }));
  };

  // Tüm dersleri varsayılan sınav ayarlarına sıfırla
  const resetToDefaults = () => {
    const computed = computeDepartmentStats(events);
    setDepartments(computed);
    setTotalQuestions(100);
    setTheoryWeight(80);
    setPracticeWeight(20);
  };

  // Simülasyon Kurul Notu Hesabı
  const simulatedTotalGrade = useMemo(() => {
    const tScore = Number(simTheoryScore) || 0;
    const pScore = Number(simPracticeScore) || 0;
    const tWeight = Number(theoryWeight) / 100;
    const pWeight = Number(practiceWeight) / 100;
    return Number(((tScore * tWeight) + (pScore * pWeight)).toFixed(1));
  }, [simTheoryScore, simPracticeScore, theoryWeight, practiceWeight]);

  if (!examResult || departments.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-10 text-center text-slate-400 space-y-3">
        <BookOpen size={48} className="mx-auto text-slate-500 opacity-40" />
        <h3 className="text-lg font-bold text-slate-200">Analiz edilecek ders bulunamadı</h3>
        <p className="text-sm">Lütfen soldaki menüden bir kurul seçin veya ders programı yükleyin.</p>
      </div>
    );
  }

  // Donut Grafiği SVG Hesaplamaları
  const radius = 80;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  const activeTheoryDepts = examResult.departments.filter(d => d.questions > 0);

  return (
    <div className="space-y-8 animate-fade-in">

      {/* --- ÜST BİLGİ VE ANALİZ BAŞLIĞI --- */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl glass-panel border border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            <Target size={14} />
            <span>Tıp Fakültesi Komite / Kurul Analizi</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            {kurulName} — Sınav Soru & Not Ağırlık Analizi
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Net müfredat ders saatlerine göre hesaplanan sınav soru sayıları, pratik sınav puanları ve kurul etki yüzdeleri.
          </p>
        </div>

        <button
          onClick={resetToDefaults}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition border border-slate-700 flex-shrink-0"
        >
          <RefreshCw size={14} />
          <span>Ayarları Sıfırla</span>
        </button>
      </div>

      {/* --- 4 ADET ÖZET METRİK KARTI --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl glass-panel border border-slate-800/80 space-y-1">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Toplam Soru</span>
            <Target size={15} className="text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {examResult.totalQuestions} <span className="text-xs font-normal text-slate-400">Soru</span>
          </div>
          <div className="text-[11px] text-slate-400">Kurul Teorik Sınavı</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-slate-800/80 space-y-1">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Net Teorik Yük</span>
            <BookOpen size={15} className="text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-cyan-300">
            {examResult.totalTheoryHours} <span className="text-xs font-normal text-slate-400">Saat</span>
          </div>
          <div className="text-[11px] text-slate-400">Sınava dahil teorik dersler</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-slate-800/80 space-y-1">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Net Pratik Yük</span>
            <Layers size={15} className="text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-300">
            {examResult.totalPracticeHours} <span className="text-xs font-normal text-slate-400">Saat</span>
          </div>
          <div className="text-[11px] text-slate-400">Öğrenci başına net lab/beceri</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-slate-800/80 space-y-1">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Sınav Ağırlığı</span>
            <Percent size={15} className="text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300">
            %{theoryWeight} / %{practiceWeight}
          </div>
          <div className="text-[11px] text-slate-400">Teorik %{theoryWeight} • Pratik %{practiceWeight}</div>
        </div>
      </div>

      {/* --- ORTA BÖLÜM: 2 SÜTUNLU GRAFİK & AYAR PANELİ --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* GRAFİK 1 & 2: DONUT HALKA GRAFİĞİ & DAĞILIM (5 KOLON) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* SVG Soru Dağılım Halkası */}
          <div className="p-5 sm:p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <PieChart size={18} className="text-indigo-400" />
                <span>Soru Sayısı Dağılımı ({examResult.totalQuestions} Soru)</span>
              </h3>
            </div>

            <div className="relative flex flex-col items-center justify-center pt-2">
              <svg width="220" height="220" viewBox="0 0 220 220" className="transform -rotate-90">
                {/* Arka plan çemberi */}
                <circle
                  cx="110"
                  cy="110"
                  r={radius}
                  fill="transparent"
                  stroke="#1e293b"
                  strokeWidth={strokeWidth}
                />
                {/* Dilimler */}
                {activeTheoryDepts.map((d, idx) => {
                  const ratio = d.questions / examResult.totalQuestions;
                  const strokeDasharray = `${ratio * circumference} ${circumference}`;
                  const strokeDashoffset = -accumulatedOffset;
                  accumulatedOffset += ratio * circumference;
                  const color = getDepartmentColor(idx);
                  const isHovered = hoveredDept === d.name;

                  return (
                    <circle
                      key={d.name}
                      cx="110"
                      cy="110"
                      r={radius}
                      fill="transparent"
                      stroke={color}
                      strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="butt"
                      className="cursor-pointer transition-all duration-200"
                      onMouseEnter={() => setHoveredDept(d.name)}
                      onMouseLeave={() => setHoveredDept(null)}
                    />
                  );
                })}
              </svg>

              {/* Halka Ortası Bilgisi */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                {hoveredDept ? (
                  (() => {
                    const d = activeTheoryDepts.find(item => item.name === hoveredDept);
                    return (
                      <div className="space-y-0.5 px-4 animate-fade-in">
                        <div className="text-xs text-slate-300 font-semibold truncate max-w-[120px]">{d?.name}</div>
                        <div className="text-2xl font-black text-white">{d?.questions} <span className="text-xs text-indigo-400">Soru</span></div>
                        <div className="text-[10px] text-slate-400">%{d?.questionRatioPercent}</div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-0.5 text-center">
                    <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Toplam</span>
                    <div className="text-3xl font-black text-white">{examResult.totalQuestions}</div>
                    <span className="text-[11px] text-indigo-300 font-medium">Soru</span>
                  </div>
                )}
              </div>
            </div>

            {/* Renk Lejantı (Etkileşimli) */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-xs font-semibold text-slate-400 mb-1">Ders Başına Soru Payları:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                {activeTheoryDepts.map((d, idx) => {
                  const color = getDepartmentColor(idx);
                  const isHovered = hoveredDept === d.name;
                  return (
                    <div
                      key={d.name}
                      onMouseEnter={() => setHoveredDept(d.name)}
                      onMouseLeave={() => setHoveredDept(null)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                        isHovered 
                          ? 'bg-slate-800 border-indigo-500 text-white shadow' 
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="truncate font-medium">{d.name}</span>
                      </div>
                      <span className="font-bold text-white font-mono flex-shrink-0 ml-1">
                        {d.questions} Soru
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sınav Parametreleri Ayar Kartı */}
          <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Settings2 size={18} className="text-indigo-400" />
              <span>Sınav Ağırlık Ayarları</span>
            </h3>

            <div className="space-y-4 text-xs">
              {/* Toplam Soru Sayısı */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Toplam Teorik Soru Sayısı:</span>
                  <span className="font-bold text-white font-mono">{totalQuestions} Soru</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[100, 120, 80].map(cnt => (
                    <button
                      key={cnt}
                      onClick={() => setTotalQuestions(cnt)}
                      className={`py-1.5 rounded-lg border font-semibold transition ${
                        totalQuestions === cnt
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {cnt} Soru
                    </button>
                  ))}
                </div>
              </div>

              {/* Teorik / Pratik Ağırlık Dağılımı */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Kurul Notu Sınav Ağırlığı:</span>
                  <span className="font-bold text-indigo-300 font-mono">Teorik %{theoryWeight} • Pratik %{practiceWeight}</span>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden flex">
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${theoryWeight}%` }}
                    title={`Teorik: %${theoryWeight}`}
                  />
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${practiceWeight}%` }}
                    title={`Pratik: %${practiceWeight}`}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { t: 80, p: 20, label: '%80 / %20' },
                    { t: 85, p: 15, label: '%85 / %15' },
                    { t: 100, p: 0, label: 'Sadece Teorik' }
                  ].map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => { setTheoryWeight(preset.t); setPracticeWeight(preset.p); }}
                      className={`py-1.5 rounded-lg border font-semibold transition text-[11px] ${
                        theoryWeight === preset.t
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* İnteraktif Tıp Not Simülatörü */}
          <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Calculator size={18} className="text-indigo-400" />
              <span>Tahmini Not Simülatörü</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Tahmini Teorik Sınav Doğru / Puan (100 üzerinden):</span>
                  <span className="font-bold text-cyan-400 font-mono">{simTheoryScore}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={simTheoryScore}
                  onChange={(e) => setSimTheoryScore(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {practiceWeight > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Tahmini Pratik Sınav Puanı (100 üzerinden):</span>
                    <span className="font-bold text-emerald-400 font-mono">{simPracticeScore}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={simPracticeScore}
                    onChange={(e) => setSimPracticeScore(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Hesaplanan Toplam Kurul Notu:</div>
                  <div className={`text-2xl font-black ${simulatedTotalGrade >= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {simulatedTotalGrade} <span className="text-xs font-medium text-slate-400">/ 100</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    simulatedTotalGrade >= 60 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {simulatedTotalGrade >= 60 ? 'Geçer Düzey' : 'Baraj / Kritik'}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* SAĞ SÜTUN: DERS ETKİ TABLOSU VE KONTROLLER (7 KOLON) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 sm:p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Sliders size={18} className="text-indigo-400" />
                <span>Ders Bazında Sınav Etkisi & Soru Tablosu</span>
              </h3>
              <span className="text-xs text-slate-400">
                Sınava dahil olmayan dersleri tek tıkla devre dışı bırakabilirsiniz
              </span>
            </div>

            {/* Bilgilendirme Notu */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-300">
              <Info size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
              <p>
                <b>Grup Saati Kuralı:</b> G1 ve G2 için aynı içeriğe sahip tekrarlanan laboratuvar saatleri bir öğrencinin aldığı tekil saate (net saate) indirgenmiştir. Mesleki Beceri gibi pratik dersleri sadece uygulama sınavına etki edecek şekilde bağımsız yönetebilirsiniz.
              </p>
            </div>

            {/* Ders Tablosu / Listesi */}
            <div className="space-y-3 max-h-[50rem] overflow-y-auto pr-1">
              {examResult.departments.map((dept, idx) => {
                const color = getDepartmentColor(idx);
                const isExamActive = dept.includeInTheory || dept.includeInPractice;

                return (
                  <div
                    key={dept.name}
                    className={`p-4 rounded-xl border transition-all duration-200 glass-card space-y-3 ${
                      !isExamActive 
                        ? 'opacity-60 bg-slate-900/40 border-slate-800/60' 
                        : 'border-slate-800 hover:border-indigo-500/40'
                    }`}
                  >
                    {/* Üst Satır: İsim, Net Saatler ve Toplam Ağırlık */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <div>
                          <h4 className="font-bold text-sm sm:text-base text-white">{dept.name}</h4>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                            <span>Teorik: <b className="text-slate-200">{dept.netTheoryHours} Saat</b></span>
                            <span>•</span>
                            <span>Pratik: <b className="text-slate-200">{dept.netPracticeHours} Saat</b></span>
                            {dept.rawPracticeSlots > dept.netPracticeHours && (
                              <span className="text-[10px] text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded">
                                (G1/G2 tekrarı teke indirildi)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {dept.includeInTheory && dept.questions > 0 && (
                          <div className="px-3 py-1 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-black font-mono">
                            {dept.questions} Soru
                          </div>
                        )}
                        <div className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold font-mono">
                          %{dept.totalExamWeightPercent} Not Etkisi
                        </div>
                      </div>
                    </div>

                    {/* İlerleme Çubuğu (Görsel Dağılım) */}
                    {isExamActive && (
                      <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(dept.totalExamWeightPercent, 100)}%`,
                            backgroundColor: color
                          }}
                        />
                      </div>
                    )}

                    {/* Alt Kontroller: Sınava Dahil Etme Anahtarları */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-800/70 text-xs">
                      <div className="flex items-center gap-3">
                        {/* Teorik Sınav Toggle */}
                        <button
                          onClick={() => toggleTheoryExam(dept.name)}
                          className={`px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1.5 ${
                            dept.includeInTheory
                              ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          {dept.includeInTheory ? <Check size={13} className="text-cyan-400" /> : <X size={13} />}
                          <span>Teorik Sınav: {dept.includeInTheory ? 'Dahil' : 'Hariç'}</span>
                        </button>

                        {/* Pratik Sınav Toggle */}
                        {dept.netPracticeHours > 0 && (
                          <button
                            onClick={() => togglePracticeExam(dept.name)}
                            className={`px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1.5 ${
                              dept.includeInPractice
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-300'
                            }`}
                          >
                            {dept.includeInPractice ? <Check size={13} className="text-emerald-400" /> : <X size={13} />}
                            <span>Pratik Sınav: {dept.includeInPractice ? 'Dahil' : 'Hariç'}</span>
                          </button>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono">
                        {dept.includeInTheory && (
                          <span>Teorik Soru Payı: <b>%{dept.questionRatioPercent}</b></span>
                        )}
                        {dept.includeInPractice && dept.netPracticeHours > 0 && (
                          <span className="ml-2">• Pratik Puan: <b>{dept.practicePoints}p</b></span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

export default ExamAnalyticsView;
