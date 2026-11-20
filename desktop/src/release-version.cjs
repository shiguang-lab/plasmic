const number = "(?:0|[1-9][0-9]*)";
const stable = new RegExp(`^${number}[.]${number}[.]${number}$`);
const beta = new RegExp(`^${number}[.]${number}[.]${number}-beta[.]${number}$`);

module.exports = { stable, beta };
