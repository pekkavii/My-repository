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

select.addEventListener("change", function () {
    let selectedOption = select.options[select.selectedIndex];

    // Jos tyhjä tai ei valittu
    if (!selectedOption.value) {
        selectedLat = undefined;
        selectedLon = undefined;

        // Poistetaan merkki ja pilvet
        if (marker) {
            map.removeLayer(marker);
            marker = null;
        }
        plumeLayers.forEach(layer => map.removeLayer(layer));
        plumeLayers = [];

        return;
    }

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
    
// Poistetaan vanhat pilvet aina kun valinta muuttuu
plumeLayers.forEach(layer => map.removeLayer(layer));
plumeLayers = [];

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

    if (document.getElementById("useCurrentWeather").checked) {
        fetchWeather();
    }
});

    })
    .catch(error => console.error("Voimaloiden lataaminen epäonnistui:", error));



let map = L.map('map').setView([60.3775, 26.3550], 7); // Loviisan sijainti oletuksena

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let marker;
let selectedLat = undefined;
let selectedLon = undefined;

let plumeLayers = []; // Taulukko pilville

function simulate(lat, lon) {

    let ines = parseInt(document.getElementById("ines").value);

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
if (!isNaN(windDirection)) {
    windDirection = (windDirection + 180) % 360; // Käännetään suunta
}
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

document.getElementById("useCurrentWeather").addEventListener("change", function() {
    if (this.checked) {
        fetchWeather();
    }
});

document.getElementById("windDirection").addEventListener("input", function() {
    document.getElementById("useCurrentWeather").checked = false;
});

document.getElementById("windSpeed").addEventListener("input", function() {
    document.getElementById("useCurrentWeather").checked = false;
});

document.getElementById("simulateButton").addEventListener("click", function() {
    if (selectedLat === undefined || selectedLon === undefined) {
        alert("Valitse ensin voimala!");
        return;
    }
    const selectedModel = document.querySelector('input[name="model"]:checked').value;
if (selectedModel === "ellipse") {
    simulate(selectedLat, selectedLon);
} else if (selectedModel === "gaussian") {
    simulateGaussian(selectedLat, selectedLon);
}    
});

function fetchWeather() {
    if (typeof selectedLat === 'undefined' || typeof selectedLon === 'undefined') {
        alert("Valitse ensin voimala!");
        document.getElementById("useCurrentWeather").checked = false;
        return;
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedLat}&longitude=${selectedLon}&current_weather=true&windspeed_unit=ms`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data && data.current_weather) {
                document.getElementById("windDirection").value = data.current_weather.winddirection;
                document.getElementById("windSpeed").value = data.current_weather.windspeed;
            } else {
                throw new Error("Säätietoja ei löytynyt");
            }
        })
        .catch(err => {
            console.error("Virhe säätiedoissa:", err);
            alert("Säätietoja ei voitu hakea");
            document.getElementById("useCurrentWeather").checked = false;
        });
}


