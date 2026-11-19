let originalData = [];
let cleanedData = [];
let qualityChart = null;

const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const analyzeBtn = document.getElementById("analyzeBtn");
const repairBtn = document.getElementById("repairBtn");

fileInput.addEventListener("change", function(event) {

    const file = event.target.files[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
        alert("Please select a CSV file.");
        fileInput.value = "";
        return;
    }

    fileName.textContent = "Selected File: " + file.name;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: function(header) {
            return header.trim();
        },

        complete: function(results) {

            if (results.errors.length) {
                const firstError = results.errors[0];
                alert("CSV parsing issue: " + firstError.message);
            }

            originalData = results.data.filter(row =>
                Object.values(row).some(value => String(value ?? "").trim() !== "")
            );
            cleanedData = JSON.parse(JSON.stringify(originalData));

            if (originalData.length === 0) {
                alert("The selected CSV contains no data rows.");
                showTable([]);
                return;
            }

            alert("Dataset uploaded successfully!");
            showTable(originalData);
            resetDashboard();

        }
    });

});

function resetDashboard() {
    document.getElementById("qualityScore").textContent = "--";
    document.getElementById("missingCount").textContent = "0";
    document.getElementById("duplicateCount").textContent = "0";
    document.getElementById("invalidCount").textContent = "0";
    document.getElementById("repairStatus").textContent = "";
}

function showTable(data) {

    const container = document.getElementById("tableContainer");

    if (!data.length) {
        container.innerHTML = "<p>No data available.</p>";
        return;
    }

    let html = "<table><thead><tr>";

    Object.keys(data[0]).forEach(key => {
        html += `<th>${escapeHTML(key)}</th>`;
    });

    html += "</tr></thead><tbody>";

    data.slice(0, 20).forEach(row => {

        html += "<tr>";

        Object.keys(data[0]).forEach(key => {
            html += `<td>${escapeHTML(row[key] ?? "")}</td>`;
        });

        html += "</tr>";

    });

    html += "</tbody></table>";

    container.innerHTML = html;

}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}
// DATAFIX ERROR DETECTION ENGINE

function canonicalRow(row) {
    return JSON.stringify(Object.keys(row).sort().map(key => [key, String(row[key] ?? "").trim()]));
}

function findDataIssues(data) {
    let missing = 0;
    let duplicates = 0;
    let invalidEmails = 0;
    const seenRows = new Set();

    data.forEach(row => {
        Object.entries(row).forEach(([key, value]) => {
            const text = String(value ?? "").trim();
            const isMissingPlaceholder = text === "";

            if (isMissingPlaceholder) {
                missing++;
            }

            if (key.toLowerCase().includes("email") &&
                !isMissingPlaceholder &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
                invalidEmails++;
            }
        });

        const rowString = canonicalRow(row);
        if (seenRows.has(rowString)) {
            duplicates++;
        } else {
            seenRows.add(rowString);
        }
    });

    return { missing, duplicates, invalidEmails };
}

function updateQualityChart(issues) {
    const canvas = document.getElementById("qualityChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (qualityChart) {
        qualityChart.destroy();
    }

    qualityChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: ["Missing Values", "Duplicate Rows", "Invalid Emails"],
            datasets: [{
                label: "Detected Issues",
                data: [issues.missing, issues.duplicates, issues.invalidEmails],
                backgroundColor: ["#7552c7", "#dc7a5a", "#d94c64"]
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });
}

analyzeBtn.addEventListener("click", function () {

    if (originalData.length === 0) {
        alert("Please upload a CSV file first!");
        return;
    }

    const issues = findDataIssues(originalData);

    // Display Results

    document.getElementById("missingCount").textContent = issues.missing;
    document.getElementById("duplicateCount").textContent = issues.duplicates;
    document.getElementById("invalidCount").textContent = issues.invalidEmails;

    document.getElementById("repairStatus").textContent =
        "Analysis completed successfully!";

    const totalCells = originalData.length * Object.keys(originalData[0] || {}).length;
    const issueCount = issues.missing + issues.duplicates + issues.invalidEmails;
    const quality = totalCells === 0
        ? 0
        : Math.max(0, Math.round(100 - (issueCount / totalCells * 100)));
    document.getElementById("qualityScore").textContent = quality + "%";
    updateQualityChart(issues);

    alert("Data analysis completed!");

});

// DATAFIX AUTOMATIC REPAIR ENGINE

repairBtn.addEventListener("click", function () {
    if (originalData.length === 0) {
        alert("Please upload a CSV file first!");
        return;
    }

    const seenRows = new Set();

    cleanedData = [];

    originalData.forEach(row => {
        const repairedRow = {};

        Object.entries(row).forEach(([key, value]) => {
            let text = String(value ?? "").trim();

            if (key.toLowerCase().includes("email")) {
                text = text.toLowerCase();
                if (text !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
                    text = "";
                }
            }

            repairedRow[key] = text === "" ? "N/A" : text;
        });

        const rowString = canonicalRow(repairedRow);
        if (!seenRows.has(rowString)) {
            seenRows.add(rowString);
            cleanedData.push(repairedRow);
        }
    });

    if (cleanedData.length === 0) {
        alert("No rows were available to repair.");
        return;
    }

    const after = findDataIssues(cleanedData);
    document.getElementById("missingCount").textContent = after.missing;
    document.getElementById("duplicateCount").textContent = after.duplicates;
    document.getElementById("invalidCount").textContent = after.invalidEmails;

    const totalCells = cleanedData.length * Object.keys(cleanedData[0]).length;
    const issueCount = after.missing + after.duplicates + after.invalidEmails;
    const quality = totalCells === 0
        ? 0
        : Math.max(0, Math.round(100 - (issueCount / totalCells * 100)));
    document.getElementById("qualityScore").textContent = quality + "%";

    document.getElementById("repairStatus").textContent =
        "Repair completed! " + cleanedData.length + " clean rows displayed.";

    showTable(cleanedData);
    updateQualityChart(after);

    alert("Repair completed! Cleaned data is now displayed.");
});
// DOWNLOAD CLEANED DATASET

document.getElementById("downloadBtn").addEventListener("click", function () {

    if (cleanedData.length === 0) {
        alert("Please repair your dataset first!");
        return;
    }

    const csv = Papa.unparse(cleanedData);

    const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;"
    });

    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "DataFix_Cleaned_Dataset.csv";

    link.click();

    URL.revokeObjectURL(link.href);

});