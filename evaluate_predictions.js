// evaluate_predictions.js
const http = require('http');

function fetchApi(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } 
                catch(e) { resolve(null); }
            });
        }).on('error', reject);
    });
}

// MAIN EVALUATION LOOP
async function runEvaluation() {
    const testDates = ['21/02/2026'];
    
    for (const date of testDates) {
        console.log(`\n======================================================`);
        console.log(` GENERATING AI PREDICTIONS FOR: ${date}`);
        console.log(`======================================================\n`);
        
        // Fetch API Program
        const locData = await fetchApi(`http://localhost:3000/api/program?date=${encodeURIComponent(date)}`);
        
        if (!locData || !locData.locations) continue;

        for (const loc of locData.locations) {
            console.log(`\n--- ${loc.name} RACES ---`);
            const raceData = await fetchApi(`http://localhost:3000/api/location?locationId=${loc.id}&locationName=${encodeURIComponent(loc.name)}&date=${encodeURIComponent(date)}`);
            if (!raceData || !raceData.races) continue;

            for (const race of raceData.races) {
                const horseData = await fetchApi(`http://localhost:3000/api/race?locationId=${loc.id}&locationName=${encodeURIComponent(loc.name)}&raceId=${race.id}&date=${encodeURIComponent(date)}`);
                if (!horseData || !horseData.horses || horseData.horses.length === 0) continue;
                
                const apiHorses = horseData.horses;
                let validPredictions = 0;
                
                for (const h of apiHorses) {
                    const up = `http://localhost:3000/api/horse?horseId=${h.id}&distance=${race.distance}&trackType=${encodeURIComponent(race.trackType)}&date=${encodeURIComponent(date)}&city=${encodeURIComponent(loc.name)}&weight=${h.weight}&jockey=${encodeURIComponent(h.jockey)}&sire=${encodeURIComponent(h.sire || '')}&trainer=${encodeURIComponent(h.trainer || '')}&draw=${h.draw || ''}`;
                    const pData = await fetchApi(up);
                    h.pred = pData?.prediction;
                    if (h.pred && h.pred.predictedSeconds) validPredictions++;
                }
                
                if (validPredictions < 3) continue;
                
                apiHorses.sort((a,b) => (a.pred?.predictedSeconds || 999) - (b.pred?.predictedSeconds || 999));
                
                console.log(`Race: ${race.name} | ${race.distance}m ${race.trackType}`);
                console.log(`   1. ${apiHorses[0].name} (${apiHorses[0].pred.predictedTimeStr})`);
                console.log(`   2. ${apiHorses[1].name} (${apiHorses[1].pred.predictedTimeStr})`);
                console.log(`   3. ${apiHorses[2].name} (${apiHorses[2].pred.predictedTimeStr})`);
            }
        }
    }
}

runEvaluation();
