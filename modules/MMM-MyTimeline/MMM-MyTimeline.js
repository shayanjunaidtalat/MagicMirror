Module.register("MMM-MyTimeline", {
    defaults: {
        apiKey: "AIzaSyB22GguEGGhbxJ69N7VSwypwvX8cvnDfzA",
        updateInterval: 60 * 60 * 1000, 
    },

    getStyles: function() {
        return ["MMM-MyTimeline.css"];
    },

    start: function() {
        this.timelineData = { events: [], trail: [], target_year: "..." };
        this.map = null;
        this.sendSocketNotification("GET_TIMELINE_DATA");
    },

    getDom: function() {
        const wrapper = document.createElement("div");
        wrapper.className = "timeline-wrapper";

        const mapCont = document.createElement("div");
        mapCont.id = "map-canvas";
        wrapper.appendChild(mapCont);

        const sidebar = document.createElement("div");
        sidebar.className = "timeline-sidebar";

        if (!this.timelineData.events || this.timelineData.events.length === 0) {
            sidebar.innerHTML = "<div class='no-data'>Searching for nostalgia...</div>";
        } else {
            const title = document.createElement("div");
            title.className = "timeline-title";
            title.innerHTML = `On This Day in ${this.timelineData.target_year}`;
            sidebar.appendChild(title);

            this.timelineData.events.forEach(event => {
                const item = document.createElement("div");
                item.className = "event-item";
                
                let icon = "🔵"; 
                const loc = event.location.toLowerCase();
                if (loc.includes("cycling") || loc.includes("bicycle")) icon = "🚲";
                else if (loc.includes("walking")) icon = "🚶";
                else if (loc.includes("vehicle") || loc.includes("driving")) icon = "🚗";
                else if (loc.includes("home")) icon = "🏠";

                item.innerHTML = `
                    <div class="event-icon-container"><div class="event-icon">${icon}</div></div>
                    <div class="event-details">
                        <div class="event-name">${event.location}</div>
                        <div class="event-time">${event.time_range}</div>
                    </div>
                `;
                sidebar.appendChild(item);
            });
        }
        wrapper.appendChild(sidebar);
        return wrapper;
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "TIMELINE_DATA_READY") {
            this.timelineData = payload;
            this.updateDom();
            setTimeout(() => {
                if (typeof google === "undefined") {
                    this.loadGoogleMaps();
                } else {
                    this.updateMapContent();
                }
            }, 500);
        }
    },

    loadGoogleMaps: function() {
        const self = this;
        if (window.googleMapsLoading) return;
        window.googleMapsLoading = true;
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.config.apiKey}`;
        script.onload = () => { self.updateMapContent(); };
        document.body.appendChild(script);
    },

    updateMapContent: function() {
        const mapElement = document.getElementById("map-canvas");
        if (!mapElement || !this.timelineData.trail) return;

        const bounds = new google.maps.LatLngBounds();

        // --- MAP STYLE FIX: This allows POIs and Labels to show ---
        this.map = new google.maps.Map(mapElement, {
            mapTypeId: 'hybrid', // 'hybrid' shows satellite + labels/roads
            disableDefaultUI: true,
            styles: [
                { featureType: "poi", elementType: "labels", stylers: [{ visibility: "on" }] },
                { featureType: "transit", elementType: "labels", stylers: [{ visibility: "on" }] }
            ]
        });

        // Draw the path
        if (this.timelineData.trail.length > 0) {
            const pathCoords = this.timelineData.trail.map(p => {
                const latLng = new google.maps.LatLng(p.lat, p.lng);
                bounds.extend(latLng);
                return latLng;
            });

            new google.maps.Polyline({
                path: pathCoords,
                geodesic: true,
                strokeColor: "#00EBFF",
                strokeOpacity: 0.8,
                strokeWeight: 4,
                map: this.map
            });
        }

        // --- MARKER FIX: Ensure visits show up as markers ---
        this.timelineData.events.forEach(event => {
            if (event.type === "visit" && event.lat && event.lng) {
                const pos = { lat: parseFloat(event.lat), lng: parseFloat(event.lng) };
                bounds.extend(pos);
                new google.maps.Marker({
                    position: pos,
                    map: this.map,
                    title: event.location,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 7,
                        fillColor: event.location.toLowerCase().includes("home") ? "#FF5722" : "#FFF",
                        fillOpacity: 1,
                        strokeWeight: 2,
                        strokeColor: "#00EBFF"
                    }
                });
            }
        });

        if (!bounds.isEmpty()) {
            this.map.fitBounds(bounds);
        }
    }
});