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
    let size = (ines - 3) * 30 * 1000; // Pilven koko metreinä

    let windDirection = parseFloat(document.getElementById("windDirection").value);
    let windSpeed = parseFloat(document.getElementById("windSpeed").value);

    let lengthFactor = 1 + windSpeed / 5;
    let semiMinor = size / 2;  
    let semiMajor = semiMinor * lengthFactor;

    let shiftFactor = windSpeed * 2;
    let windRad = windDirection * (Math.PI / 180);

    // Lasketaan keskipiste niin, että voimala jää ellipsin toiseen reunaan
    let newLat = lat + (shiftFactor / 222) * Math.cos(windRad);
    let newLon = lon + (shiftFactor / (222 * Math.cos(lat * Math.PI / 180))) * Math.sin(windRad);

    // Poistetaan vanha pilvi
    if (plumeLayer) {
        map.removeLayer(plumeLayer);
    }

    // Piirretään uusi ellipsi
    plumeLayer = drawEllipse(newLat, newLon, semiMinor / 1000, semiMajor / 1000, windDirection);
}

function drawEllipse(lat, lon, semiMajor, semiMinor, rotation) {
    let points = [];
    let steps = 36; // Ellipsin tarkkuus (36 pistettä)
    let angleStep = (2 * Math.PI) / steps;
    
    let rotationRad = rotation * (Math.PI / 180);

    for (let i = 0; i < steps; i++) {
        let angle = i * angleStep;
        let x = semiMajor * Math.cos(angle);
        let y = semiMinor * Math.sin(angle);

        // Kierrä ellipsi
        let rotatedX = x * Math.cos(rotationRad) - y * Math.sin(rotationRad);
        let rotatedY = x * Math.sin(rotationRad) + y * Math.cos(rotationRad);

        let pointLat = lat + (rotatedY / 111);  
        let pointLon = lon + (rotatedX / (111 * Math.cos(lat * Math.PI / 180)));

        points.push([pointLat, pointLon]);
    }

    points.push(points[0]); // Sulje polygoni

    return L.polygon(points, {
        color: 'red',
        fillColor: 'orange',
        fillOpacity: 0.4
    }).addTo(map);
}

