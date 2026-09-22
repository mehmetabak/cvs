import React, { useState, useMemo, useEffect } from 'react';
import { 
  PieChart, Sliders, Calculator, Layers, 
  BookOpen, Target, Settings2, RefreshCw, Info, Check, X, Percent,
  TrendingUp, Award, Zap, ShieldAlert, BarChart2,
  Calendar, Clock, Bot, Sparkles
} from 'lucide-react';
import { 
  computeDepartmentStats, 
  calculateExamDistribution, 
  calculateAutoWeights,
  computeWeeklyWorkload,
  computeStrategicMedicalInsights,
  getDepartmentColor 
} from '../utils/examAnalytics';

const ExamAnalyticsView = ({ events = [], kurulName = 'Kurul Programı' }) => {
  // Sınav Ayarları
  const [totalQuestions, setTotalQuestions] = useState(100);
  const [theoryWeight, setTheoryWeight] = useState(80);
  const [practiceWeight, setPracticeWeight] = useState(20);
  const [isAutoWeight, setIsAutoWeight] = useState(false);

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

  // Otomatik Ağırlık Hesabı (Müfredat ders saati oranından)
  const autoWeights = useMemo(() => {
    return calculateAutoWeights(departments);
  }, [departments]);

  // Otomatik mod aktifse ağırlıkları dinamik olarak eşitle
  useEffect(() => {
    if (isAutoWeight && autoWeights) {
      setTheoryWeight(autoWeights.theoryWeight);
      setPracticeWeight(autoWeights.practiceWeight);
    }
  }, [isAutoWeight, autoWeights]);

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

  // Hafta bazında teorik, pratik ve bağımsız çalışma yükü
  const weeklyWorkload = useMemo(() => {
    return computeWeeklyWorkload(events);
  }, [events]);

  // Yapay Zekâ Destekli Somut Tıp Strateji Değerlendirmeleri (No AI Slop)
  const strategicInsights = useMemo(() => {
    return computeStrategicMedicalInsights(examResult, weeklyWorkload, kurulName);
  }, [examResult, weeklyWorkload, kurulName]);

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
    setIsAutoWeight(false);
    setTheoryWeight(80);
    setPracticeWeight(20);
  };

  // Otomatik hesaplama modunu aç
  const enableAutoWeightMode = () => {
    setIsAutoWeight(true);
    if (autoWeights) {
      setTheoryWeight(autoWeights.theoryWeight);
      setPracticeWeight(autoWeights.practiceWeight);
    }
  };

  // Manuel ağırlık seç
  const selectManualWeight = (t, p) => {
    setIsAutoWeight(false);
    setTheoryWeight(t);
    setPracticeWeight(p);
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
      <div className="glass-panel rounded-xl p-10 text-center text-zinc-400 space-y-3">
        <BookOpen size={44} className="mx-auto text-zinc-600" />
        <h3 className="text-base font-bold text-zinc-200">Analiz edilecek ders bulunamadı</h3>
        <p className="text-xs text-zinc-500">Lütfen soldaki menüden bir kurul seçin veya ders programı yükleyin.</p>
      </div>
    );
  }

  // Donut Grafiği SVG Hesaplamaları
  const radius = 80;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  const activeTheoryDepts = examResult.departments.filter(d => d.questions > 0);
  const sortedAcademicDepts = [...examResult.departments]
    .filter(d => (d.includeInTheory && d.questions > 0) || (d.includeInPractice && d.practicePoints > 0))
    .sort((a, b) => b.totalExamWeightPercent - a.totalExamWeightPercent);

  return (
    <div className="space-y-6 animate-fade-in pb-12">

      {/* --- ÜST BİLGİ VE ANALİZ BAŞLIĞI --- */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-xl glass-panel">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 font-mono">
            <Target size={14} />
            <span>Komite & Sınav Ağırlık Analizi</span>
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-amber-400 text-[10px] font-bold border border-zinc-700 flex items-center gap-1">
              <Bot size={11} /> AI Destekli
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {kurulName} — Sınav Soru, Ağırlık & Müfredat Analizi
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Resmi müfredat saatleri ve tıp fakültesi sınav yönetmeliği baz alınarak hesaplanan net soru dağılımı, pratik puanları ve baraj cetveli.
          </p>
        </div>

        <button
          onClick={resetToDefaults}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition border border-zinc-700 flex-shrink-0"
        >
          <RefreshCw size={13} />
          <span>Ayarları Sıfırla</span>
        </button>
      </div>

      {/* --- 4 ADET ÖZET METRİK KARTI --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl glass-panel space-y-1">
          <div className="text-xs text-zinc-400 flex items-center justify-between">
            <span>Toplam Soru</span>
            <Target size={15} className="text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">
            {examResult.totalQuestions} <span className="text-xs font-normal text-zinc-500 font-sans">Soru</span>
          </div>
          <div className="text-[11px] text-zinc-500">Kurul Teorik Sınavı</div>
        </div>

        <div className="p-4 rounded-xl glass-panel space-y-1">
          <div className="text-xs text-zinc-400 flex items-center justify-between">
            <span>Net Teorik Yük</span>
            <BookOpen size={15} className="text-zinc-300" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono">
            {examResult.totalTheoryHours} <span className="text-xs font-normal text-zinc-500 font-sans">Saat</span>
          </div>
          <div className="text-[11px] text-zinc-500">Sınava dahil teorik dersler</div>
        </div>

        <div className="p-4 rounded-xl glass-panel space-y-1">
          <div className="text-xs text-zinc-400 flex items-center justify-between">
            <span>Net Pratik Yük</span>
            <Layers size={15} className="text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
            {examResult.totalPracticeHours} <span className="text-xs font-normal text-zinc-500 font-sans">Saat</span>
          </div>
          <div className="text-[11px] text-zinc-500">Öğrenci başına net lab/beceri</div>
        </div>

        <div className="p-4 rounded-xl glass-panel space-y-1">
          <div className="text-xs text-zinc-400 flex items-center justify-between">
            <span>Sınav Ağırlığı</span>
            <Percent size={15} className="text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono flex items-center gap-1.5">
            <span>%{theoryWeight} / %{practiceWeight}</span>
            {isAutoWeight && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-500/30 font-bold uppercase font-mono">
                Oto
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-500">
            {isAutoWeight ? '⚡ Ders saati oranından otomatik' : `Teorik %${theoryWeight} • Pratik %${practiceWeight}`}
          </div>
        </div>
      </div>

      {/* --- ORTA BÖLÜM: 2 SÜTUNLU GRAFİK & AYAR PANELİ --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* SOL SÜTUN: DONUT GRAFİĞİ, AYARLAR VE SİMÜLATÖR (5 KOLON) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* SVG Soru Dağılım Halkası */}
          <div className="p-5 rounded-xl glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <PieChart size={16} className="text-amber-400" />
                <span>Teorik Soru Sayısı Dağılımı ({examResult.totalQuestions} Soru)</span>
              </h3>
            </div>

            <div className="relative flex flex-col items-center justify-center pt-2">
              <svg width="210" height="210" viewBox="0 0 210 210" className="transform -rotate-90">
                {/* Arka plan çemberi */}
                <circle
                  cx="105"
                  cy="105"
                  r={radius}
                  fill="transparent"
                  stroke="#27272a"
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
                      cx="105"
                      cy="105"
                      r={radius}
                      fill="transparent"
                      stroke={color}
                      strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="butt"
                      className="cursor-pointer transition-all duration-150"
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
                      <div className="space-y-0.5 px-3 animate-fade-in">
                        <div className="text-xs text-zinc-300 font-semibold truncate max-w-[120px]">{d?.name}</div>
                        <div className="text-2xl font-black text-white font-mono">{d?.questions} <span className="text-xs text-amber-400">Soru</span></div>
                        <div className="text-[10px] text-zinc-400 font-mono">%{d?.questionRatioPercent}</div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-0.5 text-center">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Toplam</span>
                    <div className="text-3xl font-black text-white font-mono">{examResult.totalQuestions}</div>
                    <span className="text-[11px] text-amber-400 font-medium">Soru</span>
                  </div>
                )}
              </div>
            </div>

            {/* Renk Lejantı (Etkileşimli) */}
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <div className="text-xs font-semibold text-zinc-400 mb-1">Ders Başına Soru Payları:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {activeTheoryDepts.map((d, idx) => {
                  const color = getDepartmentColor(idx);
                  const isHovered = hoveredDept === d.name;
                  return (
                    <div
                      key={d.name}
                      onMouseEnter={() => setHoveredDept(d.name)}
                      onMouseLeave={() => setHoveredDept(null)}
                      className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between text-xs ${
                        isHovered 
                          ? 'bg-zinc-800 border-amber-400 text-white' 
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
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

          {/* Sınav Parametreleri & Otomatik Ağırlık Ayar Kartı */}
          <div className="p-5 rounded-xl glass-panel space-y-4">
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
              <Settings2 size={16} className="text-amber-400" />
              <span>Sınav Ağırlık Ayarları</span>
            </h3>

            <div className="space-y-4 text-xs">
              {/* Toplam Soru Sayısı */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-zinc-300">
                  <span>Toplam Teorik Soru Sayısı:</span>
                  <span className="font-bold text-white font-mono">{totalQuestions} Soru</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[100, 120, 80].map(cnt => (
                    <button
                      key={cnt}
                      onClick={() => setTotalQuestions(cnt)}
                      className={`py-1.5 rounded-lg border font-semibold transition ${
                        totalQuestions === cnt
                          ? 'bg-amber-400 text-zinc-950 font-bold border-amber-400'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                      }`}
                    >
                      {cnt} Soru
                    </button>
                  ))}
                </div>
              </div>

              {/* Teorik / Pratik Ağırlık Dağılımı ve Otomatik Mod */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between text-zinc-300">
                  <span>Kurul Notu Sınav Ağırlığı:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    Teorik %{theoryWeight} • Pratik %{practiceWeight}
                  </span>
                </div>

                {/* Görsel Dağılım Çubuğu */}
                <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden flex">
                  <div 
                    className="bg-amber-400 h-full transition-all duration-200"
                    style={{ width: `${theoryWeight}%` }}
                    title={`Teorik: %${theoryWeight}`}
                  />
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-200"
                    style={{ width: `${practiceWeight}%` }}
                    title={`Pratik: %${practiceWeight}`}
                  />
                </div>

                {/* Ağırlık Seçenekleri (Otomatik Hesapla Butonu Dahil) */}
                <div className="space-y-2 pt-1">
                  {/* Öne Çıkan Otomatik Hesapla Butonu */}
                  <button
                    onClick={enableAutoWeightMode}
                    className={`w-full py-2.5 px-3 rounded-lg border font-bold transition flex items-center justify-between text-xs ${
                      isAutoWeight
                        ? 'bg-zinc-800 text-amber-400 border-amber-400'
                        : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap size={14} className={isAutoWeight ? 'text-amber-400' : 'text-zinc-500'} />
                      <span>⚡ Otomatik Hesapla (Müfredat Oranı)</span>
                    </div>
                    <span className="font-mono bg-zinc-950 px-2 py-0.5 rounded text-[11px] text-zinc-300 border border-zinc-800">
                      %{autoWeights?.theoryWeight} / %{autoWeights?.practiceWeight}
                    </span>
                  </button>

                  {/* Manuel Ön Ayarlar */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { t: 80, p: 20, label: '%80 / %20' },
                      { t: 85, p: 15, label: '%85 / %15' },
                      { t: 100, p: 0, label: 'Sadece Teorik' }
                    ].map(preset => {
                      const isSelected = !isAutoWeight && theoryWeight === preset.t && practiceWeight === preset.p;
                      return (
                        <button
                          key={preset.label}
                          onClick={() => selectManualWeight(preset.t, preset.p)}
                          className={`py-1.5 rounded-lg border font-semibold transition text-[11px] ${
                            isSelected
                              ? 'bg-amber-400 text-zinc-950 font-bold border-amber-400'
                              : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {isAutoWeight && (
                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 flex items-start gap-2">
                      <Sparkles size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <b>Otomatik Oran Aktif:</b> Sınava dahil {autoWeights.totalTheory} saat teorik ve {autoWeights.totalPractice} saat pratik dersinden oranlandı (%{autoWeights.theoryWeight} T / %{autoWeights.practiceWeight} P).
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* İnteraktif Tıp Not Simülatörü */}
          <div className="p-5 rounded-xl glass-panel space-y-4">
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
              <Calculator size={16} className="text-amber-400" />
              <span>Tahmini Not Simülatörü</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-300">
                  <span>Tahmini Teorik Sınav Puanı (100 üzerinden):</span>
                  <span className="font-bold text-amber-400 font-mono">{simTheoryScore}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={simTheoryScore}
                  onChange={(e) => setSimTheoryScore(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              {practiceWeight > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-300">
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

              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs text-zinc-400">Hesaplanan Toplam Kurul Notu:</div>
                  <div className={`text-2xl font-black font-mono ${simulatedTotalGrade >= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {simulatedTotalGrade} <span className="text-xs font-medium text-zinc-500">/ 100</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono ${
                    simulatedTotalGrade >= 60 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {simulatedTotalGrade >= 60 ? 'Geçer Düzey' : 'Baraj / Kritik'}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* SAĞ SÜTUN: ETKİ GRAFİĞİ VE DERS KONTROLLERİ (7 KOLON) */}
        <div className="lg:col-span-7 space-y-5">

          {/* DERSLERİN TOPLAM KURUL NOTUNA ETKİ SIRALAMASI */}
          <div className="p-5 rounded-xl glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <BarChart2 size={16} className="text-amber-400" />
                <span>Derslerin Kurul Notuna Toplam Etki Sıralaması</span>
              </h3>
              <span className="text-xs text-zinc-500 font-mono">100 Puan Üzerinden</span>
            </div>

            <div className="space-y-2 pt-1">
              {sortedAcademicDepts.map((dept, idx) => {
                const color = getDepartmentColor(idx);
                const isHovered = hoveredDept === dept.name;

                return (
                  <div 
                    key={dept.name}
                    onMouseEnter={() => setHoveredDept(dept.name)}
                    onMouseLeave={() => setHoveredDept(null)}
                    className={`p-3 rounded-lg border transition-all ${
                      isHovered ? 'bg-zinc-800 border-amber-400' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-bold text-white text-sm">{dept.name}</span>
                        {dept.questions > 0 && (
                          <span className="text-[11px] text-zinc-400 font-mono">({dept.questions} Soru)</span>
                        )}
                        {dept.practicePoints > 0 && (
                          <span className="text-[11px] text-emerald-400 font-mono">({dept.practicePoints}p Pratik)</span>
                        )}
                      </div>
                      <span className="font-black text-white text-sm font-mono">
                        %{dept.totalExamWeightPercent}
                      </span>
                    </div>

                    {/* Yatay İlerleme Çubuğu */}
                    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden flex">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${Math.min(dept.totalExamWeightPercent, 100)}%`,
                          backgroundColor: color
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DERS BAZINDA SINAV DAHİL ETME LİSTESİ */}
          <div className="p-5 rounded-xl glass-panel space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <Sliders size={16} className="text-amber-400" />
                <span>Ders Bazında Sınav Filtreleri & Müfredat Saatleri</span>
              </h3>
              <span className="text-xs text-zinc-500">
                Sınava soru vermeyen dersleri devre dışı bırakabilirsiniz
              </span>
            </div>

            {/* Bilgilendirme Notu */}
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-400">
              <Info size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p>
                  <b className="text-zinc-200">Demolar / Tekrar Dersleri:</b> Sınav öncesi model ve preparat tekrarı niteliğinde olduğundan soru ve pratik puanı hesabına katılmaz.
                </p>
                <p>
                  <b className="text-zinc-200">Mesleki Beceri:</b> Teorik sınava soru vermez; doğrudan uygulama (pratik) sınavına dahil edilir.
                </p>
                <p>
                  <b className="text-zinc-200">Grup Saati:</b> G1 ve G2 için tekrarlanan laboratuvar seansları tekil öğrenci saatine indirgenmiştir.
                </p>
              </div>
            </div>

            {/* Ders Tablosu / Listesi */}
            <div className="space-y-2.5 max-h-[38rem] overflow-y-auto pr-1">
              {examResult.departments.map((dept, idx) => {
                const color = getDepartmentColor(idx);
                const isExamActive = dept.includeInTheory || dept.includeInPractice;

                return (
                  <div
                    key={dept.name}
                    className={`p-3.5 rounded-lg border transition-all glass-card space-y-2.5 ${
                      !isExamActive 
                        ? 'opacity-50 bg-zinc-950 border-zinc-800' 
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {/* Üst Satır: İsim, Net Saatler ve Toplam Ağırlık */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <div>
                          <h4 className="font-bold text-sm text-white">{dept.name}</h4>
                          <div className="text-[11px] text-zinc-400 flex items-center gap-2 flex-wrap">
                            <span>Teorik: <b className="text-zinc-200 font-mono">{dept.netTheoryHours}s</b></span>
                            <span>•</span>
                            <span>Pratik: <b className="text-zinc-200 font-mono">{dept.netPracticeHours}s</b></span>
                            {dept.demoHours > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-zinc-400 font-mono">
                                  Demo: <b className="text-zinc-300">{dept.demoHours}s</b> <span className="text-[10px] text-zinc-500">(Tekrar - Sınav Dışı)</span>
                                </span>
                              </>
                            )}
                            {dept.rawPracticeSlots > dept.netPracticeHours && (
                              <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.2 rounded font-mono">
                                (G1/G2 tekrarı teke indirildi)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {dept.includeInTheory && dept.questions > 0 && (
                          <div className="px-2.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-amber-400 text-xs font-bold font-mono">
                            {dept.questions} Soru
                          </div>
                        )}
                        <div className="px-2.5 py-0.5 rounded bg-zinc-900 text-zinc-300 text-xs font-bold font-mono border border-zinc-800">
                          %{dept.totalExamWeightPercent} Not Etkisi
                        </div>
                      </div>
                    </div>

                    {/* Alt Kontroller: Sınava Dahil Etme Anahtarları */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-zinc-800 text-xs">
                      <div className="flex items-center gap-2">
                        {/* Teorik Sınav Toggle */}
                        <button
                          onClick={() => toggleTheoryExam(dept.name)}
                          className={`px-2.5 py-1 rounded-md border font-semibold transition flex items-center gap-1.5 text-[11px] ${
                            dept.includeInTheory
                              ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:border-zinc-600'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-500'
                          }`}
                        >
                          {dept.includeInTheory ? <Check size={12} className="text-amber-400" /> : <X size={12} />}
                          <span>Teorik: {dept.includeInTheory ? 'Dahil' : 'Hariç'}</span>
                        </button>

                        {/* Pratik Sınav Toggle */}
                        {dept.netPracticeHours > 0 && (
                          <button
                            onClick={() => togglePracticeExam(dept.name)}
                            className={`px-2.5 py-1 rounded-md border font-semibold transition flex items-center gap-1.5 text-[11px] ${
                              dept.includeInPractice
                                ? 'bg-zinc-800 border-zinc-700 text-emerald-300 hover:border-zinc-600'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-500'
                            }`}
                          >
                            {dept.includeInPractice ? <Check size={12} className="text-emerald-400" /> : <X size={12} />}
                            <span>Pratik: {dept.includeInPractice ? 'Dahil' : 'Hariç'}</span>
                          </button>
                        )}
                      </div>

                      <div className="text-[11px] text-zinc-500 font-mono">
                        {dept.includeInTheory && (
                          <span>Soru Payı: <b className="text-zinc-300">%{dept.questionRatioPercent}</b></span>
                        )}
                        {dept.includeInPractice && dept.netPracticeHours > 0 && (
                          <span className="ml-2">• Pratik: <b className="text-emerald-400">{dept.practicePoints}p</b></span>
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

      {/* --- HAFTALIK DERS VE ÇALIŞMA YÜKÜ ZAMAN ÇİZELGESİ --- */}
      {weeklyWorkload && weeklyWorkload.weeks.length > 0 && (
        <div className="p-5 rounded-xl glass-panel space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 font-mono">
                <Calendar size={13} />
                <span>Haftalık Yük Dağılımı</span>
              </div>
              <h3 className="text-base font-bold text-white">
                Haftalık Müfredat & Çalışma Yükü Grafiği
              </h3>
            </div>
            {weeklyWorkload.peakWeek && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-amber-400 text-xs font-bold font-mono">
                <TrendingUp size={13} />
                <span>Zirve: {weeklyWorkload.peakWeek}. Hafta ({weeklyWorkload.maxWeeklyHours}s Ders)</span>
              </div>
            )}
          </div>

          {/* Haftalık Bar Grafiği */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-1">
            {weeklyWorkload.weeks.map(w => {
              const isPeak = w.week === weeklyWorkload.peakWeek;
              const maxScale = Math.max(weeklyWorkload.maxWeeklyHours, 40);
              const theoryHeight = (w.theoryHours / maxScale) * 100;
              const practiceHeight = (w.practiceHours / maxScale) * 100;
              const studyHeight = (w.selfStudyHours / maxScale) * 100;

              return (
                <div 
                  key={w.week}
                  className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                    isPeak 
                      ? 'bg-zinc-850 border-amber-400/50' 
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-white">{w.week}. Hafta</span>
                    {isPeak && (
                      <span className="text-[10px] px-1 rounded bg-amber-400/10 text-amber-400 font-bold font-mono">Zirve</span>
                    )}
                  </div>

                  {/* Sütun Çubuğu */}
                  <div className="h-28 bg-zinc-950 rounded p-1 flex flex-col-reverse gap-1 border border-zinc-800">
                    {/* Bağımsız Çalışma */}
                    {studyHeight > 0 && (
                      <div 
                        className="bg-zinc-600 rounded transition-all duration-200"
                        style={{ height: `${studyHeight}%` }}
                        title={`Bağımsız Çalışma: ${w.selfStudyHours} Saat`}
                      />
                    )}
                    {/* Pratik */}
                    {practiceHeight > 0 && (
                      <div 
                        className="bg-emerald-500 rounded transition-all duration-200"
                        style={{ height: `${practiceHeight}%` }}
                        title={`Pratik / Lab: ${w.practiceHours} Saat`}
                      />
                    )}
                    {/* Teorik */}
                    {theoryHeight > 0 && (
                      <div 
                        className="bg-amber-400 rounded transition-all duration-200"
                        style={{ height: `${theoryHeight}%` }}
                        title={`Teorik Ders: ${w.theoryHours} Saat`}
                      />
                    )}
                  </div>

                  {/* Alt Bilgi */}
                  <div className="mt-2 pt-2 border-t border-zinc-800 text-[11px] text-zinc-300 space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Ders:</span>
                      <span className="font-bold text-white font-mono">{w.academicHours}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Çalışma:</span>
                      <span className="font-mono text-zinc-400">{w.selfStudyHours}s</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lejant */}
          <div className="flex items-center justify-center gap-6 pt-1 text-xs text-zinc-400 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-amber-400" />
              <span>Teorik Dersler</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
              <span>Pratik / Laboratuvar</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-zinc-600" />
              <span>Bağımsız Çalışma Saati</span>
            </div>
          </div>
        </div>
      )}

      {/* --- BARAJ EŞİK CETVELİ VE ÇALIŞMA VERİMLİLİĞİ (ROI) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* BARAJ ANALİZİ: TIP FAKÜLTESİ %50 BARAJ KURALI */}
        <div className="p-5 rounded-xl glass-panel space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-400" />
              <h3 className="font-bold text-white text-sm sm:text-base">Tıp Fakültesi %50 Baraj Eşik Cetveli</h3>
            </div>
            <span className="text-[11px] text-amber-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded font-mono font-bold">
              Yönetmelik Kuralı
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Tıp fakültesi sınav yönetmeliği gereğince, her anabilim dalından soru sayısının en az %50'si kadar doğru yapılması zorunludur. Barajın altında kalınan her eksik doğru için genel toplam netinizden <b>kesinti</b> yapılır.
          </p>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {strategicInsights?.barajSubjects.map(sub => (
              <div 
                key={sub.name}
                className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-white">{sub.name}</div>
                  <div className="text-[11px] text-zinc-400">
                    Toplam Soru: <b className="text-zinc-200 font-mono">{sub.questions} Soru</b>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-500">Geçer Eşik:</div>
                    <div className="font-black text-amber-400 text-sm font-mono">
                      ≥ {sub.barajThreshold} Doğru
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold font-mono ${
                    sub.riskLevel === 'Yüksek Risk'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : sub.riskLevel === 'Orta Risk'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    {sub.riskLevel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ÇALIŞMA VERİMLİLİĞİ: DERS SAATİ / SORU GETİRİSİ (YIELD INDEX) */}
        <div className="p-5 rounded-xl glass-panel space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-amber-400" />
              <h3 className="font-bold text-white text-sm sm:text-base">Soru Başına Ders Saati & Çalışma Getirisi</h3>
            </div>
            <span className="text-[11px] text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded font-mono font-bold">
              Verim İndeksi
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Hangi dersin kaç saatlik müfredatından 1 soru çıktığını ve pratik katkısını gösterir. Düşük saat/soru oranı ve pratik puanı içeren dersler çalışma süreniz için en yüksek puan getirisini sunar.
          </p>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {strategicInsights?.yieldRanks.map(item => (
              <div 
                key={item.name}
                className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-white">{item.name}</div>
                  <div className="text-[11px] text-zinc-400">
                    <span className="font-mono">{item.netTheoryHours}s</span> teorik → <span className="font-mono">{item.questions}</span> soru
                    {item.practicePoints > 0 && <span className="text-emerald-400 ml-1.5 font-semibold font-mono">+{item.practicePoints}p Pratik</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-500">1 Soru Başına:</div>
                    <div className="font-black text-zinc-100 text-sm font-mono">
                      {item.hoursPerQuestion}s
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold font-mono ${
                    item.badgeColor === 'emerald'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : item.badgeColor === 'cyan'
                        ? 'bg-amber-400/10 text-amber-400 border border-amber-500/20'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    {item.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* --- YAPAY ZEKÂ DESTEKLİ KURUL DEĞERLENDİRMESİ & STRATEJİK ÖNERİLER (SADE & SOMUT) --- */}
      {strategicInsights && (
        <div className="p-5 sm:p-6 rounded-xl glass-panel space-y-4">
          {/* AI Başlık ve Şeffaf Doğrulama Bilgisi */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                <Bot size={15} />
                <span>🤖 Yapay Zekâ Destekli Kurul Analizi (Müfredat Verisi Tabanlı)</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {kurulName} — Stratejik Sınav & Çalışma Değerlendirmesi
              </h3>
            </div>
            <div className="text-left sm:text-right text-[11px] text-zinc-500 max-w-xs">
              Bu analizler; ders saati oranları, soru payları ve komite baraj kuralı algoritmaları kullanılarak yapay zekâ tarafından oluşturulmuştur.
            </div>
          </div>

          {/* 4 Adet Somut Strateji Kartı */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">

            {/* Kart 1: Ana Omurga ve Lokomotif Dersler */}
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Target size={15} />
                <h4>Kurulun Ana Omurgası (%{strategicInsights.cumulativeWeight} Ağırlık)</h4>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                Bu kurulun kaderini <b>{strategicInsights.corePillars.map(p => `${p.name} (%${p.totalExamWeightPercent})`).join(' ve ')}</b> anabilim dalları belirlemektedir. Bu dersler tek başına sınav notunun <b>%{strategicInsights.cumulativeWeight}</b>'lik bölümünü oluşturur. Bu derslerde sağlam temel atmadan kuruldan geçer not almak matematiksel olarak mümkün değildir.
              </p>
            </div>

            {/* Kart 2: Pratik Sınavının Kaldıraç Etkisi */}
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Layers size={15} />
                <h4>Pratik Sınav Kaldıraç Etkisi (%{practiceWeight} Sınav Payı)</h4>
              </div>
              <div className="text-zinc-300 leading-relaxed space-y-1.5">
                {practiceWeight > 0 && strategicInsights.practiceDepts.length > 0 ? (
                  <>
                    <p>
                      Pratik sınav 100 puan üzerinden <b>%{practiceWeight}</b> ağırlığa sahiptir ve kurul notunuza doğrudan <b>{practiceWeight}.0 net puan</b> etki eder. Özellikle <b>{strategicInsights.practiceDepts.map(p => `${p.name} (${p.practicePoints}p)`).join(', ')}</b> gibi pratik saatleri, teorik sınavdaki yaklaşık <b>~{Math.round((strategicInsights.totalPracticePoints * (practiceWeight / 100)) / (theoryWeight / 100 || 1))} teorik soruya</b> eşdeğer bir not yükseltme kaldıracı sunar.
                    </p>
                    {strategicInsights.mbDept && (
                      <p className="text-emerald-300 text-[11px] bg-emerald-950/20 p-2 rounded border border-emerald-500/30">
                        • <b>Mesleki Beceri:</b> Teorik soru vermemekte, doğrudan uygulama sınavı ({strategicInsights.mbDept.practicePoints}p) üzerinden pratik sınav puanınıza dahil edilmektedir.
                      </p>
                    )}
                    {strategicInsights.totalDemoHours > 0 && (
                      <p className="text-zinc-400 text-[11px]">
                        • <b>Demo/Tekrar Dersleri:</b> Kuruldaki toplam {strategicInsights.totalDemoHours} saatlik demo dersleri sınav öncesi pekiştirme niteliğinde olduğundan soru ve sınav puanı hesabının dışında tutulmuştur.
                      </p>
                    )}
                  </>
                ) : (
                  <p>
                    Bu kurulda pratik sınav bulunmamaktadır. Kurul notunun %100'ü doğrudan teorik sınavdan geleceği için çalışma sürenizin tamamını teorik konu kavrama ve soru çözümüne ayırmalısınız.
                    {strategicInsights.totalDemoHours > 0 && (
                      <span className="block mt-1 text-zinc-400 text-[11px]">
                        (Kuruldaki {strategicInsights.totalDemoHours} saatlik demo oturumları sınav tekrarı niteliğinde olup soru üretmez.)
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Kart 3: Kritik Baraj Yönetimi */}
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <ShieldAlert size={15} />
                <h4>Kritik Baraj Yönetimi & Risk Önleme</h4>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                Kurulda soru sayısı en yüksek olan <b>{strategicInsights.barajSubjects.slice(0, 2).map(b => `${b.name} (${b.questions} soru / ${b.barajThreshold} baraj)`).join(' ve ')}</b> dersleri en yüksek baraj riski taşır. Baraj sınırının altında kalınan her soru genel notunuzdan düşeceğinden, soru sayısı çok olan derslerde seçici konu atlamaktan kaçınılmalıdır.
              </p>
            </div>

            {/* Kart 4: Haftalık Yük ve Çalışma Zamanlaması */}
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-zinc-300 font-bold text-sm">
                <Clock size={15} />
                <h4>Müfredat Zamanlaması & Tekrar Stratejisi</h4>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                {strategicInsights.peakWeekObj ? (
                  <>
                    Ders yükü <b>{strategicInsights.peakWeekObj.week}. haftada</b> zirveye ulaşmaktadır ({strategicInsights.peakWeekObj.academicHours} saat aktif ders). Kurulun ilk haftalarında teorik temel inşa edilirken; son haftalarda artan bağımsız çalışma saatleri ve demo tekrarları soru çözümü ve çıkmış sorular için en elverişli zaman penceresidir.
                  </>
                ) : (
                  <>
                    Haftalık ders saatleri dengeli dağıtılmıştır. Düzenli günlük tekrar ile sınav öncesi yığılma önlenmelidir.
                  </>
                )}
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ExamAnalyticsView;
