let map = L.map('map').setView([60.3775, 26.3550], 7); // Loviisan sijainti oletuksena

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let marker;
let plantMarker;
let plumeLayer;

function simulate() {
    let voimalaValinta = document.getElementById("powerPlant").value;
    let ines = parseInt(document.getElementById("ines").value);

    let lat, lon;
    if (voimalaValinta === "user") {
        alert("Klikkaa karttaa asettaaksesi voimalan sijainnin.");
        map.on('click', function(e) {
            if (marker) {
                map.removeLayer(marker);
            }
            lat = e.latlng.lat;
            lon = e.latlng.lng;
            marker = L.marker([lat, lon]).addTo(map);
            drawPlume(lat, lon, ines);
        });
    } else {
        [lat, lon] = voimalaValinta.split(",").map(Number);
        if (marker) {
            map.removeLayer(marker);
        }
        marker = L.marker([lat, lon]).addTo(map);
        drawPlume(lat, lon, ines);
    }
}

function drawPlume(lat, lon, ines) {
    // Päivitetään voimalan markkeri
    if (!plantMarker) {
        plantMarker = L.marker([lat, lon]).addTo(map);
    } else {
        plantMarker.setLatLng([lat, lon]);
    }

    let size = (ines - 3) * 30; // Pilven koko kilometreinä

    // Haetaan tuulen suunta ja nopeus
    let windDirection = parseFloat(document.getElementById("windDirection").value);
    let windSpeed = parseFloat(document.getElementById("windSpeed").value);

    let windRad = windDirection * (Math.PI / 180);
    let lengthFactor = 1 + windSpeed / 5; // Tuuli venyttää pilveä
    let shiftFactor = windSpeed * 2; // Pilven siirtymä km

    let semiMinor = size * 1000; // Pienempi akseli (metreinä)
    let semiMajor = semiMinor * lengthFactor; // Pidempi akseli (venytys)

    // Testataan kiinteillä arvoilla, jos pilvi ei näy
    if (semiMajor < 1000 || semiMinor < 500) {
        semiMajor = 50000;
        semiMinor = 20000;
    }

    // Lasketaan uusi keskipiste tuulen mukaan
    let newLat = lat + (shiftFactor / 111) * Math.cos(windRad);
    let newLon = lon + (shiftFactor / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(windRad);

    // Poistetaan aiempi pilvi
    if (plumeLayer) {
        map.removeLayer(plumeLayer);
    }

    // Lisätään uusi pilvi (käytetään kiinteitä kokoarvoja testin vuoksi)
    plumeLayer = L.ellipse([newLat, newLon], [semiMajor, semiMinor], {
        color: 'red',
        fillColor: 'orange',
        fillOpacity: 0.4,
        rotation: windDirection
    }).addTo(map);

    console.log(`🟢 Voimala: lat=${lat}, lon=${lon}`);
    console.log(`🌫️ Pilvi: lat=${newLat}, lon=${newLon}, suunta=${windDirection}°, nopeus=${windSpeed} m/s`);
}




