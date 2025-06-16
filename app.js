const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const EventEmitter = require('events');

const app = express();
const PORT = 3000;

const DISCORD_TOKEN_REGEX = /([MN][A-Za-z\d]{23,28})\.([A-Za-z\d_-]{6,7})\.([A-Za-z\d_-]{27})/g;
const MAX_THREADS = 8;
const MAX_PAGES = 50;
const CRAWL_TIMEOUT = 8000;

function isSameDomain(url, domain) {
  try {
    return new URL(url).hostname.endsWith(domain);
  } catch {
    return false;
  }
}

async function getLinks(url, domain) {
  try {
    const resp = await axios.get(url, { timeout: CRAWL_TIMEOUT, headers: {"User-Agent": "Mozilla/5.0"} });
    const $ = cheerio.load(resp.data);
    const links = new Set();
    $('a[href]').each((_, a) => {
      let link = new URL(a.attribs['href'], url).toString();
      if (isSameDomain(link, domain)) {
        links.add(link.split("#")[0]);
      }
    });
    return [links, resp.data];
  } catch {
    return [new Set(), ""];
  }
}

function extractDiscordTokens(text) {
  return Array.from(new Set((text.match(DISCORD_TOKEN_REGEX) || [])));
}

async function crawl(startUrl, sse, maxPages = MAX_PAGES) {
  const domain = new URL(startUrl).hostname;
  const toCrawl = new Set([startUrl]);
  const crawled = new Set();
  const foundTokens = new Set();
  let count = 0;

  while (toCrawl.size && count < maxPages) {
    const url = Array.from(toCrawl)[0];
    toCrawl.delete(url);
    if (crawled.has(url)) continue;
    crawled.add(url);
    sse.emit('status', `Crawling: ${url} (${crawled.size}/${maxPages})`);
    const [links, text] = await getLinks(url, domain);
    const tokens = extractDiscordTokens(text);
    if (tokens.length) {
      tokens.forEach(t => foundTokens.add(t));
      sse.emit('tokens', tokens);
      sse.emit('status', `Found ${tokens.length} possible token(s) on ${url}`);
    }
    links.forEach(link => { if (!crawled.has(link)) toCrawl.add(link); });
    count++;
  }
  sse.emit('finished', Array.from(foundTokens));
}

app.get('/scrape', async (req, res) => {
  const url = req.query.url;
  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.flushHeaders();

  const sse = new EventEmitter();
  sse.on('status', msg => res.write(`data: ${JSON.stringify({ status: msg })}\n\n`));
  sse.on('tokens', tokens => res.write(`data: ${JSON.stringify({ tokens })}\n\n`));
  sse.on('finished', tokens => {
    res.write(`data: ${JSON.stringify({ status: 'Complete', finished: true, tokens })}\n\n`);
    res.end();
  });

  crawl(url, sse);
});

let tokensFound = [];
app.get('/tokens.txt', (req, res) => {
  res.type('text/plain').send(tokensFound.join('\n'));
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
