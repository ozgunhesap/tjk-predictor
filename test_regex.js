const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=2&SehirAdi=%C4%B0zmir&QueryParameter_Tarih=19/02/2026&Era=today', { headers: { 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' } }).then(r => {
    const $ = cheerio.load(r.data);
    $('h3.kosu-baslik a').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        console.log('RACE TEXT ->', text);
        const dlMatch = text.match(/([0-9]+)\s*(Kum|Çim|Sentetik)/i);
        console.log('REGEX ->', dlMatch ? dlMatch[0] : 'FAIL');
    });
});
