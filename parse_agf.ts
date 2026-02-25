import * as cheerio from 'cheerio';
import * as fs from 'fs';
let data = fs.readFileSync('agf_test.html', 'utf8');
const $ = cheerio.load(data);
console.log($('body').text().replace(/\s+/g, ' ').substring(0, 500));
