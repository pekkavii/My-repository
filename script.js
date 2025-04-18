document.addEventListener("DOMContentLoaded", function () {
    // Määrittele kartta ensin!
    const map = L.map('map').setView([60.3775, 26.3550], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
       alert("määrittelyt");
    // Nyt turvallista määritellä nämä
    let select = document.getElementById("powerPlantSelection");
    let marker;
    let selectedLat, selectedLon;
    let plumeLayers = [];

    fetch('power_plants.json')
        .then(response => response.json())
        .then(data => {
            data.forEach(plant => {
                let option = document.createElement("option");
                option.value = `${plant.lat},${plant.lon}`;
                option.textContent = `${plant.name} (${plant.country})`;
                option.dataset.details = JSON.stringify(plant);
                select.appendChild(option);
            });

            select.addEventListener("change", function () {
                let selectedOption = select.options[select.selectedIndex];
                if (!selectedOption.value) {
                    selectedLat = undefined;
                    selectedLon = undefined;
                    if (marker) map.removeLayer(marker);
                    plumeLayers.forEach(layer => map.removeLayer(layer));
                    plumeLayers = [];
                    return;
                }

                let plant = JSON.parse(selectedOption.dataset.details);
                let lat = parseFloat(plant.lat);
                let lon = parseFloat(plant.lon);

                if (isNaN(lat) || isNaN(lon)) {
                    console.error("Virhe: lat tai lon on NaN!", lat, lon);
                    return;
                }

                if (marker) map.removeLayer(marker);
                plumeLayers.forEach(layer => map.removeLayer(layer));
                plumeLayers = [];

                marker = L.marker([lat, lon]).addTo(map)
                    .bindPopup(`
                        <b>${plant.name}</b><br>
                        <b>Maa:</b> ${plant.country}<br>
                        <b>Reaktori:</b> ${plant.reactor_type}<br>
                        <b>Sähköteho:</b> ${plant.electrical_power_MW} MW
                    `).openPopup();

                map.setView([lat, lon], 7);
                selectedLat = lat;
                selectedLon = lon;

                if (document.getElementById("useWeatherBasedValues").checked) {
                    fetchWeather();
                }
            });
        })
        .catch(error => console.error("Voimaloiden lataaminen epäonnistui:", error));

    // Event listenerit DOM:n latauduttua
           alert("event listenerit");

document.getElementById("useWeatherBasedValues").addEventListener("change", function () {
    if (this.checked) {
        alert("checkbox klikattu");
        console.log("Checkbox klikattu");
        if (selectedLat == null || selectedLon == null) {
            alert("Valitse ensin voimala ennen säätietojen hakua!");
            this.checked = false;
        } else {
            fetchWeather();
        }
    }
});


    
    document.getElementById("windDirection").addEventListener("input", function () {
        document.getElementById("useWeatherBasedValues").checked = false;
    });

    document.getElementById("windSpeed").addEventListener("input", function () {
        document.getElementById("useWeatherBasedValues").checked = false;
    });

    document.getElementById("simulateButton").addEventListener("click", function () {
        alert("simulate button");
        if (selectedLat === undefined || selectedLon === undefined) {
            alert("Valitse ensin voimala!");
            return;
        }
        const selectedModel = document.querySelector('input[name="model"]:checked').value;
        if (selectedModel === "ellipse") simulateEllipse(selectedLat, selectedLon);
        else if (selectedModel === "gaussian") simulateGaussian(selectedLat, selectedLon);
    });

    // Kartta
   // const map = L.map('map').setView([60.3775, 26.3550], 7);
//    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
 //       attribution: '&copy; OpenStreetMap contributors'
  //  }).addTo(map);


function simulateEllipse(lat, lon) {
           alert("simulateellipse");

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


function simulateGaussian(lat, lon) {

    
       alert("simulateGaussian alkaa");

    const Q = 1e14; // Päästön voimakkuus Bq/s (hypoteettinen)
    const windSpeed = parseFloat(document.getElementById("windSpeed").value) || 5;
    const windDirection = (parseFloat(document.getElementById("windDirection").value));

    const useAuto = document.getElementById("useWeatherBasedValues").checked;
    const H = parseFloat(document.getElementById("stackHeight").value) || 100;
    const stability = document.getElementById("stabilityClass").value || "D";

    // Tyhjennetään aiemmat pilvet
    plumeLayers.forEach(layer => map.removeLayer(layer));
    plumeLayers = [];

    const adjustedDirection = (270 - windDirection + 360) % 360;
    const rad = adjustedDirection * Math.PI / 180;

    for (let x = 500; x <= 100000; x += 500) { // 500 m - 100 km
        // Briggsin kaavat stabiilisuusluokan mukaan
        let σy, σz;
        switch (stability) {
            case "A":
                σy = 0.22 * x * Math.pow(1 + 0.0001 * x, -0.5);
                σz = 0.20 * x;
                break;
            case "B":
                σy = 0.16 * x * Math.pow(1 + 0.0001 * x, -0.5);
                σz = 0.12 * x;
                break;
            case "C":
                σy = 0.11 * x * Math.pow(1 + 0.0001 * x, -0.5);
                σz = 0.08 * x * Math.pow(1 + 0.0015 * x, -0.5);
                break;
            case "D":
                σy = 0.08 * x * Math.pow(1 + 0.0001 * x, -0.5);
                σz = 0.06 * x * Math.pow(1 + 0.0015 * x, -0.5);
                break;
            case "E":
                σy = 0.06 * x * Math.pow(1 + 0.0001 * x, -0.5);
                σz = 0.03 * x * Math.pow(1 + 0.0015 * x, -0.5);
                break;
            case "F":
                σy = 0.04 * x * Math.pow(1 + 0.0001 * x, -0.5);
                σz = 0.016 * x * Math.pow(1 + 0.0015 * x, -0.5);
                break;
            default:
                σy = 0.08 * x * Math.pow(1 + 0.0001 * x, -0.5);
                σz = 0.06 * x * Math.pow(1 + 0.0015 * x, -0.5);
        }

        const y = 0; // tuulen suunnassa, maksimi
        const z = 1.5; // havainnointikorkeus (m)

        const exp1 = Math.exp(-Math.pow(y / σy, 2) / 2);
        const exp2 = Math.exp(-Math.pow((z - H) / σz, 2) / 2);
        const exp3 = Math.exp(-Math.pow((z + H) / σz, 2) / 2);

        const C = (Q / (2 * Math.PI * windSpeed * σy * σz)) * exp1 * (exp2 + exp3); // Bq/m³

        // Normalisoidaan väri
        const norm = Math.min(1, C / 1e9); // suhteellinen punaisuus
        const color = `rgba(255, 0, 0, ${norm})`;

        const dx = (x / 1000) * Math.cos(rad);
        const dy = (x / 1000) * Math.sin(rad);

        const pointLat = lat + (dy / 111);
        const pointLon = lon + (dx / (111 * Math.cos(lat * Math.PI / 180)));

        const marker = L.circleMarker([pointLat, pointLon], {
            radius: 6,
            fillColor: color,
            color: '#000',
            weight: 0.5,
            opacity: 0.6,
            fillOpacity: 0.7
        }).addTo(map);

        marker.bindPopup(`Etäisyys: ${x / 1000} km<br>Pitoisuus: ${C.toExponential(2)} Bq/m³`);
        plumeLayers.push(marker);
    }
}

function fetchWeather() {

    const spinner = document.getElementById("loadingSpinner");
    spinner.style.display = "block"; // Näytä spinneri

    if (selectedLat == null || selectedLon == null) {
        alert("Valitse ensin voimala ennen säätietojen hakua!");
        document.getElementById("useCurrentWeather").checked = false;
        spinner.style.display = "none"; // Piilota spinneri
        return;
    }
// open-meteon sivulta haettu url-malli
//https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=wind_speed_10m,wind_direction_10m,cloud_cover,is_day,rain&wind_speed_unit=ms
    
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedLat}&longitude=${selectedLon}&current=wind_speed_10m,wind_direction_10m,cloud_cover,is_day,rain&wind_speed_unit=ms`;
        fetch(url)
            .then(res => res.json())
            .then(data => {
                console.log("Haettu säädata:", data); // Tärkeä!
                spinner.style.display = "none"; // Piilota spinneri
                
                if (data && data.current) {
                    const weather = data.current;

alert("Haetaan säädatoja openmeteosta");
                    
                    document.getElementById("windDirection").value = weather.wind_direction_10m;
                    document.getElementById("windSpeed").value = weather.wind_speed_10m;
  //                  document.getElementById("cloud_cover").value = weather.cloud_cover;
                    document.getElementById("cloud_cover").value = 5;

 
                    let pasquill = "D";
                    const clouds = weather.cloud_cover;
                    const speed = weather.wind_speed_10m;

                    if (clouds < 25) {
                        if (speed < 2) pasquill = "A";
                        else if (speed < 3) pasquill = "B";
                        else pasquill = "C";
                    } else if (clouds > 75) {
                        if (speed < 2) pasquill = "E";
                        else pasquill = "D";
                    }
                      
                    document.getElementById("stabilityClass").value = pasquill;
                    document.getElementById("stackHeight").value = 100;
                }
            })
            .catch(err => {
                console.error("Virhe säätiedoissa:", err);
                alert("Säätietoja ei voitu hakea");
                document.getElementById("useWeatherBasedValues").checked = false;
                spinner.style.display = "none"; // Piilota spinneri
            });
    }

    // simulateEllipse ja simulateGaussian pysyvät ennallaan — niitä ei muutettu
});
