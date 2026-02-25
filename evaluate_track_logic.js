import { getTodayLocations, getRacesForLocation, getHorsesForRace, getHorseHistory } from './src/lib/tjk.js';
import { predictRaceTime } from './src/lib/predictor.js';

async function main() {
    const targetDate = '24/02/2026';
    const locs = await getTodayLocations(targetDate);
    const adana = locs.find(l => l.name.toLowerCase().includes('adana'));
    if (!adana) return;

    const races = await getRacesForLocation(adana.id, adana.name, targetDate);
    
    let totalRaces = 0;
    let fallbackUsedCount = 0;
    
    // We will simulate 2 races to see how many horses exactly rely on the fallback.
    for (const r of races) {
        if (r.number === 5 || r.number === 7) {
            totalRaces++;
            const horses = await getHorsesForRace(adana.id, adana.name, targetDate, r.id);
            const distance = r.distance || 0;
            const trackType = r.trackType || 'Kum';
            
            for (const horse of horses) {
                const history = await getHorseHistory(horse.id);
                const weight = parseFloat(horse.weight.replace(',', '.'));
                
                // Manually trace the fallback logic inside predictor.ts
                const parseDateStr = (dStr) => {
                    if (!dStr) return 0;
                    const pts = dStr.split(/[\/\.]/);
                    if (pts.length === 3) return new Date(parseInt(pts[2]), parseInt(pts[1]) - 1, parseInt(pts[0])).getTime();
                    return 0;
                };
                const targetTimeMs = parseDateStr(targetDate);
                const maxDistanceDiff = distance * 0.15;
                
                let relevantRaces = history.filter(race => {
                    if (targetTimeMs > 0 && race.date && parseDateStr(race.date) >= targetTimeMs) return false;
                    if (race.city && (race.city.toLowerCase().includes('şanlıurfa') || race.city.toLowerCase().includes('diyarbakır'))) return false;
                    const isValidTime = race.time && race.time !== "Derecesiz" && race.time.includes('.');
                    return race.trackType === trackType && Math.abs(race.distance - distance) <= maxDistanceDiff && isValidTime;
                });
                
                if (relevantRaces.length < 2) {
                    const fallbackRaces = history.filter(race => {
                        if (targetTimeMs > 0 && race.date && parseDateStr(race.date) >= targetTimeMs) return false;
                        if (race.city && (race.city.toLowerCase().includes('şanlıurfa') || race.city.toLowerCase().includes('diyarbakır'))) return false;
                        const isValidTime = race.time && race.time !== "Derecesiz" && race.time.includes('.');
                        return Math.abs(race.distance - distance) <= maxDistanceDiff && isValidTime;
                    });
                    if (fallbackRaces.length > relevantRaces.length) {
                        fallbackUsedCount++;
                        console.log(`[FALLBACK FIRED] Race ${r.number}, Horse ${horse.number} (${horse.name}) had only ${relevantRaces.length} valid ${trackType} races, but had ${fallbackRaces.length} total races in distance range.`);
                    }
                }
            }
        }
    }
    
    console.log(`\nFound ${fallbackUsedCount} horses relying on cross-track fallback out of the 2 races tested.`);
}

main().catch(console.error);
