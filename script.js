fetch('power_plants.json')
    .then(response => response.json())
    .then(data => {
        let select = document.getElementById("powerPlant");
        let detailsDiv = document.getElementById("plantDetails");

        data.forEach(plant => {
            let option = document.createElement("option");
            option.value = `${plant.lat},${plant.lon}`;
            option.textContent = `${plant.name} (${plant.country})`;
            option.dataset.details = JSON.stringify(plant); // Tallennetaan lisätiedot valintaan
            select.appendChild(option);
        });

        select.addEventListener("change", function() {
            let selectedOption = select.options[select.selectedIndex];
            let plant = JSON.parse(selectedOption.dataset.details);
            
            detailsDiv.innerHTML = `
                <p><strong>Voimala:</strong> ${plant.name}</p>
                <p><strong>Maa:</strong> ${plant.country}</p>
                <p><strong>Reaktorityyppi:</strong> ${plant.reactor_type}</p>
                <p><strong>Sähköteho:</strong> ${plant.electrical_power_MW} MW</p>
            `;
        });
    })
    .catch(error => console.error("Voimaloiden lataaminen epäonnistui:", error));


let map = L.map('map').setView([60.3775, 26.3550], 7); // Loviisan sijainti oletuksena

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let marker;
let plantMarker;
let plumeLayers = []; // Taulukko useille pilville

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
            drawPlumes(lat, lon, ines);
        });
    } else {
        [lat, lon] = voimalaValinta.split(",").map(Number);
        if (marker) {
            map.removeLayer(marker);
        }
        marker = L.marker([lat, lon]).addTo(map);
        drawPlumes(lat, lon, ines);
    }
}

function drawPlumes(lat, lon, ines) {
    let baseSize = (ines - 3) * 30 * 1000; // Pilven koko metreinä
    let windDirection = parseFloat(document.getElementById("windDirection").value);
    let windSpeed = parseFloat(document.getElementById("windSpeed").value);
    
    let scaleFactors = [1, 0.5, 0.25]; // Koko-asteikot eri tasoille
    let colors = ['green', 'orange', 'red']; // Värit eri tasoille
     
    // Poistetaan vanhat pilvet
    plumeLayers.forEach(layer => map.removeLayer(layer));
    plumeLayers = [];
    
    scaleFactors.forEach((scale, index) => {
        let semiMajor = baseSize * scale;
        let semiMinor = semiMajor / (1 + windSpeed / 5);
        let windRad = windDirection * (Math.PI / 180);

        let semiMajorKm = semiMajor / 1000; // Muutetaan kilometreiksi
        let newLat = lat + (semiMajorKm / 111) * Math.cos(windRad);
        let newLon = lon + (semiMajorKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(windRad);
        
        let plume = drawEllipse(newLat, newLon, semiMinor / 1000, semiMajor / 1000, windDirection, colors[index]);
        plumeLayers.push(plume);
    });
}

function drawEllipse(lat, lon, semiMajor, semiMinor, rotation, color) {
    let points = [];
    let steps = 36; // Ellipsin tarkkuus (36 pistettä)
    let angleStep = (2 * Math.PI) / steps;
    
    let rotationRad = rotation * (Math.PI / 180);

    for (let i = 0; i < steps; i++) {
        let angle = i * angleStep;
        let x = semiMajor * Math.cos(angle);
        let y = semiMinor * Math.sin(angle);

        // Kierrä ellipsi
        let rotatedX = x * Math.cos(rotationRad) + y * Math.sin(rotationRad);
        let rotatedY = -x * Math.sin(rotationRad) + y * Math.cos(rotationRad);

        let pointLat = lat + (rotatedY / 111);  
        let pointLon = lon + (rotatedX / (111 * Math.cos(lat * Math.PI / 180)));

        points.push([pointLat, pointLon]);
    }

    points.push(points[0]); // Sulje polygoni

    return L.polygon(points, {
        color: color,
        fillColor: color,
        fillOpacity: 0.4
    }).addTo(map);
}
