import { getTodayLocations, getRacesForLocation, getHorsesForRace, getHorseHistory } from './src/lib/tjk.js';

async function main() {
    const locs = await getTodayLocations('24/02/2026');
    const adana = locs.find(l => l.name.toLowerCase().includes('adana'));
    if (!adana) return;
    
    const races = await getRacesForLocation(adana.id, adana.name, '24/02/2026');
    console.log("Races 5 and 7 track types:");
    races.forEach(r => {
        if (r.number === 5 || r.number === 7) {
            console.log(`Race ${r.number}: [${r.trackType}] len: ${r.trackType ? r.trackType.length : 'undefined'}`);
        }
    });
}
main();
