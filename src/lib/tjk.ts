import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.tjk.org';

export interface Location {
    id: string;
    name: string;
}

export interface Race {
    id: string;
    number: number;
    time: string;
    name: string;
    distance?: number;
    trackType?: string;
}

export interface Horse {
    id: string;
    number: string;
    name: string;
    jockey: string;
    weight: string;
    age: string;
    recentForm: string;
    sire?: string;
    trainer?: string;
    draw?: number;
    handicap?: number;
}

export interface PastRace {
    date: string;
    city: string;
    distance: number;
    trackType: string;
    condition: string;
    time: string;
    position: number;
    jockey: string;
    weight: number;
    trainer?: string;
    handicap?: number;
}

export async function getTodayLocations(date?: string): Promise<Location[]> {
    try {
        let url = `${BASE_URL}/TR/YarisSever/Info/Page/GunlukYarisProgrami`;
        if (date) {
            url += `?QueryParameter_Tarih=${encodeURIComponent(date)}`;
        }

        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            }
        });
        const $ = cheerio.load(data);
        const locations: Location[] = [];

        const TURKISH_CITIES = ['adana', 'ankara', 'antalya', 'bursa', 'diyarbakir', 'diyarbakır', 'elazig', 'elazığ', 'istanbul', 'i̇stanbul', 'izmir', 'i̇zmir', 'kocaeli', 'sanliurfa', 'şanlıurfa', 'kktc', 'şirinyer', 'veliefendi'];
        const isDomestic = (name: string) => {
            const lower = name.toLowerCase();
            return TURKISH_CITIES.some(city => lower.includes(city));
        };

        // Find city links in the tabs
        $('div.race-info > ul.gunluk-tabs > li > a').each((_, el) => {
            const cityId = $(el).attr('data-sehir-id');
            let cityName = $(el).attr('id') || '';
            if (cityId && parseInt(cityId) > 0 && isDomestic(cityName)) {
                locations.push({
                    id: cityId,
                    name: cityName.trim(),
                });
            }
        });

        // Fallback if structure is different
        if (locations.length === 0) {
            $('a[data-sehir-id]').each((_, el) => {
                const cityId = $(el).attr('data-sehir-id');
                let cityName = $(el).attr('id') || '';
                if (cityId && parseInt(cityId) > 0 && isDomestic(cityName) && locations.findIndex(l => l.id === cityId) === -1) {
                    locations.push({
                        id: cityId,
                        name: cityName.trim(),
                    });
                }
            });
        }

        return locations;
    } catch (error) {
        console.error('Error fetching locations:', error);
        return [];
    }
}

export async function getRacesForLocation(locationId: string, locationName: string, dateStr: string): Promise<Race[]> {
    try {
        const url = `${BASE_URL}/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=${locationId}&QueryParameter_Tarih=${encodeURIComponent(dateStr)}&SehirAdi=${encodeURIComponent(locationName)}&Era=today`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Referer': 'https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        const $ = cheerio.load(data);
        const races: Race[] = [];

        $('ul[class*="races-tabs"] > li > h3.race-no > a').each((_, el) => {
            const href = $(el).attr('href'); // e.g. #223288
            const text = $(el).text().trim(); // "1. Koşu \n 17.15"

            if (href && href.startsWith('#') && href !== '#all') {
                const raceId = href.replace('#', '');

                // Parse "1. Koşu 17.15"
                const parts = text.split(/\s+/).filter(Boolean);
                let number = 0;
                let time = '';

                if (parts.length >= 3) {
                    number = parseInt(parts[0].replace(/[^0-9]/g, ''));
                    time = parts[2];
                }

                // Parse distance & trackType from the details pane
                let distance = 0;
                let trackType = '';

                const pane = $(`div#${raceId}`);
                if (pane.length) {
                    const performLink = pane.find('a#tabsperformans');
                    if (performLink.length) {
                        const performHref = performLink.attr('href') || '';
                        const distMatch = performHref.match(/QueryParameter_MESAFE=(\d+)/);
                        if (distMatch) distance = parseInt(distMatch[1], 10);

                        const trackMatch = performHref.match(/QueryParameter_PISTADI=([^&]+)/);
                        if (trackMatch) trackType = decodeURIComponent(trackMatch[1]);
                    }

                    // FALLBACK: If TJK hid the performance tab (common for past dates), parse from text
                    // Example text: "1. Koşu 14:00 Şartlı 1 ... 1200 Kum"
                    if (distance === 0 || !trackType) {
                        const dlMatch = text.match(/(\d+)\s*(Kum|Çim|Sentetik)/i);
                        if (dlMatch) {
                            distance = parseInt(dlMatch[1], 10);
                            trackType = dlMatch[2].charAt(0).toUpperCase() + dlMatch[2].slice(1).toLowerCase();
                        }
                    }
                }

                races.push({
                    id: raceId,
                    number,
                    time,
                    name: text.replace(/\n|Koşu/g, ' ').replace(/\s+/g, ' ').trim(),
                    distance,
                    trackType
                });
            }
        });

        let sortedRaces = races.sort((a, b) => a.number - b.number);

        // EXTRA FALLBACK: For past dates, TJK often hides the distance from the individual race pane.
        // But the chronological list of distances is still in the raw HTML body.
        const bodyText = $('body').text().replace(/\s+/g, ' ');
        const globalMatches = bodyText.match(/([0-9]{3,4})\s*(Kum|Çim|Sentetik)/ig);

        if (globalMatches && globalMatches.length >= sortedRaces.length) {
            sortedRaces = sortedRaces.map((r, i) => {
                if (r.distance === 0 || !r.trackType) {
                    const dlMatch = globalMatches[i].match(/([0-9]{3,4})\s*(Kum|Çim|Sentetik)/i);
                    if (dlMatch) {
                        r.distance = parseInt(dlMatch[1], 10);
                        r.trackType = dlMatch[2].charAt(0).toUpperCase() + dlMatch[2].slice(1).toLowerCase();
                    }
                }
                return r;
            });
        }

        return sortedRaces;
    } catch (error) {
        console.error('Error fetching races:', error);
        return [];
    }
}

