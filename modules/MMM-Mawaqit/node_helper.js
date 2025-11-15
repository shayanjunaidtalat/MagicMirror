const NodeHelper = require("node_helper");
const fetch = require("node-fetch"); // Node < 18
const { JSDOM } = require("jsdom");   // npm install jsdom

module.exports = NodeHelper.create({
  socketNotificationReceived(notification, payload) {
    if (notification === "GET_MAWAQUIT_DATA") {
      this.getMawaqitData(payload);
    }
  },

  async getMawaqitData(mosqueSlug) {
    const url = `https://mawaqit.net/en/${mosqueSlug}`;
    console.log("[MMM-Mawaqit] Fetching page:", url);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();

      // DEBUG: check if prayers div exists
      if (!html.includes('class="prayers"')) {
        console.warn("[MMM-Mawaqit] No <div class='prayers'> found in static HTML. Times likely JS-rendered.");
        this.sendSocketNotification("MAWAQUIT_DATA", null);
        return;
      }

      const dom = new JSDOM(html);
      const document = dom.window.document;

      const times = {};
      const prayerDivs = document.querySelectorAll(".prayers > div");
      prayerDivs.forEach(prayerEl => {
        const nameEl = prayerEl.querySelector(".name");
        const timeEl = prayerEl.querySelector(".time > div");
        if (nameEl && timeEl) {
          const prayerName = nameEl.textContent.trim();
          const prayerTime = timeEl.textContent.trim();
          times[prayerName] = prayerTime;
        }
      });

      if (Object.keys(times).length === 0) {
        console.warn("[MMM-Mawaqit] No times scraped. Possibly JS-rendered content.");
        this.sendSocketNotification("MAWAQUIT_DATA", null);
      } else {
        console.log("[MMM-Mawaqit] Scraped times:", times);
        this.sendSocketNotification("MAWAQUIT_DATA", times);
      }

    } catch (error) {
      console.error("[MMM-Mawaqit] Scraping error:", error);
      this.sendSocketNotification("MAWAQUIT_DATA", null);
    }
  }
});
