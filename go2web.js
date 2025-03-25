#!/usr/bin/env node

// Manually set the module resolution path
require('module').globalPaths.push(require('path').resolve(__dirname, 'node_modules'));

const tls = require('tls');
const cheerio = require('cheerio');
const { program } = require("commander");
const { convert } = require('html-to-text');
const https = require('https');

function fetchUrl(targetUrl) {
    try {
        const parsedUrl = new URL(targetUrl);
        const host = parsedUrl.hostname;
        const path = parsedUrl.pathname + parsedUrl.search;
        const port = 443; // Default HTTPS port

        const request = `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nAccept: application/json, text/html\r\nConnection: close\r\n\r\n`;

        const tlsOptions = {
            host: host,
            port: port,
            rejectUnauthorized: false,
            checkServerIdentity: () => null,
        };

        const client = tls.connect(tlsOptions, () => {
            client.write(request);
        });

        let responseData = '';

        client.on('data', (data) => {
            responseData += data.toString();
        });

        client.on('end', () => {
            const parts = responseData.split('\r\n\r\n');
            if (parts.length < 2) {
                console.error("Invalid response format.");
                return;
            }

            const headers = parts[0];
            // Handle cases where multiple header blocks exist
            const body = parts.slice(1).join('\r\n\r\n');

            // Detect content type
            const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
            const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : '';

            if (contentType.includes("application/json")) {
                try {
                    const jsonData = JSON.parse(body);
                    console.log(JSON.stringify(jsonData, null, 2));
                } catch (error) {
                    console.error("Failed to parse JSON response:", error.message);
                }
            } else if (contentType.includes("text/html")) {
                // Use html-to-text for better formatting
                const textContent = convert(body, {
                    // Keep text lines readable
                    wordwrap: 100,
                    selectors: [
                        // Ignore URLs inside links and images
                        { selector: 'a', options: { ignoreHref: true } },
                        { selector: 'img', format: 'skip' },
                    ]
                });

                console.log(textContent.trim());
            } else {
                console.log(body);
            }
        });

        client.on('error', (error) => {
            console.error('Connection error:', error);
        });
    } catch (error) {
        console.error('Invalid URL:', error.message);
    }
}

function searchWeb(query) {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;

    https.get(url, res => {
        let html = '';

        res.on('data', chunk => html += chunk);

        res.on('end', () => {
            const $ = cheerio.load(html);
            const results = [];

            $('a.result-link').slice(0, 10).each((i, el) => {
                const wrappedLink = $(el).attr('href');
                const match = wrappedLink.match(/uddg=([^&]+)/);
                const decodedLink = match ? decodeURIComponent(match[1]) : null;

                results.push({
                    title: $(el).text().trim(),
                    link: decodedLink || "Link not found"
                });
            });

            if (results.length === 0) return console.log("No results found.");

            console.log("\nTop 10 search results:");
            results.forEach((r, i) => {
                console.log(`${i + 1}. ${r.title}\n   ${r.link}\n`);
            });
        });
    }).on('error', err => {
        console.error("Error:", err.message);
    });
}

program
    .name("go2web")
    .description("A CLI tool for web-related tasks")
    .option("-u, --url <url>", "Fetch and print content from a URL")
    .option("-s, --search <query>", "Search the web using DuckDuckGo")
    .parse(process.argv)

program.parse(process.argv);

const options = program.opts();

if (!process.argv.slice(2).length) {
    program.outputHelp();
} else if (options.url) {
    fetchUrl(options.url);
} else if (options.search) {
    searchWeb(options.search);
}
