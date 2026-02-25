const http = require('http');
function fetchApi(url) { return new Promise(r => http.get(url, (res) => { let d = ''; res.on('data', c=>d+=c); res.on('end', ()=>r(JSON.parse(d))); })); }
async function run() {
    // 19/02/2026 İzmir Race 1 
    const p = await fetchApi('http://localhost:3000/api/horse?horseId=106734&distance=1200&trackType=Kum&date=19/02/2026&city=%C4%B0zmir&weight=58&jockey=N.AVC');
    console.log("Prediction:", p.prediction);
    console.log("Raw History Length:", p.history?.length);
    if (p.history?.length) {
        console.log("Raw Dates:", p.history.map(h => h.date).slice(0,5));
    }
}
run();
