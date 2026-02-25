const axios = require('axios');
const cheerio = require('cheerio');
async function test() {
    const url = 'https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=2&SehirAdi=%C4%B0zmir&QueryParameter_Tarih=20/02/2026&Era=today';
    try {
        const { data } = await axios.get(url, { headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': '*/*','X-Requested-With': 'XMLHttpRequest'
        }});
        const $ = cheerio.load(data);
        console.log("HTML Start:", data.substring(0, 500));
        $('table.tablesorter tbody tr').each((_, tr) => {
            const tds = $(tr).find('td');
            if (tds.length > 5) {
                const num = $(tds[1]).text().trim();
                const name = $(tds[2]).text().replace(/\s+/g, ' ').trim();
                console.log(`Pos? ${num} - ${name} - HTML:`, $(tr).html().substring(0, 100));
            }
        });
    } catch(e) { console.error(e); }
}
test();
