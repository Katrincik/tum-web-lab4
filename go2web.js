#!/usr/bin/env node
const { program } = require("commander");

program
    .name("go2web")
    .description("A CLI tool for web-related tasks")

program.parse(process.argv);

if (!process.argv.slice(2).length) {
    program.outputHelp();
}
