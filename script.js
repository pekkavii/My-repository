fetch('power_plants.json')
    .then(response => response.json())
    .then(data => {
        let select = document.getElementById("powerPlantSelection");

        data.forEach(plant => {
            let option = document.createElement("option");
            option.value = `${plant.lat},${plant.lon}`;
            option.textContent = `${plant.name} (${plant.country})`;
            option.dataset.details = JSON.stringify(plant);
            select.appendChild(option);
        });

        select.addEventListener("change", function() {
            let selectedOption = select.options[select.selectedIndex];
            let plant = JSON.parse(selectedOption.dataset.details);

            let lat = parseFloat(plant.lat);
            let lon = parseFloat(plant.lon);

            if (isNaN(lat) || isNaN(lon)) {
                console.error("Virhe: lat tai lon on NaN!", plant.lat, plant.lon);
                return;
            }

            if (marker) {
                map.removeLayer(marker);
            }

            marker = L.marker([lat, lon]).addTo(map)
                .bindPopup(`
                    <b>${plant.name}</b><br>
                    <b>Maa:</b> ${plant.country}<br>
                    <b>Reaktori:</b> ${plant.reactor_type}<br>
                    <b>Sähköteho:</b> ${plant.electrical_power_MW} MW
                `)
                .openPopup();

            map.setView([lat, lon], 7);

            selectedLat = lat;
            selectedLon = lon;
        });
    })
    .catch(error => console.error("Voimaloiden lataaminen epäonnistui:", error));

let map = L.map('map').setView([60.3775, 26.3550], 7); // Loviisan sijainti oletuksena

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let marker;
let plumeLayers = []; // Taulukko pilville

function simulate(lat, lon) {
    let inesInput = parseInt(document.getElementById("ines").value);
    let ines = parseInt(inesInput);
    console.log("INES-arvo:", ines);
    if (isNaN(ines) || ines < 3 || ines > 7) {
        console.error("Virheellinen INES-arvo:", ines);
        return;
    }
    if (isNaN(lat) || isNaN(lon)) {
        console.error("Virhe: lat tai lon on NaN!", lat, lon);
        return;
    }
    

let windDirection = parseFloat(document.getElementById("windDirection").value);
if (isNaN(windDirection)) {
    windDirection = 90; // Oletusarvo
}

let windSpeed = parseFloat(document.getElementById("windSpeed").value);
if (isNaN(windSpeed)) {
    windSpeed = 5; // Oletusarvo
}


    // Lasketaan ellipsin koko (metreinä)
    let baseSize = (ines - 3) * 30 * 1000;
    
    let scaleFactors = [1, 0.5, 0.25];
    let colors = ['green', 'orange', 'red'];

    // Poistetaan vanhat pilvet
    plumeLayers.forEach(layer => map.removeLayer(layer));
    plumeLayers = [];

    scaleFactors.forEach((scale, index) => {
        let semiMajor = baseSize * scale;

let semiMinor = semiMajor / (1 + windSpeed / 5);
if (semiMinor < 100) {  // Vähintään 100m pienempi akseli
    semiMinor = 100;
}


        
        let windRad = windDirection * (Math.PI / 180);

        let semiMajorKm = semiMajor / 1000;
        let newLat = lat + (semiMajorKm / 111) * Math.cos(windRad);
        let newLon = lon + (semiMajorKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(windRad);

        let plume = drawEllipse(newLat, newLon, semiMinor / 1000, semiMajor / 1000, windDirection, colors[index]);
        plumeLayers.push(plume);
    });
}

function drawEllipse(lat, lon, semiMajor, semiMinor, rotation, color) {
    let points = [];
    let steps = 36;
    let angleStep = (2 * Math.PI) / steps;
    
    let rotationRad = rotation * (Math.PI / 180);



    for (let i = 0; i < steps; i++) {
        let angle = i * angleStep;
        let x = semiMajor * Math.cos(angle);
        let y = semiMinor * Math.sin(angle);

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

document.getElementById("simulateButton").addEventListener("click", function() {
    if (selectedLat === undefined || selectedLon === undefined) {
        console.error("Voimalaa ei ole valittu!");
        return;
    }
    simulate(selectedLat, selectedLon);
});
