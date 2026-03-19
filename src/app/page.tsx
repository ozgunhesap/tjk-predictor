"use client";

import { useState, useEffect } from 'react';
import { MapPin, Clock, Trophy, ChevronRight, Activity, CalendarDays, X } from 'lucide-react';
import Link from 'next/link';

interface Location {
  id: string;
  name: string;
}

interface Race {
  id: string;
  number: number;
  time: string;
  name: string;
  distance?: number;
  trackType?: string;
}

interface Horse {
  id: string;
  number: string;
  name: string;
  age: string;
  weight: string;
  jockey: string;
  recentForm: string;
  sire?: string;
  trainer?: string;
  draw?: number;
  handicap?: number;
}

interface Prediction {
  predictedSeconds: number | null;
  predictedTimeStr: string | null;
  confidence: number;
  relevantRacesCount: number;
  h2hAdjustments?: { horseName: string, adjustment: number }[];
  classQualityScore?: number;
}

export default function Home() {
  type TargetDate = 'today' | 'tomorrow' | 'past1' | 'past2' | 'past3';
  const [targetDateLabel, setTargetDateLabel] = useState<TargetDate>('today');
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [isLoadingRaces, setIsLoadingRaces] = useState(false);

  const [horses, setHorses] = useState<Horse[]>([]);
  const [isLoadingHorses, setIsLoadingHorses] = useState(false);

  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);

  const [isGeneratingTicket, setIsGeneratingTicket] = useState(false);
  const [ticketProgress, setTicketProgress] = useState({ current: 0, total: 6, text: '' });
  const [altiliTickets, setAltiliTickets] = useState<{ budget: string, cost: number, legs: { raceNumber: number, picks: (Horse & { pred?: Prediction })[] }[] }[] | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  // State for manual actual results (Mapping Race Number -> Winning Horse Number)
  const [actualResults, setActualResults] = useState<Record<number, string>>({});

  const getFormattedDate = (type: TargetDate) => {
    const d = new Date();
    if (type === 'tomorrow') d.setDate(d.getDate() + 1);
    else if (type === 'past1') d.setDate(d.getDate() - 1);
    else if (type === 'past2') d.setDate(d.getDate() - 2);
    else if (type === 'past3') d.setDate(d.getDate() - 3);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  useEffect(() => {
    const dateQuery = getFormattedDate(targetDateLabel);

    // Clear selections when date changes
    setLocations([]);
    setSelectedLocation(null);
    setRaces([]);
    setSelectedRace(null);
    setHorses([]);
    setPredictions({});

    fetch(`/api/program?date=${encodeURIComponent(dateQuery)}`)
      .then(res => res.json())
      .then(data => {
        if (data.locations) {
          setLocations(data.locations);
        }
      })
      .catch(console.error);
  }, [targetDateLabel]);

  const handleSelectLocation = async (loc: Location) => {
    setSelectedLocation(loc);
    setSelectedRace(null);
    setHorses([]);
    setPredictions({});
    setIsLoadingRaces(true);

    try {
      const dateQuery = getFormattedDate(targetDateLabel);
      const res = await fetch(`/api/location?locationId=${loc.id}&locationName=${encodeURIComponent(loc.name)}&date=${encodeURIComponent(dateQuery)}`);
      const data = await res.json();
      if (data.races) {
        setRaces(data.races);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingRaces(false);
    }
  };

  const handleSelectRace = async (race: Race) => {
    setSelectedRace(race);
    setHorses([]);
    setPredictions({});
    setIsLoadingHorses(true);
    setIsLoadingPredictions(true);

    try {
      // 1. Fetch horses
      if (!selectedLocation) return;
      const dateQuery = getFormattedDate(targetDateLabel);
      const res = await fetch(`/api/race?locationId=${selectedLocation.id}&locationName=${encodeURIComponent(selectedLocation.name)}&raceId=${race.id}&date=${encodeURIComponent(dateQuery)}`);
      const data = await res.json();

      if (data.horses) {
        setHorses(data.horses);

        // 2. Fetch predictions in parallel if distance and trackType exist
        if (race.distance && race.trackType) {
          fetchPredictionsForHorses(data.horses, race.distance, race.trackType, dateQuery, selectedLocation.name);
        } else {
          setIsLoadingPredictions(false);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingHorses(false);
    }
  };

  const fetchPredictionsForHorses = async (horseList: Horse[], distance: number, trackType: string, date: string, city: string) => {
    const newPredictions: Record<string, Prediction> = {};
    const allHistories: Record<string, any[]> = {};

    // 1. Fetch all histories first (for H2H)
    await Promise.all(
      horseList.map(async (horse) => {
        try {
          const res = await fetch(`/api/horse?horseId=${horse.id}`);
          const data = await res.json();
          if (data.history) allHistories[horse.name] = data.history;
        } catch (e) { }
      })
    );

    // 2. Fetch predictions with H2H awareness (POST)
    await Promise.all(
      horseList.map(async (horse) => {
        try {
          const horseHistory = allHistories[horse.name];
          if (!horseHistory) return;

          // Minimize otherRaces to reduce payload size
          const otherRacesMin: Record<string, any[]> = {};
          Object.entries(allHistories).forEach(([name, hist]) => {
            if (name === horse.name) return;
            otherRacesMin[name] = hist.map(r => ({ raceId: r.raceId, position: r.position, date: r.date }));
          });

          const res = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              history: horseHistory,
              distance,
              trackType,
              date,
              city,
              weight: horse.weight,
              jockey: horse.jockey,
              sire: horse.sire || '',
              trainer: horse.trainer || '',
              draw: horse.draw ? (Number(horse.draw) || undefined) : undefined,
              handicap: horse.handicap ? (Number(horse.handicap) || undefined) : undefined,
              otherRaces: otherRacesMin,
              raceName: race.name
            })
          });

          const data = await res.json();
          if (data.prediction) {
            newPredictions[horse.id] = data.prediction;
          }
        } catch (e) {
          console.error("Prediction loop error:", e);
        }
      })
    );

    setPredictions(newPredictions);
    setIsLoadingPredictions(false);
  };

  // Sort horses by prediction
  const sortedHorses = [...horses].sort((a, b) => {
    const predA = predictions[a.id]?.predictedSeconds;
    const predB = predictions[b.id]?.predictedSeconds;

    if (predA && predB) return predA - predB;
    if (predA) return -1;
    if (predB) return 1;
    return parseInt(a.number) - parseInt(b.number);
  });

  const generateAltiliTickets = async () => {
    if (!selectedLocation || races.length < 6) {
      alert("Bu şehirde yeterli koşu bulunmuyor (En az 6 koşu gerekli).");
      return;
    }
    const altiliRaces = races.slice(-6); // Genellikle son 6 koşu Altılı Ganyan'dır.

    setIsGeneratingTicket(true);
    setShowTicketModal(true);
    setAltiliTickets(null);
    setTicketProgress({ current: 0, total: 6, text: 'Koşular analiz ediliyor...' });

    const dateQuery = getFormattedDate(targetDateLabel);

    // 1. Fetch all horses and predictions for these 6 races
    const raceData: { race: Race, horses: (Horse & { pred: Prediction })[], riskFactor: number }[] = [];

    for (let i = 0; i < altiliRaces.length; i++) {
      const r = altiliRaces[i];
      setTicketProgress({ current: i + 1, total: 6, text: `${r.number}. Koşu tahminleri hesaplanıyor...` });

      try {
        const hRes = await fetch(`/api/race?locationId=${selectedLocation.id}&locationName=${encodeURIComponent(selectedLocation.name)}&raceId=${r.id}&date=${encodeURIComponent(dateQuery)}`);
        const hData = await hRes.json();

        const horseList: Horse[] = hData.horses || [];
        const horsesWithPreds: (Horse & { pred: Prediction })[] = [];

        if (r.distance && r.trackType) {
          const allHistories: Record<string, any[]> = {};

          setTicketProgress({ current: i + 1, total: 6, text: `${r.number}. Koşu: Geçmiş veriler taranıyor...` });
          await Promise.all(horseList.map(async (horse) => {
            try {
              const res = await fetch(`/api/horse?horseId=${horse.id}`);
              const data = await res.json();
              if (data.history) allHistories[horse.name] = data.history;
            } catch (e) { }
          }));

          setTicketProgress({ current: i + 1, total: 6, text: `${r.number}. Koşu: H2H Analizi ve Tahminler...` });
          // Fetch predictions concurrently for the race (POST)
          await Promise.all(horseList.map(async (horse) => {
            try {
              const horseHistory = allHistories[horse.name];
              if (!horseHistory) {
                horsesWithPreds.push({ ...horse, pred: { predictedSeconds: null, predictedTimeStr: null, confidence: 0, relevantRacesCount: 0 } });
                return;
              }

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
                  date: dateQuery,
                  city: selectedLocation.name,
                  weight: horse.weight,
                  jockey: horse.jockey,
                  sire: horse.sire || '',
                  trainer: horse.trainer || '',
                  draw: horse.draw ? (Number(horse.draw) || undefined) : undefined,
                  handicap: horse.handicap ? (Number(horse.handicap) || undefined) : undefined,
                  otherRaces: otherRacesMin,
                  raceName: r.name
                })
              });

              const pData = await pRes.json();
              horsesWithPreds.push({ ...horse, pred: pData.prediction || { predictedSeconds: null, predictedTimeStr: null, confidence: 0, relevantRacesCount: 0 } });
            } catch (e) {
              horsesWithPreds.push({ ...horse, pred: { predictedSeconds: null, predictedTimeStr: null, confidence: 0, relevantRacesCount: 0 } });
            }
          }));
        }

        // Sort horses by prediction
        const sorted = horsesWithPreds.sort((a, b) => {
          const predA = a.pred.predictedSeconds;
          const predB = b.pred.predictedSeconds;
          if (predA && predB) return predA - predB;
          if (predA) return -1;
          if (predB) return 1;
          return parseInt(a.number) - parseInt(b.number);
        });

        // 1.5 Calculate Risk Factor for this race
        const missingDataCount = horsesWithPreds.filter(h => !h.pred.predictedSeconds).length;
        const totalCount = horsesWithPreds.length;
        const topConfidence = sorted[0]?.pred.confidence || 0;

        // Risk = (Percentage of unknown horses) + (Low confidence of the top pick)
        const riskFactor = (totalCount > 0 ? (missingDataCount / totalCount) : 0) + ((100 - topConfidence) / 100);

        raceData.push({ race: r, horses: sorted, riskFactor });
      } catch (e) {
        console.error(e);
      }
    }

    setTicketProgress({ current: 6, total: 6, text: 'Yapay Zeka kupon kombinasyonları oluşturuyor...' });

    // 2. Build combinations
    const buildTicket = (maxBudget: number, unitPrice: number) => {
      const maxCombinations = Math.floor(maxBudget / unitPrice);
      const picks = [1, 1, 1, 1, 1, 1];
      let currentCombinations = 1;

      while (true) {
        let bestLegIndex = -1;
        let smallestAdjustedDeficit = Infinity;

        for (let i = 0; i < 6; i++) {
          const nextHorseIndex = picks[i];
          const legData = raceData[i];
          const horsesInLeg = legData.horses;
          if (nextHorseIndex >= horsesInLeg.length) continue;

          const nextHorse = horsesInLeg[nextHorseIndex];
          const topHorse = horsesInLeg[0];

          // Base time difference
          let timeDiff = nextHorse.pred.predictedSeconds
            ? (nextHorse.pred.predictedSeconds - (topHorse.pred.predictedSeconds || 0))
            : 999;

          // RISK-AWARE ADJUSTMENT:
          // If a race has high 'riskFactor' (missing data or low top confidence), 
          // we artificially SHRINK the timeDiff so the algorithm is more likely to add more horses to this race.
          const adjustedDiff = timeDiff / (1 + (legData.riskFactor * 0.8)); // 0.8 is the "sensitivity" to risk

          const newCombinations = (currentCombinations / picks[i]) * (picks[i] + 1);
          if (newCombinations <= maxCombinations) {
            if (adjustedDiff < smallestAdjustedDeficit) {
              smallestAdjustedDeficit = adjustedDiff;
              bestLegIndex = i;
            }
          }
        }

        if (bestLegIndex === -1) break;

        currentCombinations = (currentCombinations / picks[bestLegIndex]) * (picks[bestLegIndex] + 1);
        picks[bestLegIndex]++;
      }

      const legs = raceData.map((rd, i) => ({
        raceNumber: rd.race.number,
        picks: rd.horses.slice(0, picks[i])
      }));

      return { legs, cost: currentCombinations * unitPrice };
    };

    const unitPrice = 1.25; // Standard TJK unit price for 2026
    const tickets = [
      { budget: "250 TL (Orta Risk/İdeal)", ...buildTicket(250, unitPrice) },
      { budget: "500 TL (Yüksek Risk/Geniş)", ...buildTicket(500, unitPrice) },
    ];

    setAltiliTickets(tickets);
    setIsGeneratingTicket(false);
  };


  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-6 md:p-12">
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            TJK Predictor
          </h1>
          <p className="text-zinc-400 mt-2 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            AI-Powered Race Projections
          </p>
        </div>
        <div className="flex w-full md:w-auto overflow-x-auto scrollbar-hide bg-zinc-900 border border-zinc-800 rounded-lg p-1 whitespace-nowrap">
          <button
            onClick={() => setTargetDateLabel('past3')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${targetDateLabel === 'past3' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
          >-3 Gün</button>
          <button
            onClick={() => setTargetDateLabel('past2')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${targetDateLabel === 'past2' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
          >-2 Gün</button>
          <button
            onClick={() => setTargetDateLabel('past1')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${targetDateLabel === 'past1' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
          >Dün</button>
          <div className="w-px bg-zinc-800 mx-1"></div>
          <button
            onClick={() => setTargetDateLabel('today')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${targetDateLabel === 'today' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'} `}
          >
            <CalendarDays className="w-4 h-4" />
            Bugün
          </button>
          <button
            onClick={() => setTargetDateLabel('tomorrow')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${targetDateLabel === 'tomorrow' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'} `}
          >
            <Activity className="w-4 h-4" />
            Yarın
          </button>
          <div className="w-px bg-zinc-800 mx-1"></div>
          <Link
            href="/evaluate"
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-violet-500/10 text-violet-400 hover:bg-violet-500/20"
          >
            <Trophy className="w-4 h-4" />
            Geçmiş Değerlendirmesi
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Locations */}
          <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-2">Locations</h2>
            <div className="flex flex-col gap-2">
              {locations.length === 0 ? (
                <div className="text-zinc-500 text-sm px-2">Loading...</div>
              ) : (
                locations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => handleSelectLocation(loc)}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${selectedLocation?.id === loc.id ? 'bg-zinc-800 text-white shadow-lg shadow-zinc-950' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className={`w-4 h-4 ${selectedLocation?.id === loc.id ? 'text-emerald-400' : ''}`} />
                      <span className="font-medium">{loc.name}</span>
                    </div>
                    {selectedLocation?.id === loc.id && <ChevronRight className="w-4 h-4 text-emerald-400" />}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Races */}
          {selectedLocation && (
            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-2">Races in {selectedLocation.name}</h2>
              <div className="flex flex-col gap-2">
                {isLoadingRaces ? (
                  <div className="text-zinc-500 text-sm px-2 animate-pulse">Fetching races...</div>
                ) : (
                  races.map(race => (
                    <button
                      key={race.id}
                      onClick={() => handleSelectRace(race)}
                      className={`flex flex-col items-start p-3 rounded-xl transition-all border ${selectedRace?.id === race.id ? 'bg-zinc-800 border-zinc-700 shadow-lg' : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-white"><span className="text-emerald-400 mr-1">{race.number}.</span> Koşu</span>
                        <div className="flex items-center gap-1 text-xs font-semibold bg-zinc-950 px-2 py-1 rounded">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          {race.time}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-zinc-500">
                        {race.distance}m • {race.trackType}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {!isLoadingRaces && races.length >= 6 && (
                <button
                  onClick={generateAltiliTickets}
                  disabled={isGeneratingTicket}
                  className="mt-4 w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Trophy className="w-5 h-5" />
                  Yapay Zeka Altılı Üret
                </button>
              )}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-9">
          {!selectedRace ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl text-zinc-500 bg-zinc-900/20">
              <Trophy className="w-12 h-12 mb-4 opacity-50" />
              <p>Select a location and a race to see predictions.</p>
            </div>
          ) : (
            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
              <div className="p-6 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <span className="text-emerald-400">{selectedRace.number}. Koşu</span>
                    <span className="text-zinc-500 font-normal">|</span>
                    <span>{selectedLocation?.name}</span>
                  </h2>
                  <p className="mt-1 text-zinc-400 text-sm">{selectedRace.distance}m • {selectedRace.trackType}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-mono">{selectedRace.time}</div>
                </div>
              </div>

              {(() => {
                  let bankerText = "";
                  let isBanker = false;
                  
                  if (selectedRace && sortedHorses.length > 0 && !isLoadingPredictions && !isLoadingHorses) {
                      const horsesWithTime = sortedHorses.filter(h => predictions[h.id]?.predictedSeconds);
                      const missingCount = sortedHorses.length - horsesWithTime.length;
                      const top1 = horsesWithTime[0];
                      const top2 = horsesWithTime[1];

                      if (sortedHorses.length < 4) {
                          bankerText = "Riskli Koşu (Kayıt Az / Tahmin Zor)";
                      } else if (missingCount >= 2) {
                          bankerText = `Riskli Koşu (${missingCount} Atın Yeterli Verisi Yok, Kapalı Kutu)`;
                      } else if (top1 && top2) {
                          const p1 = predictions[top1.id];
                          const p2 = predictions[top2.id];
                          const margin = (p2.predictedSeconds || 0) - (p1.predictedSeconds || 0);
                          
                          if (p1.confidence < 70) {
                              bankerText = `Riskli Koşu (AI İlk Elemana Güvenmiyor: %${p1.confidence})`;
                          } else if (p1.relevantRacesCount < 2) {
                              bankerText = "Riskli Koşu (İlk Elemanın Yarış Geçmişi Çok Az)";
                          } else if (margin < 0.75) {
                              bankerText = `Zor/Riskli Koşu (İlk İki At Arasındaki Seçim Çok Ufak: ${margin.toFixed(2)}s)`;
                          } else {
                              bankerText = `SİSTEM TEK ÖNERİSİ: ${top1.number} - ${top1.name} (Rakibine ${margin.toFixed(2)}sn Fark Attı)`;
                              isBanker = true;
                          }
                      }
                  }

                  if (!bankerText) return null;

                  return (
                      <div className={`px-6 py-3 border-b flex items-center justify-between font-medium text-sm
                          ${isBanker ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-300' : 'bg-rose-950/20 border-rose-900/30 text-rose-300'}
                      `}>
                          <div className="flex items-center gap-2">
                              {isBanker ? <Trophy className="w-5 h-5 text-emerald-400" /> : <Activity className="w-5 h-5 text-rose-400" />}
                              <span>{bankerText}</span>
                          </div>
                      </div>
                  );
              })()}

              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950 border-b border-zinc-800">
                      <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">No</th>
                      <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Horse</th>
                      <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Jockey / Weight</th>
                      <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Recent Form</th>
                      <th className="p-4 text-xs font-semibold text-emerald-400 uppercase tracking-wider text-right">Predicted Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {isLoadingHorses ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-zinc-500 animate-pulse">
                          Loading horses...
                        </td>
                      </tr>
                    ) : sortedHorses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-zinc-500">
                          No horses found for this race.
                        </td>
                      </tr>
                    ) : (
                      sortedHorses.map((horse, idx) => {
                        const prediction = predictions[horse.id];
                        const isTopPick = idx === 0 && prediction && prediction.predictedSeconds;

                        // Calculate margin against the top pick
                        let marginStr = "";
                        if (!isTopPick && prediction?.predictedSeconds && predictions[sortedHorses[0].id]?.predictedSeconds) {
                          const margin = prediction.predictedSeconds - (predictions[sortedHorses[0].id].predictedSeconds || 0);
                          marginStr = `+${margin.toFixed(2)}s`;
                        }

                        // Determine confidence color
                        let confColor = "text-zinc-500";
                        if (prediction && prediction.confidence) {
                          if (prediction.confidence >= 80) confColor = "text-emerald-400";
                          else if (prediction.confidence >= 50) confColor = "text-yellow-400";
                          else confColor = "text-rose-400";
                        }

                        return (
                          <tr key={horse.id} className={`transition-all hover:bg-zinc-800/80 ${isTopPick ? 'bg-emerald-950/20' : ''}`}>
                            <td className="p-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isTopPick ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-2 ring-emerald-400/50' : 'bg-zinc-800 border border-zinc-700 text-zinc-300'}`}>
                                {horse.number}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-xl text-zinc-100 flex items-center gap-2">
                                {horse.name}
                                {isTopPick && <Trophy className="w-4 h-4 text-emerald-400" />}
                              </div>
                              <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                                <span>{horse.age}</span>
                                {horse.sire && (
                                  <>
                                    <span className="text-zinc-700">•</span>
                                    <span>{horse.sire}</span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="text-sm font-semibold text-zinc-200">{horse.jockey}</div>
                              <div className="text-xs text-zinc-500 mt-0.5">{horse.weight} kg <span className="text-zinc-700 mx-1">|</span> {horse.trainer || 'Bilinmiyor'}</div>
                            </td>
                            <td className="p-4">
                              <div className="font-mono text-sm tracking-widest text-zinc-300 bg-zinc-950 px-2 py-1 rounded inline-block border border-zinc-800">{horse.recentForm}</div>
                            </td>
                            <td className="p-4 text-right">
                              {isLoadingPredictions ? (
                                <div className="flex flex-col items-end gap-2">
                                  <div className="w-24 h-6 bg-zinc-800 rounded animate-pulse"></div>
                                  <div className="w-16 h-3 bg-zinc-800 rounded animate-pulse"></div>
                                </div>
                              ) : prediction?.predictedTimeStr ? (
                                <div className="flex flex-col items-end gap-1 relative">
                                  <div className="flex items-baseline gap-2">
                                    {marginStr && <span className="text-xs font-mono text-rose-400">{marginStr}</span>}
                                    <span className={`font-mono text-2xl font-bold tracking-tight ${isTopPick ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'text-zinc-100'}`}>
                                      {prediction.predictedTimeStr}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider font-semibold mt-1">
                                    <div className={`flex items-center gap-1.5 ${confColor}`} title="AI Confidence Score">
                                      <Activity className="w-3.5 h-3.5" />
                                      {prediction.confidence}% Güven
                                    </div>
                                    <span className="text-zinc-700">•</span>
                                    <span title="Past relevant races analyzed by AI" className="text-zinc-500">
                                      {prediction.relevantRacesCount} Yarış
                                    </span>
                                    {prediction.classQualityScore && (
                                      <>
                                        <span className="text-zinc-700">•</span>
                                        <span title="Average quality of historical races (G1, G2 etc.)" className="text-cyan-400">
                                          %{prediction.classQualityScore} Kalite
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  {prediction.h2hAdjustments && prediction.h2hAdjustments.length > 0 && (
                                    <div className="mt-1 flex flex-wrap justify-end gap-1">
                                      {prediction.h2hAdjustments.map((h2h, i) => (
                                        <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded border ${h2h.adjustment < 0 ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-rose-950/30 border-rose-900/50 text-rose-400'}`} title={`H2H vs ${h2h.horseName}`}>
                                          {h2h.adjustment < 0 ? '🏆' : '📉'} {h2h.horseName}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-zinc-600 outline outline-1 outline-zinc-800 px-3 py-1 rounded-full text-xs font-medium">Yetersiz Veri</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* AI Ticket Modal */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="sticky top-0 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-emerald-500 to-cyan-500 p-2 rounded-lg">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Yapay Zeka Altılı Tahminleri</h2>
                  <p className="text-sm text-zinc-400">{selectedLocation?.name} • {getFormattedDate(targetDateLabel)}</p>
                </div>
              </div>
              <button onClick={() => setShowTicketModal(false)} className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {isGeneratingTicket ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Activity className="w-12 h-12 text-emerald-400 animate-pulse mb-6" />
                  <p className="text-lg font-medium text-zinc-200 mb-2">{ticketProgress.text}</p>
                  <div className="w-64 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500" style={{ width: `${(ticketProgress.current / ticketProgress.total) * 100}%` }}></div>
                  </div>
                  <p className="text-sm text-zinc-500 mt-3">{ticketProgress.current} / {ticketProgress.total} Koşu Analiz Edildi</p>
                </div>
              ) : altiliTickets ? (
                <div className="flex flex-col gap-8">
                  {altiliTickets.map((ticket, tIdx) => (
                    <div key={tIdx} className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
                      <div className="bg-zinc-800/30 px-6 py-3 border-b border-zinc-800 flex justify-between items-center">
                        <h3 className="font-bold text-zinc-200">{ticket.budget} Miktar</h3>
                        <div className="text-emerald-400 font-mono font-bold bg-emerald-950/30 px-3 py-1 rounded border border-emerald-900/50">
                          {ticket.cost.toFixed(2)} TL
                        </div>
                      </div>
                      <div className="p-1 overflow-x-auto">
                        <table className="w-full text-center divide-x divide-zinc-800">
                          <thead>
                            <tr className="bg-zinc-900/50 text-xs text-zinc-500 uppercase tracking-wider">
                              {ticket.legs.map((leg, i) => (
                                <th key={i} className="py-2 px-2 w-1/6 align-bottom">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-zinc-300">Ayak {i + 1}</span>
                                    <span className="text-[10px] lowercase text-zinc-600 mb-1">({leg.raceNumber}. Koşu)</span>
                                    <input
                                      type="text"
                                      placeholder="Sonuç No"
                                      maxLength={2}
                                      className="w-16 bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-xs text-center text-white focus:border-emerald-500 outline-none transition-colors"
                                      value={actualResults[leg.raceNumber] || ''}
                                      onChange={(e) => setActualResults(prev => ({ ...prev, [leg.raceNumber]: e.target.value }))}
                                      title="Gerçekleşen kazanan at numarasını girerek tahmini test et"
                                    />
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800 align-top">
                            <tr>
                              {ticket.legs.map((leg, i) => {
                                const actualWinner = actualResults[leg.raceNumber]?.trim();
                                const isHit = actualWinner ? leg.picks.some(h => h.number === actualWinner) : null;

                                return (
                                  <td key={i} className={`py-4 px-2 ${isHit === true ? 'bg-emerald-950/20' : isHit === false ? 'bg-rose-950/10' : 'bg-zinc-950/50'} transition-colors`}>
                                    <div className="flex flex-col gap-2 relative">
                                      {leg.picks.length === 1 && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg shadow-rose-500/20 z-10 whitespace-nowrap">BANKO</div>}
                                      {leg.picks.map((horse, idx) => {
                                        const isWinner = actualWinner === horse.number;

                                        // Calculate margin to top horse in this leg
                                        let marginStr = "";
                                        if (idx > 0 && horse.pred?.predictedSeconds && leg.picks[0].pred?.predictedSeconds) {
                                          const margin = horse.pred.predictedSeconds - leg.picks[0].pred.predictedSeconds;
                                          marginStr = `+${margin.toFixed(2)}s`;
                                        }

                                        return (
                                          <div key={horse.id} className={`p-2 rounded border flex flex-col items-center justify-center text-center gap-1 transition-all
                                            ${isWinner ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.3)] ring-1 ring-emerald-400 scale-105 z-10' :
                                              idx === 0 ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-zinc-900 border-zinc-800'}
                                          `}>
                                            <div className="flex w-full justify-between items-start">
                                              <div className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-bold flex items-center justify-center">{horse.number}</div>
                                              {idx === 0 && <Trophy className="w-3 h-3 text-emerald-500 mt-1 opacity-70" />}
                                            </div>
                                            <div className={`text-[11px] font-bold leading-tight truncate w-full mt-0.5 ${isWinner ? 'text-emerald-300' : 'text-zinc-200'}`} title={horse.name}>{horse.name}</div>

                                            <div className="flex flex-col items-center mt-0.5">
                                              <div className={`text-[10px] font-mono ${idx === 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                                {horse.pred?.predictedTimeStr || '-'}
                                              </div>
                                              {marginStr && <div className="text-[9px] text-rose-400/80 font-mono mt-0.5">{marginStr}</div>}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
