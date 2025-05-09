document.addEventListener("DOMContentLoaded", function () {
    // Määrittele kartta ensin!
    const map = L.map('map').setView([60.3714, 26.3469], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    // Nyt turvallista määritellä nämä
    let select = document.getElementById("powerPlantSelection");
    let marker;
    let selectedLat, selectedLon;
    let plumeLayers = [];
    let customMarker = null;
    let isCustomActive = false;

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

if (selectedOption.value === "custom") {
    alert("Tuplaklikkaa kartalta vapaavalintainen voimalan paikka.");
    if (marker) map.removeLayer(marker);
    if (customMarker) map.removeLayer(customMarker);
    plumeLayers.forEach(layer => map.removeLayer(layer));
    plumeLayers = [];

    enableMapDoubleClick();
    return;
} else {
    disableMapDoubleClick(); // Estä kuuntelija, jos valinta ei ole "custom"
}


    // Normaalien voimaloiden käsittely
    let plant = JSON.parse(selectedOption.dataset.details);
    let lat = parseFloat(plant.lat);
    let lon = parseFloat(plant.lon);

    if (isNaN(lat) || isNaN(lon)) {
        console.error("Virhe: lat tai lon on NaN!", lat, lon);
        return;
    }

    if (marker) map.removeLayer(marker);
    if (customMarker) map.removeLayer(customMarker);
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

    document.getElementById("toggleControls").addEventListener("click", () => {
    const controls = document.getElementById("controls");
    controls.classList.toggle("collapsed");

    const toggleBtn = document.getElementById("toggleControls");
    toggleBtn.textContent = controls.classList.contains("collapsed") 
        ? "Näytä ohjaimet" 
        : "Piilota ohjaimet";
});

    
    document.getElementById("useWeatherBasedValues").addEventListener("change", function () {  
    if (this.checked) {

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

    document.getElementById("stabilityClass").addEventListener("change", () => {
         document.getElementById("useWeatherBasedValues").checked = false;
    });


    document.getElementById("simulateButton").addEventListener("click", function () {
    
        if (selectedLat === undefined || selectedLon === undefined) {
            alert("Valitse ensin voimala!");
            return;
        }
        const selectedModel = document.querySelector('input[name="model"]:checked').value;
        if (selectedModel === "ellipse") simulateEllipse(selectedLat, selectedLon);
        else if (selectedModel === "gaussian") simulateGaussian(selectedLat, selectedLon);
    });


function simulateEllipse(lat, lon) {

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

    // INES-luokan mukainen päästö (TBq -> Bq)
    let ines = parseInt(document.getElementById("ines").value);
    let Q_TBq = Math.pow(10, ines - 4) * 10;
    let Q_tot = Q_TBq * 1e12; // Bq
    let Q = Q_tot / 7 / 24 / 3600; // Bq/s viikon ajan
    
//    const Q = 1e14; // Päästön voimakkuus Bq/s (hypoteettinen)
    const windSpeed = parseFloat(document.getElementById("windSpeed").value) || 5;
    const windDirection = (parseFloat(document.getElementById("windDirection").value));
    const H = parseFloat(document.getElementById("stackHeight").value) || 100;
    const stability = document.getElementById("stabilityClass").value || "D";

    // Hengitystilavuus ja I-131 annosmuunnoskerroin
    const breathingRate = 1.2 / 3600; // m³/s (1.2 m³/h)
    const doseConversionFactor = 2.2e-8; // Sv/Bq (I-131 aikuisella, ICRP-tyyppi)

    const numOffsets = 9; // Montako pistettä sivulle (esim. 9 -> -4σy...0...+4σy)

    plumeLayers.forEach(layer => map.removeLayer(layer));
    plumeLayers = [];

    const adjustedDirection = (270 - windDirection + 360) % 360;
    const rad = adjustedDirection * Math.PI / 180;

    for (let x = 500; x <= 100000; x += 1000) {

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

        for (let i = -(Math.floor(numOffsets/2)); i <= Math.floor(numOffsets/2); i++) {
            const y = i * σy / (numOffsets/2); // jakaa -σy...+σy

            const z = 1.5; // mittauskorkeus m

            const exp1 = Math.exp(-Math.pow(y / σy, 2) / 2);
            const exp2 = Math.exp(-Math.pow((z - H) / σz, 2) / 2);
            const exp3 = Math.exp(-Math.pow((z + H) / σz, 2) / 2);

            const C = (Q / (2 * Math.PI * windSpeed * σy * σz)) * exp1 * (exp2 + exp3); // Bq/m³

            // Annosnopeus (Sv/h)
            const doseRate_Sv_per_h = C * breathingRate * doseConversionFactor * 3600; // kerrotaan sekunneista tunneiksi

            const norm = Math.min(1, C / 1e9); 
            const color = `rgba(255, 0, 0, ${norm})`;

            const dx = (x / 1000) * Math.cos(rad) - (y / 1000) * Math.sin(rad);
            const dy = (x / 1000) * Math.sin(rad) + (y / 1000) * Math.cos(rad);

            const pointLat = lat + (dy / 111);
            const pointLon = lon + (dx / (111 * Math.cos(lat * Math.PI / 180)));

            const marker = L.circleMarker([pointLat, pointLon], {
                radius: 5,
                fillColor: color,
                color: '#000',
                weight: 0.5,
                opacity: 0.6,
                fillOpacity: 0.7
            }).addTo(map);

            marker.bindPopup(
                `Etäisyys: ${(x/1000).toFixed(1)} km<br>
                Poikkeama: ${Math.round(y)} m<br>
                Pitoisuus: ${C.toExponential(2)} Bq/m³<br>
                Annosnopeus: ${(doseRate_Sv_per_h * 1e6).toFixed(2)} µSv/h`
            );

            plumeLayers.push(marker);
        }
    }
}

/*
function simulateGaussian(lat = selectedLat, lon = selectedLon) {
    if (!lat || !lon) {
        alert("Valitse ensin voimala tai paikka kartalta.");
        return;
    }

    // INES-luokan mukainen päästö (TBq -> Bq)
    let ines = parseInt(document.getElementById("ines").value);
    let Q_TBq = Math.pow(10, ines - 4) * 10;
    let Q = Q_TBq * 1e12; // Bq

    let windSpeed = parseFloat(document.getElementById("windSpeed").value);
    if (windSpeed <= 0) {
        alert("Tuulen nopeuden on oltava suurempi kuin 0.");
        return;
    }

    // Skaalauskerroin: C × 140 m³ × 2.2e-8 Sv/Bq = C × 3.08e-6 Sv
    const doseFactor = 140 * 2.2e-8;

    // Tyhjennetään vanhat säteilykerrokset kartalta
    plumeLayers.forEach(layer => map.removeLayer(layer));
    plumeLayers = [];

    // Luodaan testipisteitä tuulen suuntaan – myöhemmin voit käyttää oikeaa mallia tähän
    for (let i = 1; i <= 5; i++) {
        let distance_km = i * 10;
        let distance_m = distance_km * 1000;

        // Yksinkertainen laimenemismalli: pitoisuus ~ 1/r^2
        let C = Q / (4 * Math.PI * Math.pow(distance_m, 2));
        let dose = C * doseFactor; // Sv

        // Määritä väri annoksen mukaan
        let color = "green";
        if (dose > 1) color = "black";
        else if (dose > 0.1) color = "red";
        else if (dose > 0.01) color = "orange";

        // Lasketaan uusi sijainti – tässä kiinteästi itään päin
        let latOffset = 0;
        let lonOffset = i * 0.1;

        let circle = L.circle([lat + latOffset, lon + lonOffset], {
            radius: 5000,
            color: color,
            fillOpacity: 0.5
        }).addTo(map);
        circle.bindPopup(`Viikkoannos: ${(dose * 1000).toFixed(2)} mSv`);
        plumeLayers.push(circle);
    }
} 
*/

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
console.log("URL!", url);
    fetch(url)
            .then(res => res.json())
            .then(data => {
                console.log("Haettu säädata:", data); // Tärkeä!
                spinner.style.display = "none"; // Piilota spinneri
                
                if (data && data.current) {
                    const weather = data.current;
                    console.log("Haetaan säädatoja openmeteosta");
                    document.getElementById("windDirection").value = weather.wind_direction_10m;
                    document.getElementById("windSpeed").value = weather.wind_speed_10m;
  //                  document.getElementById("cloud_cover").value = weather.cloud_cover;

console.log("winddir, windspeed, cloudcover!", windDirection,windSpeed,weather.cöoud_cover);
 console.log("Haettu säädata223:", data); // Tärkeä!
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
function enableMapDoubleClick() {
    if (isCustomActive) return; // Estetään tuplakuuntelijat

    isCustomActive = true;

    map.on("dblclick", handleCustomLocation);
}

function disableMapDoubleClick() {
    isCustomActive = false;
    map.off("dblclick", handleCustomLocation);
}

function handleCustomLocation(e) {
    const { lat, lng } = e.latlng;

    if (customMarker) {
        customMarker.setLatLng([lat, lng]);
    } else {
        customMarker = L.marker([lat, lng]).addTo(map);
    }

    selectedLat = lat;
    selectedLon = lng;

    map.setView([lat, lng], 7);
    alert(`Voimalan paikka asetettu: ${lat.toFixed(4)}, ${lng.toFixed(4)}.\nVoit nyt suorittaa mallinnuksen.`);
}



});
