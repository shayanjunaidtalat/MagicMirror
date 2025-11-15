Module.register("MMM-PrayerCal", {
  defaults: {
    icsUrl: "",
    updateInterval: 60 * 60 * 1000, // 1 hour regular fetch
    timeFormat: "24",
    showCountdown: true,
    highlightCurrent: true
  },

  start() {
    Log.info("Starting module: " + this.name);
    this.prayerTimes = {};

    // Initial fetch
    this.sendSocketNotification("GET_PRAYER_TIMES", this.config.icsUrl);

    // Regular interval fetch
    this.scheduleUpdate();

    // Midnight update
    this.scheduleMidnightUpdate();
  },

  getStyles() {
    return ["MMM-PrayerCal.css"];
  },

  scheduleUpdate() {
    setInterval(() => {
      this.sendSocketNotification("GET_PRAYER_TIMES", this.config.icsUrl);
    }, this.config.updateInterval);
  },

  scheduleMidnightUpdate() {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 0, 0, 0
    );
    const timeout = nextMidnight - now;

    setTimeout(() => {
      this.sendSocketNotification("GET_PRAYER_TIMES", this.config.icsUrl);
      this.scheduleMidnightUpdate(); // reschedule for next day
    }, timeout);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "PRAYER_TIMES") {
      this.prayerTimes = payload || {};
      this.updateDom();
    }
  },

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "prayer-wrapper";  // horizontal flex container

    if (Object.keys(this.prayerTimes).length === 0) {
      wrapper.innerHTML = "Loading prayer times…";
      return wrapper;
    }

    const now = new Date();
    const order = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

    order.forEach((prayer, index) => {
      const timeStr = this.prayerTimes[prayer];
      if (!timeStr) return;

      const li = document.createElement("div");
      li.className = "prayer-item";

      li.innerHTML = `<span class="prayer-name">${prayer}</span>
                      <span class="prayer-time">${timeStr}</span>`;

      if (this.config.highlightCurrent) {
        const [hour, min] = timeStr.split(":").map(Number);
        const prayerDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hour,
          min,
          0,
          0
        );

        // Determine next prayer time
        let nextPrayerTime = null;
        if (index + 1 < order.length) {
          const [nextHour, nextMin] = this.prayerTimes[order[index + 1]].split(":").map(Number);
          nextPrayerTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            nextHour,
            nextMin,
            0,
            0
          );
        } else {
          // For Isha, next prayer is tomorrow Fajr
          const [nextHour, nextMin] = this.prayerTimes["Fajr"].split(":").map(Number);
          nextPrayerTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1,
            nextHour,
            nextMin,
            0,
            0
          );
        }

        if (now >= prayerDate && now < nextPrayerTime) {
          li.classList.add("current-prayer");
        }
      }

      wrapper.appendChild(li);
    });

    return wrapper;
  }
});
