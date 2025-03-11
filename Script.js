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
    let size = (ines - 3) * 30;  // Mitä suurempi INES, sitä laajempi alue
    let plume = L.circle([lat, lon], {
        color: 'red',
        fillColor: 'orange',
        fillOpacity: 0.4,
        radius: size * 1000  // Säde kilometreissä
    }).addTo(map);

    setTimeout(() => map.removeLayer(plume), 10000); // Poistaa pilven 10 sekunnin jälkeen
}
