const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=2&SehirAdi=%C4%B0zmir&QueryParameter_Tarih=19/02/2026&Era=today', { headers: { 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' } }).then(r => {
    const $ = cheerio.load(r.data);
    let count = 1;
    $('div[id^="kosubilgisi-"]').each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ');
        const match = text.match(/([0-9]{3,4})\s*(Kum|Çim|Sentetik)/i);
        console.log(`Race ${count} distance ->`, match ? match[0] : 'FAIL');
        count++;
    });
});
