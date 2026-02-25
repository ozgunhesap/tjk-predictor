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

// target Date: 20/02/2026 (Yesterday)
// Wait, today is 22nd. 
// Dün = 21/02/2026
// -2 Gün = 20/02/2026

async function run() {
    // Pick a horse from 20/02/2026 (Izmir)
    const url = 'http://localhost:3000/api/horse?horseId=110059&distance=1400&trackType=Kum&date=20/02/2026&city=İzmir&weight=58&jockey=O.YILDIZ';
    const data = await fetchApi(url);
    if (!data) return console.log("NO DATA");
    
    console.log("Prediction:", data.prediction);
    console.log("History Length Raw:", data.history?.length);
    if (data.history?.length > 0) {
        console.log("Sample History Race 0 Date:", data.history[0].date);
        console.log("Sample History Race 1 Date:", data.history[1].date);
        
        let targetDate = '20/02/2026';
        const filtered = data.history.filter(race => {
             // Mimic predictor.ts fallback logic
             if (targetDate && race.date && race.date.replace(/\./g, '/') === targetDate.replace(/\./g, '/')) {
                return false;
             }
             return true; 
        });
        console.log("Filtered Length after Target Date drop:", filtered.length);
        
        // Wait, if it dropped ALL historical dates, that means the targetDate logic is buggy.
        // Actually, predictor.ts:
        // let relevantRaces = history.filter(race => ... ) 
        // But what if the horse hasn't run BEFORE 20/02/2026? Then history is empty.
        // BUT wait, TJK history endpoint includes the race ON 20/02/2026! So if we filter out >= 20/02/2026, we might get 0 races if it was their first run? Unlikely to happen for ALL horses.
        
        // No wait, the logic MUST filter out targetDate AND ANY DATE AFTER targetDate to truly simulate past predictions.
        // But predictor.ts currently only filters `=== targetDate`! It doesn't filter out futuristic races! 
        // Oh, and if predictor.ts only filters strict equality, why is it yielding 0?
    }
}
run();
