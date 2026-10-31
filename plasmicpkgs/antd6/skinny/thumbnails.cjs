const thumbnails = require("./thumbnails.plasmic.json");
exports.getComponentThumbnail = (name) => thumbnails[name];
