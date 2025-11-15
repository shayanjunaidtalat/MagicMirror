Module.register("MMM-Mawaqit", {
  defaults: {
    mosqueUrl: "//mawaqit.net/en/w/bbf-verein-freiburg-79110-germany?showOnly5PrayerTimes=0",
  },

  start() {
    Log.info("Starting module: " + this.name);
  },

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "mawaqit-fullscreen-wrapper";

    const iframe = document.createElement("iframe");
    iframe.src = this.config.mosqueUrl;
    iframe.frameBorder = "0";
    iframe.scrolling = "no";
    iframe.className = "mawaqit-fullscreen-iframe";

    wrapper.appendChild(iframe);
    return wrapper;
  },

  getStyles() {
    return ["MMM-Mawaqit.css"];
  }
});
