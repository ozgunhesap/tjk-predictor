"use client";

import { useState, useEffect } from 'react';
import { MapPin, Trophy, ChevronRight, Activity, CalendarDays, ArrowLeft, BarChart3, RotateCcw } from 'lucide-react';
import Link from 'next/link';

interface Location { id: string; name: string; }
interface Race { id: string; number: number; time: string; name: string; distance?: number; trackType?: string; }
interface Horse { id: string; number: string; name: string; age: string; weight: string; jockey: string; recentForm: string; sire?: string; trainer?: string; draw?: number; handicap?: number; }
interface Prediction { predictedSeconds: number | null; predictedTimeStr: string | null; confidence: number; relevantRacesCount: number; }

interface RaceEvaluation {
  raceNumber: number;
  distance: number;
  trackType: string;
  score: number; // 0-100
  topPicksText: string;
  bankerText: string;
  isBanker: boolean;
  aiPicks: { name: string, number: string, predictedTime: string, actualPosition: number | null }[];
}

export default function EvaluatePage() {
  type TargetDate = 'past1' | 'past2' | 'past3';
  const [targetDateLabel, setTargetDateLabel] = useState<TargetDate>('past1');
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  
  const [races, setRaces] = useState<Race[]>([]);
  const [evaluations, setEvaluations] = useState<RaceEvaluation[]>([]);
  
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, text: '' });

  const getFormattedDate = (type: TargetDate) => {
    const d = new Date();
    if (type === 'past1') d.setDate(d.getDate() - 1);
    else if (type === 'past2') d.setDate(d.getDate() - 2);
    else if (type === 'past3') d.setDate(d.getDate() - 3);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  };

  useEffect(() => {
    const dateQuery = getFormattedDate(targetDateLabel);
    setLocations([]);
    setSelectedLocation(null);
    setRaces([]);
    setEvaluations([]);

    fetch(`/api/program?date=${encodeURIComponent(dateQuery)}`)
      .then(res => res.json())
      .then(data => {
        if (data.locations) setLocations(data.locations);
      })
      .catch(console.error);
  }, [targetDateLabel]);

  const handleSelectLocation = async (loc: Location) => {
    setSelectedLocation(loc);
    setRaces([]);
    setEvaluations([]);
    
    try {
      const dateQuery = getFormattedDate(targetDateLabel);
      const res = await fetch(`/api/location?locationId=${loc.id}&locationName=${encodeURIComponent(loc.name)}&date=${encodeURIComponent(dateQuery)}`);
      const data = await res.json();
      if (data.races) setRaces(data.races);
    } catch (e) { console.error(e); }
  };

  const evaluateDay = async () => {
    if (!selectedLocation || races.length === 0) return;
    
    setIsEvaluating(true);
    setEvaluations([]);
    setProgress({ current: 0, total: races.length, text: 'Başlanıyor...' });
    
    const dateQuery = getFormattedDate(targetDateLabel);
    // TJK format from history is usually DD.MM.YYYY, the input date is DD/MM/YYYY.
    const historyDateMatcher = dateQuery.replace(/\//g, '.');

    const newEvals: RaceEvaluation[] = [];

    for (let i = 0; i < races.length; i++) {
      const r = races[i];
      setProgress({ current: i + 1, total: races.length, text: `${r.number}. Koşu verileri indiriliyor...` });

      try {
        const hRes = await fetch(`/api/race?locationId=${selectedLocation.id}&locationName=${encodeURIComponent(selectedLocation.name)}&raceId=${r.id}&date=${encodeURIComponent(dateQuery)}`);
        const hData = await hRes.json();
        const horseList: Horse[] = hData.horses || [];

        if (!r.distance || !r.trackType || horseList.length === 0) {
            newEvals.push({ raceNumber: r.number, distance: r.distance || 0, trackType: r.trackType || 'Bilinmiyor', score: 0, topPicksText: 'Yetersiz Veri', aiPicks: [], bankerText: 'İptal / Veri Yok', isBanker: false });
            continue;
        }

        const allHistories: Record<string, any[]> = {};
        await Promise.all(horseList.map(async (horse) => {
          try {
            const res = await fetch(`/api/horse?horseId=${horse.id}`);
            const data = await res.json();
            if (data.history) allHistories[horse.name] = data.history;
          } catch (e) {}
        }));

        setProgress({ current: i + 1, total: races.length, text: `${r.number}. Koşu analiz ediliyor...` });

        // Build predictions and get ACTUAL results from the matched history date
        const horseResults: { horse: Horse, pred: Prediction, actualPos: number | null }[] = [];

        await Promise.all(horseList.map(async (horse) => {
          try {
            const horseHistory = allHistories[horse.name];
            if (!horseHistory) return;

            // Find actual position on target day
            const actRace = horseHistory.find((hist: any) => hist.date === historyDateMatcher);
            const actualPos = actRace ? parseInt(actRace.position) : null;

            const otherRacesMin: Record<string, any[]> = {};
            Object.entries(allHistories).forEach(([name, hist]) => {
              if (name === horse.name) return;
              otherRacesMin[name] = hist.map(rh => ({ raceId: rh.raceId, position: rh.position, date: rh.date }));
            });

            const pRes = await fetch('/api/predict', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                history: horseHistory,
                distance: r.distance,
                trackType: r.trackType,
                date: dateQuery, // Target date limits past evaluation
                city: selectedLocation.name,
                weight: horse.weight,
                jockey: horse.jockey,
                sire: horse.sire || '',
                trainer: horse.trainer || '',
                draw: horse.draw ? Number(horse.draw) : undefined,
                handicap: horse.handicap ? Number(horse.handicap) : undefined,
                otherRaces: otherRacesMin
              })
            });

            const pData = await pRes.json();
            if (pData.prediction) {
               horseResults.push({ horse, pred: pData.prediction, actualPos: isNaN(actualPos!) ? null : actualPos });
            }
          } catch (e) {}
        }));

        // Sort horses by AI prediction
        horseResults.sort((a, b) => {
          const pA = a.pred.predictedSeconds;
          const pB = b.pred.predictedSeconds;
          if (pA && pB) return pA - pB;
          if (pA) return -1;
          if (pB) return 1;
          return 0;
        });

        // Limit top 3 
        const top3 = horseResults.slice(0, 3);
        
        // Banker / Risk Analysis
        let bankerText = "";
        let isBanker = false;
        const horsesWithTime = horseResults.filter(h => h.pred.predictedSeconds);
        const missingCount = horseList.length - horsesWithTime.length;
        const top1 = horsesWithTime[0];
        const top2 = horsesWithTime[1];

        if (horseList.length < 4) {
             bankerText = "Riskli (Kayıt Az)";
        } else if (missingCount >= 2) {
             bankerText = `Riskli (${missingCount} At Kapalı Kutu)`;
        } else if (top1 && top2) {
             const margin = (top2.pred.predictedSeconds || 0) - (top1.pred.predictedSeconds || 0);
             if (top1.pred.confidence < 70) {
                 bankerText = "Riskli (Güven Düşük)";
             } else if (top1.pred.relevantRacesCount < 2) {
                 bankerText = "Riskli (Veri Az)";
             } else if (margin < 0.75) {
                 bankerText = `Zor Koşu (Fark: ${margin.toFixed(2)}s)`;
             } else {
                 bankerText = `TEK: ${top1.horse.name}`;
                 isBanker = true;
             }
        }
        
        let score = 0;
        
        // Zaman Farkları (Margin to 1st Pick)
        const time1 = top3[0]?.pred?.predictedSeconds;
        const time2 = top3[1]?.pred?.predictedSeconds;
        const time3 = top3[2]?.pred?.predictedSeconds;

        const margin2 = (time2 && time1) ? (time2 - time1) : 0;
        const margin3 = (time3 && time1) ? (time3 - time1) : 0;
        
        // Puanlama Mantığı (Top 3 üzerinden)
        if (top3[0]?.actualPos === 1) {
            score = 100; // 1. Favori Kazandı: Tam Puan!
        } else if (top3[1]?.actualPos === 1) {
            // 2. Favori kazandı ama 1. ile arasındaki yapay zeka zaman farkına göre puan verilir.
            // Aralarında uçurum varsa, yapay zeka aslında fena yanılmıştır.
            if (margin2 < 1.0) score = 75;       // Burun buruna öngörülmüş (Çok İyi)
            else if (margin2 < 2.5) score = 40;  // Makul Fark (İdare Eder)
            else score = 10;                     // Uçurum Fark (Kötü Tahmin)
        } else if (top3[2]?.actualPos === 1) {
            // 3. Favori kazandı
            if (margin3 < 1.5) score = 40;       // Yakın öngörülmüş
            else if (margin3 < 3.0) score = 20;  // Makul Fark
            else score = 5;                      // Uçurum Fark (Kötü Tahmin)
        } else {
            // İlk 3 favoriden hiçbiri kazanamadıysa "Tabela" (İlk 4) puanlarına bak.
            if (top3[0]?.actualPos === 2) score = 40;
            else if (top3[0]?.actualPos === 3) score = 20;
            else if (top3[0]?.actualPos === 4) score = 10;
            
            if (top3[1]?.actualPos === 2) score = Math.max(score, margin2 < 2.0 ? 30 : 10);
            else if (top3[1]?.actualPos === 3) score = Math.max(score, margin2 < 2.0 ? 15 : 5);
            else if (top3[1]?.actualPos === 4) score = Math.max(score, margin2 < 2.0 ? 5 : 0);
            
            if (top3[2]?.actualPos === 2) score = Math.max(score, margin3 < 2.0 ? 20 : 5);
            else if (top3[2]?.actualPos === 3) score = Math.max(score, margin3 < 2.0 ? 10 : 0);
        }

        score = Math.min(100, Math.max(0, score)); // Sınırla 0-100

        let summary = "Zayıf Tahmin";
        if (score >= 80) summary = "Mükemmel Hedef";
        else if (score >= 55) summary = "İsabetli";
        else if (score >= 30) summary = "Makul/Averaj";

        if (top3.length < 3) summary = "Yetersiz Veri";

        newEvals.push({
            raceNumber: r.number,
            distance: r.distance,
            trackType: r.trackType,
            score: top3.length < 3 ? 0 : score,
            topPicksText: summary,
            bankerText,
            isBanker,
            aiPicks: horseResults.slice(0, 5).map(hr => ({
                name: hr.horse.name,
                number: hr.horse.number,
                predictedTime: hr.pred.predictedTimeStr || '-',
                actualPosition: hr.actualPos
            }))
        });

      } catch (e) {
          console.error(e);
      }
    }
    
    setEvaluations(newEvals);
    setIsEvaluating(false);
  };

  const getDayAverage = () => {
      if (evaluations.length === 0) return 0;
      const valids = evaluations.filter(e => e.topPicksText !== "Yetersiz Veri");
      if (valids.length === 0) return 0;
      const sum = valids.reduce((acc, curr) => acc + curr.score, 0);
      return Math.round(sum / valids.length);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-6 md:p-12">
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 flex items-center gap-3">
            <Link href="/" className="hover:scale-110 transition-transform p-2 bg-zinc-900 rounded-full border border-zinc-800 text-zinc-400 hover:text-white">
               <ArrowLeft className="w-5 h-5" />
            </Link>
            Geçmiş Değerlendirmesi
          </h1>
          <p className="text-zinc-400 mt-2 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            AI Tahmin Başarısı & Geriye Dönük Analiz (Skor 0-100)
          </p>
        </div>
        <div className="flex w-full md:w-auto overflow-x-auto scrollbar-hide bg-zinc-900 border border-zinc-800 rounded-lg p-1 whitespace-nowrap">
          <button
            onClick={() => setTargetDateLabel('past3')}
            className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${targetDateLabel === 'past3' ? 'bg-violet-500/20 text-violet-400' : 'text-zinc-400 hover:text-zinc-200'}`}
          >-3 Gün</button>
          <div className="w-px bg-zinc-800 mx-1"></div>
          <button
            onClick={() => setTargetDateLabel('past2')}
            className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${targetDateLabel === 'past2' ? 'bg-violet-500/20 text-violet-400' : 'text-zinc-400 hover:text-zinc-200'}`}
          >-2 Gün</button>
          <div className="w-px bg-zinc-800 mx-1"></div>
          <button
            onClick={() => setTargetDateLabel('past1')}
            className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${targetDateLabel === 'past1' ? 'bg-violet-500/20 text-violet-400' : 'text-zinc-400 hover:text-zinc-200'}`}
          >-1 Gün (Dün)</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-2">Şehirler</h2>
            <div className="flex flex-col gap-2">
              {locations.length === 0 ? (
                <div className="text-zinc-500 text-sm px-2">Veri bekleniyor...</div>
              ) : (
                locations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => handleSelectLocation(loc)}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${selectedLocation?.id === loc.id ? 'bg-zinc-800 text-white shadow-lg shadow-zinc-950' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className={`w-4 h-4 ${selectedLocation?.id === loc.id ? 'text-violet-400' : ''}`} />
                      <span className="font-medium">{loc.name}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
            
            {selectedLocation && races.length > 0 && (
                <button
                  onClick={evaluateDay}
                  disabled={isEvaluating}
                  className="mt-6 w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-violet-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RotateCcw className={`w-5 h-5 ${isEvaluating ? 'animate-spin' : ''}`} />
                  Günü Skorla
                </button>
            )}
          </div>
        </div>

        {/* Evaluation Board */}
        <div className="lg:col-span-9">
            {isEvaluating ? (
               <div className="h-full min-h-[400px] flex flex-col items-center justify-center border border-zinc-800 rounded-2xl bg-zinc-900/50">
                  <Activity className="w-12 h-12 text-violet-400 animate-pulse mb-6" />
                  <p className="text-lg font-medium text-zinc-200 mb-2">{progress.text}</p>
                  <div className="w-64 h-2 bg-zinc-800 rounded-full overflow-hidden mt-4">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                  </div>
                  <p className="text-sm text-zinc-500 mt-3">{progress.current} / {progress.total} Koşu Değerlendirildi</p>
               </div>
            ) : evaluations.length > 0 ? (
               <div className="animate-in fade-in zoom-in-95 duration-500">
                  <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 overflow-hidden mb-8 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                     <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2 text-zinc-100">
                           {selectedLocation?.name} Genel AI Skoru
                        </h2>
                        <p className="text-zinc-400 text-sm mt-1">{getFormattedDate(targetDateLabel)} gününün {evaluations.length} yarış ortalaması</p>
                     </div>
                     <div className="flex items-center justify-center bg-zinc-950 p-4 rounded-2xl border border-zinc-800 shadow-inner">
                         <span className={`text-5xl font-extrabold ${getDayAverage() >= 60 ? 'text-emerald-400' : getDayAverage() >= 40 ? 'text-yellow-400' : 'text-rose-400'}`}>
                             {getDayAverage()}
                         </span>
                         <span className="text-2xl text-zinc-500 font-bold ml-1">/100</span>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {evaluations.map((ev, idx) => (
                        <div key={idx} className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden hover:border-violet-500/50 transition-colors">
                           <div className="p-4 border-b border-zinc-800/50 bg-zinc-900/80 flex justify-between items-center">
                              <div>
                                 <h3 className="font-bold text-zinc-200"><span className="text-violet-400 mr-1">{ev.raceNumber}.</span> Koşu</h3>
                                 <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-zinc-500">{ev.distance}m {ev.trackType}</span>
                                    {ev.bankerText && (
                                       <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${ev.isBanker ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                          {ev.bankerText}
                                       </span>
                                    )}
                                 </div>
                              </div>
                              <div className={`px-3 py-1 rounded-full text-xs font-bold ${ev.score >= 60 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : ev.score >= 30 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                                 {ev.score} Puan - {ev.topPicksText}
                              </div>
                           </div>
                           <div className="p-0">
                               <table className="w-full text-left text-sm">
                                   <thead>
                                       <tr className="bg-zinc-950/50 text-xs text-zinc-500 border-b border-zinc-800">
                                            <th className="px-4 py-2 font-medium">AI Tahmin Sırası</th>
                                            <th className="px-4 py-2 font-medium text-right">Gerçekte Ne Oldu?</th>
                                       </tr>
                                   </thead>
                                   <tbody className="divide-y divide-zinc-800/30">
                                       {ev.aiPicks.map((pick, pIdx) => (
                                           <tr key={pIdx} className={pick.actualPosition === 1 ? 'bg-emerald-950/20' : ''}>
                                               <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs text-zinc-500">#{pIdx + 1}</span>
                                                        <span className={`font-semibold ${pIdx < 3 ? 'text-zinc-200' : 'text-zinc-500'}`}>{pick.name}</span>
                                                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1 rounded">{pick.number}</span>
                                                    </div>
                                               </td>
                                               <td className="px-4 py-3 text-right">
                                                    {pick.actualPosition ? (
                                                        <div className={`inline-flex items-center gap-1 font-bold ${pick.actualPosition === 1 ? 'text-emerald-400' : pick.actualPosition <= 3 ? 'text-yellow-400' : 'text-zinc-600'}`}>
                                                            {pick.actualPosition === 1 && <Trophy className="w-3 h-3" />}
                                                            {pick.actualPosition}. Oldu
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-600 text-xs font-medium">Derece Dışı K.</span>
                                                    )}
                                               </td>
                                           </tr>
                                       ))}
                                   </tbody>
                               </table>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            ) : (
               <div className="h-full min-h-[400px] flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl text-zinc-500 bg-zinc-900/20">
                  <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                  <p>Sol taraftan bir şehir seçip "Günü Skorla" butonuna tıklayın.</p>
               </div>
            )}
        </div>
      </main>
    </div>
  );
}
