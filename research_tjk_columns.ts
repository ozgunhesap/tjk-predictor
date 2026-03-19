
import axios from 'axios';
import * as cheerio from 'cheerio';

async function research() {
    const horseId = '103504';
    const url = `https://www.tjk.org/TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?1=1&QueryParameter_AtId=${horseId}`;

    console.log(`Fetching ${url}...`);
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
    });

    const $ = cheerio.load(`<table>${data}</table>`);

    const rows = $('tr');
    console.log(`Found ${rows.length} rows.`);

    // Find a row with more than 15 columns (typical for race history)
    rows.each((i, row) => {
        const tds = $(row).find('td');
        if (tds.length > 15) {
            console.log(`\n--- Race Row Found at Index ${i} ---`);
            tds.each((j, td) => {
                console.log(`Col ${j}: ${$(td).text().trim().replace(/\s+/g, ' ')}`);
            });
            // Also check for links which might contain Race ID or City ID
            const links = $(row).find('a');
            links.each((l, link) => {
                console.log(`Link ${l}: ${$(link).attr('href')}`);
            });
            return false; // Just one row is enough
        }
    });
}

research();
