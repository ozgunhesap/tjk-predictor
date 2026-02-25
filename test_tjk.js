const http = require('http');

function fetchApi(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve(null); }
            });
        }).on('error', reject);
    });
}

async function run() {
    const locData = await fetchApi('http://localhost:3000/api/program?date=21/02/2026');
    console.log("Locations:", locData?.locations?.map(l => l.name));
    if (locData && locData.locations && locData.locations.length > 0) {
        const locId = locData.locations[0].id;
        const locName = locData.locations[0].name;

        const raceData = await fetchApi(`http://localhost:3000/api/location?locationId=${locId}&locationName=${encodeURIComponent(locName)}&date=21/02/2026`);
        console.log("Races:", raceData?.races?.map(r => r.name));

        if (raceData && raceData.races && raceData.races.length > 0) {
            const rId = raceData.races[0].id;
            const horseData = await fetchApi(`http://localhost:3000/api/race?locationId=${locId}&locationName=${encodeURIComponent(locName)}&raceId=${rId}&date=21/02/2026`);
            console.log("Horses for Race 1:", horseData?.horses?.length);
            if (horseData?.horses?.length > 0) {
                console.log(horseData.horses[0]);
            }
        }
    }
}
run();