export async function getHorsesForRace(locationId: string, locationName: string, dateStr: string, raceId: string): Promise<Horse[]> {
    try {
        const url = `${BASE_URL}/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=${locationId}&SehirAdi=${encodeURIComponent(locationName)}&QueryParameter_Tarih=${encodeURIComponent(dateStr)}&Era=today`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Referer': 'https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        const $ = cheerio.load(data);
        const horses: Horse[] = [];

        const raceContainer = $(`div#kosubilgisi-${raceId}`);
        if (!raceContainer.length) return [];

        raceContainer.find('table.tablesorter tbody tr').each((_, tr) => {
            const tds = $(tr).find('td');
            if (tds.length > 5) {
                const num = $(tds[1]).text().trim();

                const horseLink = $(tds[2]).find('a').first();
                const horseName = horseLink.text().trim().replace(/\s+/g, ' ');

                const href = horseLink.attr('href') || '';
                const match = href.match(/QueryParameter_AtId=(\d+)/);
                const horseId = match ? match[1] : '';

                const age = $(tds[3]).text().trim();
                const sireText = $(tds[4]).text().trim(); // "KURTEL- YILDIZ KÖŞKÜ / ÖZGÜNHAN"
                const sire = sireText.split('-')[0]?.trim() || '';

                const weight = $(tds[5]).text().trim();
                const jockey = $(tds[6]).text().trim();
                const trainer = $(tds[8]).text().trim();
                const drawStr = $(tds[9]).text().trim();
                const draw = parseInt(drawStr, 10) || 0;
                const handicapStr = $(tds[10]).text().trim();
                const handicap = parseInt(handicapStr, 10) || 0;

                const recentForm = $(tds[11]).text().trim(); // Son 6 yaris

                if (horseName && horseId) {
                    horses.push({
                        id: horseId,
                        number: num,
                        name: horseName,
                        age,
                        weight,
                        jockey,
                        recentForm,
                        sire,
                        trainer,
                        draw,
                        handicap
                    });
                }
            }
        });

        return horses;
    } catch (error) {
        console.error('Error fetching horses:', error);
        return [];
    }
}

export async function getHorseHistory(horseId: string): Promise<PastRace[]> {
    try {
        const url = `${BASE_URL}/TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?1=1&QueryParameter_AtId=${horseId}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Referer': 'https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        const safeData = `<table>${data}</table>`;
        const $ = cheerio.load(safeData);
        const history: PastRace[] = [];

        $('tr').each((_, tr) => {
            const tds = $(tr).find('td');
            if (tds.length > 10) {
                const date = $(tds[0]).text().trim();
                const city = $(tds[1]).text().trim();
                const distanceStr = $(tds[2]).text().trim();
                const distance = parseInt(distanceStr, 10);

                const trackComplete = $(tds[3]).text().trim(); // e.g. "S:Normal", "Ç:Normal \n 3.3"
                const parts = trackComplete.split(':');
                let trackType = parts[0] ? parts[0].trim() : '';

                // Mappings
                if (trackType === 'S') trackType = 'Sentetik';
                else if (trackType === 'K') trackType = 'Kum';
                else if (trackType === 'Ç') trackType = 'Çim';

                const condStr = parts[1] || '';
                const condition = condStr.split('\n')[0].trim();

                const jockey = $(tds[8]).text().trim();
                const weightStr = $(tds[6]).text().trim().replace(',', '.');
                const pastWeight = parseFloat(weightStr) || 0;

                const trainer = $(tds[14]).text().trim();

                const timeStr = $(tds[5]).text().trim();
                let time = '';
                if (timeStr && timeStr.includes('.')) {
                    time = timeStr;
                } else if (timeStr === "Derecesiz") {
                    time = "Derecesiz";
                }

                const positionStr = $(tds[9]).text().trim();
                const position = parseInt(positionStr, 10) || 0;

                const handicapStr = $(tds[16]).text().trim();
                const handicap = parseInt(handicapStr, 10) || 0;

                if (time) {
                    history.push({
                        date,
                        city,
                        distance,
                        trackType,
                        condition: condStr,
                        time,
                        position,
                        jockey,
                        weight: pastWeight,
                        trainer,
                        handicap
                    });
                }
            }
        });

        return history;
    } catch (error) {
        console.error('Error fetching horse history:', error);
        return [];
    }
}
