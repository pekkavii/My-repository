let map = L.map('map').setView([60.19, 24.94], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let marker;

function simulate() {
    let voimalaValinta = document.getElementById("voimala").value;
    let ines = document.getElementById("ines").value;

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
    let size = (ines - 3) * 30;  // Perusleveys kilometreissä

    // Haetaan tuulen suunta ja nopeus
    let windDirection = parseFloat(document.getElementById("windDirection").value);
    let windSpeed = parseFloat(document.getElementById("windSpeed").value);

    // Muutetaan asteet radiaaneiksi
    let windRad = windDirection * (Math.PI / 180);

    // Lasketaan pilven venytys ja siirtymä
    let lengthFactor = 1 + windSpeed / 5; // Tuuli venyttää pilveä
    let shiftFactor = windSpeed * 2; // Siirretään pilveä tuulen suuntaan

    // Luodaan ellipsin parametrit
    let semiMinor = size * 1000;  // Pienempi akseli
    let semiMajor = semiMinor * lengthFactor;  // Pidempi akseli (venytys)

    // Piirretään ellipsi ilman siirtoa
    let plume = L.ellipse([lat, lon], [semiMajor, semiMinor], {
        color: 'red',
        fillColor: 'orange',
        fillOpacity: 0.4,
        rotation: windDirection
    }).addTo(map);

    // Lasketaan uusi keskipiste tuulen mukaan
    let newLat = lat + (shiftFactor / 111) * Math.cos(windRad);
    let newLon = lon + (shiftFactor / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(windRad);

    // Siirretään pilvi uuteen sijaintiin
    plume.setLatLng([newLat, newLon]);

    console.log(`Pilvi piirrettävänä: lat=${newLat}, lon=${newLon}, suunta=${windDirection}°, nopeus=${windSpeed} m/s`);
}


