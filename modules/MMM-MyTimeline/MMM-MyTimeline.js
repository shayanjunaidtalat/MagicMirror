Module.register("MMM-MyTimeline", {
    defaults: {
        apiKey: "AIzaSyB22GguEGGhbxJ69N7VSwypwvX8cvnDfzA",
        rotationInterval: 10 * 1000, 
    },

    start: function() {
        this.allYearsData = [];
        this.yearIndex = 0;
        this.map = null;
        this.markers = [];
        this.polyline = null;
        this.sendSocketNotification("GET_TIMELINE_DATA");
        
        // Timer to move focus
        setInterval(() => {
            if (this.allYearsData && this.allYearsData.length > 0) {
                this.yearIndex = (this.yearIndex + 1) % this.allYearsData.length;
                
                // 1. Update text manually (so we don't trigger updateDom and break the map)
                this.updateTextOverlay();
                
                // 2. Move map focus
                this.moveMapFocus();
            }
        }, this.config.rotationInterval);
    },

    // This creates the HTML structure ONLY ONCE
    getDom: function() {
        const wrapper = document.createElement("div");
        wrapper.id = "timeline-container";
        wrapper.style.cssText = "width: 100vw; height: 100vh; position: relative; background: black;";

        // Persistent Map Div
        const mapCont = document.createElement("div");
        mapCont.id = "map-canvas";
        mapCont.style.cssText = "width: 100%; height: 100%; position: absolute; top: 0; left: 0; z-index: 1;";
        wrapper.appendChild(mapCont);

        // Persistent Sidebar Div
        const sidebar = document.createElement("div");
        sidebar.id = "sidebar-overlay";
        sidebar.style.cssText = "position: absolute; z-index: 5; padding: 20px; color: white; background: rgba(0,0,0,0.5); width: 350px; height: 100%; font-family: sans-serif;";
        wrapper.appendChild(sidebar);

        return wrapper;
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "TIMELINE_DATA_READY") {
            this.allYearsData = payload;
            this.updateTextOverlay();
            this.loadGoogleMaps();
        }
    },

    // Updates text WITHOUT deleting the Map
    updateTextOverlay: function() {
        const sidebar = document.getElementById("sidebar-overlay");
        const currentData = this.allYearsData[this.yearIndex];
        if (!sidebar || !currentData) return;

        let html = `<h1 style='margin:0; color: #00EBFF;'>${currentData.year}</h1><hr style='border: 0; border-top: 1px solid #444;'>`;
        currentData.events.forEach(e => {
            html += `<div style='margin-bottom:15px'><b>${e.location}</b><br><small>${e.time_range}</small></div>`;
        });
        sidebar.innerHTML = html;
    },

    loadGoogleMaps: function() {
        if (typeof google !== "undefined") {
            this.initMap();
            return;
        }
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.config.apiKey}`;
        script.onload = () => { this.initMap(); };
        document.body.appendChild(script);
    },

    initMap: function() {
        const mapElement = document.getElementById("map-canvas");
        if (!mapElement || typeof google === "undefined") return;

        this.map = new google.maps.Map(mapElement, {
            center: {lat: 24.8607, lng: 67.0011},
            zoom: 12,
            mapTypeId: 'hybrid',
            disableDefaultUI: true,
            backgroundColor: 'black'
        });
        this.moveMapFocus();
    },

    moveMapFocus: function() {
        if (!this.map || !this.allYearsData[this.yearIndex]) return;
        const currentData = this.allYearsData[this.yearIndex];

        // Clear existing graphics
        this.markers.forEach(m => m.setMap(null));
        this.markers = [];
        if (this.polyline) this.polyline.setMap(null);

        const bounds = new google.maps.LatLngBounds();
        let hasPoints = false;

        // Add New Trail
        if (currentData.trail && currentData.trail.length > 0) {
            const coords = currentData.trail.map(p => {
                const pt = new google.maps.LatLng(p.lat, p.lng);
                bounds.extend(pt);
                hasPoints = true;
                return pt;
            });
            this.polyline = new google.maps.Polyline({
                path: coords,
                strokeColor: "#00EBFF",
                strokeWeight: 5,
                map: this.map
            });
        }

        // Add New Markers
        currentData.events.forEach(event => {
            if (event.lat) {
                const pos = {lat: parseFloat(event.lat), lng: parseFloat(event.lng)};
                bounds.extend(pos);
                hasPoints = true;
                const marker = new google.maps.Marker({
                    position: pos,
                    map: this.map,
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: "#FFF", fillOpacity: 1, strokeColor: "#00EBFF", strokeWeight: 2 }
                });
                this.markers.push(marker);
            }
        });

        // MOVE FOCUS: Adjust camera to new points
        if (hasPoints) {
            this.map.fitBounds(bounds);
        }
    }
});