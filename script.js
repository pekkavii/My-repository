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

    // Lasketaan tuulen vaikutus pilven pituuteen ja siirtymään
    let lengthFactor = 1 + windSpeed / 5; // Nopeampi tuuli venyttää pilveä
    let shiftFactor = windSpeed * 2; // Siirretään pilveä tuulen suuntaan

    let plume = L.ellipse([lat, lon], [size * 1000, size * 1000 * lengthFactor], {
        color: 'red',
        fillColor: 'orange',
        fillOpacity: 0.4,
        rotation: windDirection
    }).addTo(map);

    // Siirretään pilveä tuulen suuntaan
    let newLat = lat + (shiftFactor / 111) * Math.cos(windDirection * Math.PI / 180);
    let newLon = lon + (shiftFactor / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(windDirection * Math.PI / 180);

    plume.setLatLng([newLat, newLon]);

    setTimeout(() => map.removeLayer(plume), 10000); // Poistaa pilven 10 sekunnin jälkeen
}

