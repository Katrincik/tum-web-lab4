#!/usr/bin/env node

// Manually set the module resolution path
require('module').globalPaths.push(require('path').resolve(__dirname, 'node_modules'));

const tls = require('tls');
const cheerio = require('cheerio');
const { program } = require("commander");
const { convert } = require('html-to-text');

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

program
    .name("go2web")
    .description("A CLI tool for web-related tasks")
    .option("-u, --url <url>", "Fetch and print content from a URL")
    .parse(process.argv)

program.parse(process.argv);

const options = program.opts();

if (!process.argv.slice(2).length) {
    program.outputHelp();
} else if (options.url) {
    fetchUrl(options.url);
}
