document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([51.505, -0.09], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems
        },
        draw: {
            polygon: true,
            polyline: true,
            rectangle: false,
            circle: false,
            marker: false
        }
    });
    map.addControl(drawControl);

    // Function to add labels to the map
    function addLabelsToMap(layer) {
        const coordinates = layer.getLatLngs()[0];
        coordinates.forEach((coord, index) => {
            if (index < coordinates.length - 1) { // Avoid duplicating the last point
                const label = L.marker(coord, {
                    icon: L.divIcon({
                        className: 'label',
                        html: `Point ${String.fromCharCode(65 + index)}`
                    })
                }).addTo(map);
                drawnItems.addLayer(label);
            }
        });

        for (let i = 0; i < coordinates.length - 1; i++) {
            const start = coordinates[i];
            const end = coordinates[i + 1];
            const midPoint = [(start.lat + end.lat) / 2, (start.lng + end.lng) / 2];
            const label = L.marker(midPoint, {
                icon: L.divIcon({
                    className: 'label',
                    html: `Line ${i + 1}`
                })
            }).addTo(map);
            drawnItems.addLayer(label);
        }
    }

    // Handle the created event to add the polygon to the map
    map.on(L.Draw.Event.CREATED, function (event) {
        const layer = event.layer;
        drawnItems.addLayer(layer);
        addLabelsToMap(layer);
    });

    // Handle the generate PDF button click
    document.getElementById('generatePdf').addEventListener('click', async () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');

        // Use leaflet-easyPrint to capture the map container as an image
        L.easyPrint({
            sizeModes: ['A4Portrait', 'A4Landscape'],
            exportOnly: true,
            hideControlContainer: false,
            hideClasses: ['leaflet-draw-toolbar']
        }).printMap('CurrentSize', 'Map', {
            format: 'png',
            title: 'Map'
        });

        // Capture the map container as an image
        const mapContainerElement = document.getElementById('map');
        const mapCanvas = await html2canvas(mapContainerElement, {
            useCORS: true
        });
        const mapImage = mapCanvas.toDataURL('image/png');

        // Calculate the aspect ratio
        const mapWidth = mapContainerElement.offsetWidth;
        const mapHeight = mapContainerElement.offsetHeight;
        const aspectRatio = mapWidth / mapHeight;

        // Calculate dimensions for the PDF
        const pdfWidth = (doc.internal.pageSize.getWidth() * 2) / 3; // 2/3 of the page width
        const pdfHeight = pdfWidth / aspectRatio;

        // Add map image to PDF with maintained aspect ratio
        doc.addImage(mapImage, 'PNG', 10, 10, pdfWidth, pdfHeight);

        // Add a table for the coordinates and distances
        const tableStartX = 10 + pdfWidth + 10; // Adjust x position for the table
        const tableColumn2 = tableStartX + 25; // x position for the second column
        const tableColumn3 = tableColumn2 + 25; // x position for the third column
        const cellHeight = 10; // Height of each cell
        let tableY = 20; // Starting y position for the table

        // Add table headers
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(200, 200, 200);
        doc.rect(tableStartX - 2, tableY - 6, 75, cellHeight, 'F');
        doc.text('Point', tableStartX, tableY);
        doc.text('Easting', tableColumn2, tableY);
        doc.text('Northing', tableColumn3, tableY);
        doc.rect(tableStartX - 2, tableY - 6, 25, cellHeight); // Border for 'Point'
        doc.rect(tableColumn2 - 2, tableY - 6, 25, cellHeight); // Border for 'Easting'
        doc.rect(tableColumn3 - 2, tableY - 6, 25, cellHeight); // Border for 'Northing'
        tableY += cellHeight;

        // Add coordinates and distances to the table
        let lineCounter = 1;
        drawnItems.eachLayer(function (layer) {
            if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
                let totalDistance = 0;
                let totalArea = 0;

                const coordinates = layer.getLatLngs()[0];
                coordinates.forEach((coord, index) => {
                    if (index < coordinates.length - 1) { // Avoid duplicating the last point
                        const projected = L.utm.fromLatLng(coord); // Convert to Easting/Northing
                        doc.setFont('helvetica', 'normal');
                        doc.text(`Point ${String.fromCharCode(65 + index)}`, tableStartX, tableY);
                        doc.text(`${projected.x.toFixed(2)}`, tableColumn2, tableY);
                        doc.text(`${projected.y.toFixed(2)}`, tableColumn3, tableY);
                        doc.rect(tableStartX - 2, tableY - 6, 25, cellHeight); // Border for 'Point'
                        doc.rect(tableColumn2 - 2, tableY - 6, 25, cellHeight); // Border for 'Easting'
                        doc.rect(tableColumn3 - 2, tableY - 6, 25, cellHeight); // Border for 'Northing'
                        tableY += cellHeight;
                    }
                });

                // Add table headers for line distance
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setFillColor(200, 200, 200);
                doc.rect(tableStartX - 2, tableY - 6, 75, cellHeight, 'F');
                doc.text('Line', tableStartX, tableY);
                doc.text('Distance', tableColumn2, tableY);
                doc.text('', tableColumn3, tableY);
                doc.rect(tableStartX - 2, tableY - 6, 25, cellHeight); // Border for 'Point'
                doc.rect(tableColumn2 - 2, tableY - 6, 25, cellHeight); // Border for 'Easting'
                doc.rect(tableColumn3 - 2, tableY - 6, 25, cellHeight); // Border for 'Northing'
                tableY += cellHeight;

                if (layer instanceof L.Polygon) {
                    for (let i = 0; i < coordinates.length - 1; i++) {
                        const start = coordinates[i];
                        const end = coordinates[i + 1];
                        const distance = turf.distance(turf.point([start.lng, start.lat]), turf.point([end.lng, end.lat]), { units: 'meters' }).toFixed(2);
                        totalDistance += parseFloat(distance);
                        doc.setFont('helvetica', 'normal');
                        doc.text(`Line ${lineCounter}`, tableStartX, tableY);
                        doc.text(`${distance}`, tableColumn2, tableY);
                        doc.text(`meters`, tableColumn3, tableY);
                        doc.rect(tableStartX - 2, tableY - 6, 25, cellHeight); // Border for 'Line'
                        doc.rect(tableColumn2 - 2, tableY - 6, 25, cellHeight); // Border for 'Distance'
                        doc.rect(tableColumn3 - 2, tableY - 6, 25, cellHeight); // Border for 'meters'
                        lineCounter++;
                        tableY += cellHeight;
                    }
                    totalArea = turf.area(layer.toGeoJSON()).toFixed(2);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`Total Distance: ${totalDistance.toFixed(2)} meters`, tableStartX, tableY);
                    tableY += cellHeight;
                    doc.text(`Total Area: ${totalArea} square meters`, tableStartX, tableY);
                    tableY += cellHeight;
                }
                tableY += cellHeight; // Add space between polygons
            }
        });

        // Calculate the scale for the PDF map
        const mapScale = calculateScale(map, pdfWidth);
        doc.text(`Scale: 1:${mapScale}`, 10, doc.internal.pageSize.getHeight() - 10);

        // Create a Blob from the PDF and generate a download link
        const pdfBlob = doc.output('blob');
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(pdfBlob);
        downloadLink.download = 'map.pdf';
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    });

    // Function to calculate the scale for the PDF map
    function calculateScale(map, pdfWidthMM) {
        const bounds = map.getBounds();
        const mapWidthInMeters = turf.distance(turf.point([bounds.getWest(), bounds.getSouth()]), turf.point([bounds.getEast(), bounds.getSouth()]), { units: 'meters' });
        const mapWidthInMM = mapWidthInMeters * 1000;
        const mapWidthOnScreenMM = map.getContainer().offsetWidth / 3.779528; // Convert pixels to mm
        const mapWidthInPdfMM = pdfWidthMM;
        const scale = (mapWidthInMM / mapWidthOnScreenMM) * (mapWidthOnScreenMM / mapWidthInPdfMM);
        return Math.round(scale);
    }
});
