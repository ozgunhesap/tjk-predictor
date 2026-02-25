import * as cheerio from 'cheerio';
import * as fs from 'fs';
import axios from 'axios';

axios.get("https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami", {
    headers: { 'User-Agent': 'Mozilla/5.0' }
})
.then(res => {
    const $ = cheerio.load(res.data);
    let links: string[] = [];
    $('a').each((i, a) => {
        const href = $(a).attr('href');
        if (href && !links.includes(href) && href.includes('YarisSever')) {
            links.push(href);
        }
    });
    console.log(links.filter(l => l.toLowerCase().includes('agf') || l.toLowerCase().includes('muhtemel') || l.toLowerCase().includes('ganyan')));
});
