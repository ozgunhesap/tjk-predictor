const http = require('http');

function fetchApi(url) {
    return new Promise((resolve) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function run() {
    const dates = ['19/02/2026', '20/02/2026', '21/02/2026'];
    for (const d of dates) {
        console.log(`\n--- Date: ${d} ---`);
        const loc = await fetchApi(`http://localhost:3000/api/program?date=${d}`);
        console.log("Locations:", loc?.locations?.map(l => l.name));

        if (loc?.locations?.length > 0) {
            const firstLoc = loc.locations[0];
            const races = await fetchApi(`http://localhost:3000/api/location?locationId=${firstLoc.id}&locationName=${encodeURIComponent(firstLoc.name)}&date=${d}`);
            console.log(`Races in ${firstLoc.name}:`, races?.races?.length);

            if (races?.races?.length > 0) {
                const firstRace = races.races[0];
                const horses = await fetchApi(`http://localhost:3000/api/race?locationId=${firstLoc.id}&locationName=${encodeURIComponent(firstLoc.name)}&raceId=${firstRace.id}&date=${d}`);
                console.log(`Horses in Race 1:`, horses?.horses?.length);
            }
        }
    }
}
run();
