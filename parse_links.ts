import * as cheerio from 'cheerio';
import * as fs from 'fs';
import axios from 'axios';

axios.get("https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami")
.then(res => {
    const $ = cheerio.load(res.data);
    $('a').each((i, a) => {
        const href = $(a).attr('href');
        if (href && href.toLowerCase().includes('agf')) {
            console.log("Found AGF link:", href);
        }
    });
});
