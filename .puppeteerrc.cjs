const path = require("path");

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    cacheDirectory: path.join(__dirname, "node_modules", ".cache", "puppeteer")
};
