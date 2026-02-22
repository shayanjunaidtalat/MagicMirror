const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");

module.exports = NodeHelper.create({
    start: function() {
        console.log("MMM-MyTimeline helper started...");
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "GET_TIMELINE_DATA") {
            this.readTimelineFile();
        }
    },

    readTimelineFile: function() {
        const filePath = path.join(__dirname, "data/today_nostalgia.json");
        
        fs.readFile(filePath, "utf8", (err, data) => {
            if (err) {
                console.error("MMM-MyTimeline: Could not read data file", err);
                return;
            }
            this.sendSocketNotification("TIMELINE_DATA_READY", JSON.parse(data));
        });
    }
});