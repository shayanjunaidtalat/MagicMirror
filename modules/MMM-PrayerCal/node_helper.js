const NodeHelper = require("node_helper");
const ical = require("node-ical");

module.exports = NodeHelper.create({
  socketNotificationReceived(notification, payload) {
    if (notification === "GET_PRAYER_TIMES") {
      this.getPrayerTimes(payload);
    }
  },

  async getPrayerTimes(icsUrl) {
    try {
      const response = await fetch(icsUrl); // Node 18+ built-in fetch
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const icsData = await response.text();

      const events = ical.parseICS(icsData);
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      const times = {};

      for (let k in events) {
        const ev = events[k];
        if (ev.type === "VEVENT") {
          const eventDate = new Date(ev.start);
          const eventDateStr = eventDate.toISOString().split("T")[0];

          if (eventDateStr === todayStr) {
            const hour = eventDate.getHours().toString().padStart(2, "0");
            const min = eventDate.getMinutes().toString().padStart(2, "0");
            times[ev.summary] = `${hour}:${min}`;
          }
        }
      }

      this.sendSocketNotification("PRAYER_TIMES", times);

    } catch (err) {
      console.error("[MMM-PrayerCal] Error fetching ICS:", err);
      this.sendSocketNotification("PRAYER_TIMES", null);
    }
  }
});
