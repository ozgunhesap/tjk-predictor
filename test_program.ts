import { getTodayLocations, getRacesForLocation, getHorsesForRace } from './src/lib/tjk';

async function test() {
    const today = new Date();
    const dateQuery = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    console.log(`Checking program for ${dateQuery}...`);

    const locations = await getTodayLocations(dateQuery);
    if (locations.length === 0) {
        console.log("No locations found!");
        return;
    }

    const loc = locations[0];
    console.log(`Location: ${loc.name} (${loc.id})`);

    const races = await getRacesForLocation(loc.id, loc.name, dateQuery);
    if (races.length === 0) {
        console.log("No races found!");
        return;
    }

    const race = races[0];
    console.log(`Race ${race.number}: ${race.name} - ${race.distance}m ${race.trackType}`);

    const horses = await getHorsesForRace(loc.id, loc.name, dateQuery, race.id);
    console.log(`Horse count: ${horses.length}`);
    if (horses.length > 0) {
        console.log(`First horse: ${horses[0].name} (${horses[0].id})`);
    }
}

test();
