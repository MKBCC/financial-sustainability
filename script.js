const navLinks = document.querySelectorAll("nav a");
const tabBg = document.createElement("div");
tabBg.classList.add("tab-bg");
document.querySelector("nav ul").appendChild(tabBg);

function moveTabBg(link) {
  const rect = link.getBoundingClientRect();
  const parentRect = link.parentElement.parentElement.getBoundingClientRect();
  tabBg.style.width = rect.width + "px";
  tabBg.style.left = (rect.left - parentRect.left) + "px";
}

navLinks.forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();

    // 頁籤切換內容
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    if (link.id === "homeTab") document.querySelector("#homeSection").classList.add("active");
    if (link.id === "searchTab") document.querySelector("#searchSection").classList.add("active");
    if (link.id === "aboutTab") document.querySelector("#aboutSection").classList.add("active");
    if (link.id === "strategyTab") document.querySelector("#strategySection").classList.add("active");

    // 頁籤底色動畫
    navLinks.forEach(a => a.classList.remove("active"));
    link.classList.add("active");
    moveTabBg(link);
  });
});

// 初始位置
window.addEventListener("load", () => {
  const activeLink = document.querySelector("#homeTab");
  activeLink.classList.add("active");
  moveTabBg(activeLink);
});


// 限制日期範圍
const dateInput = document.getElementById("dateInput");
dateInput.min = "2018-01-02";
dateInput.max = "2024-12-31";

// 全域資料
let csvData = [];
let stockChart = null;

fetch("data.csv")
    .then(response => response.text())
    .then(text => {
        csvData = parseCSV(text);
    });

// 解析 CSV 並清除空白 / BOM
function parseCSV(text) {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim());
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i]);
        return obj;
    });
    return rows;
}

// ====== 查詢邏輯 ======
function performSearch() {
    const keyword = document.getElementById("searchInput").value.trim();
    const date = dateInput.value;

    if (!keyword || !date) {
        alert("請輸入 TICK 或 ID，並選擇日期");
        return;
    }

    const minDate = new Date("2018-01-02");
    const maxDate = new Date("2024-12-31");
    const selectedDate = new Date(date);
    if (selectedDate < minDate || selectedDate > maxDate) {
        alert("日期超出可查詢範圍（2018/01/02～2024/12/31）");
        return;
    }

    const excelDate = Math.floor((selectedDate - new Date("1899-12-30")) / (1000 * 60 * 60 * 24));

    // 找出該日期資料
    const result = csvData.filter(row => 
        (row["TICK"] === keyword || row["ID"] === keyword) && Number(row["DATE"]) === excelDate
    );

    renderTable(result);

    // 圖表邏輯：只看該公司該年份
    const targetYear = selectedDate.getFullYear();
    const company = result.length > 0 ? result[0]["ID"] : findCompanyName(keyword);
    if (company) {
        drawYearChart(company, targetYear, excelDate);
    } else {
        clearChart();
    }
}

// 綁定按鈕事件
document.getElementById("searchBtn").addEventListener("click", performSearch);

// 綁定 Enter 鍵觸發查詢
document.getElementById("searchInput").addEventListener("keydown", e => {
    if (e.key === "Enter") performSearch();
});
dateInput.addEventListener("keydown", e => {
    if (e.key === "Enter") performSearch();
});

// 嘗試用 TICK 找公司名
function findCompanyName(keyword) {
    const match = csvData.find(r => r["TICK"] === keyword || r["ID"] === keyword);
    return match ? match["ID"] : null;
}

// 中文欄位對照
const headerMap = {
    "DATE": "日期",
    "TICK": "股票代碼",
    "ID": "公司名稱",
    "P": "股價",
    "Adj_P": "調整後股價",
    "RET_Daily": "每日報酬率",
    "總分": "f-score",
    "分組": "分組",
    "TESG等級": "TESG等級",
    "TESG分數": "TESG分數"
};

// 分組轉換對照
const groupMap = { "0": "後25%", "1": "中間50%", "2": "前25%" };

// Excel 日期轉 yyyy/mm/dd
function excelDateToString(excelDate) {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd}`;
}

// 顯示結果表格
function renderTable(data) {
    const header = document.getElementById("tableHeader");
    const body = document.getElementById("tableBody");
    header.innerHTML = "";
    body.innerHTML = "";

    if (data.length === 0) {
        body.innerHTML = `<tr><td colspan="10">查無資料</td></tr>`;
        return;
    }

    Object.keys(data[0]).forEach(key => {
        const th = document.createElement("th");
        th.textContent = headerMap[key] || key;
        header.appendChild(th);
    });

    data.forEach(row => {
        const tr = document.createElement("tr");
        Object.entries(row).forEach(([key, val]) => {
            const td = document.createElement("td");

            if (key === "DATE") td.textContent = excelDateToString(Number(val));
            else if (key === "分組") td.textContent = groupMap[val] || val;
            else if (key === "總分") {
                const score = Number(val);
                const ratio = Math.min(Math.max(score / 9, 0), 1);
                td.style.background = `linear-gradient(to right, #c4e1ff ${ratio * 100}%, #ffffff ${ratio * 100}%)`;
                td.textContent = val;
            } else if (key === "TESG分數") {
                const score = Number(val);
                const ratio = Math.min(Math.max((score - 34.97) / (82.05 - 34.97), 0), 1);
                td.style.background = `linear-gradient(to right, #b7f3b7 ${ratio * 100}%, #ffffff ${ratio * 100}%)`;
                td.textContent = val;
            } else td.textContent = val;

            tr.appendChild(td);
        });
        body.appendChild(tr);
    });
}

// ===== Chart.js =====
function drawYearChart(companyID, year, highlightExcelDate) {
    const yearData = csvData.filter(row => {
        const d = new Date((Number(row["DATE"]) - 25569) * 86400 * 1000);
        return row["ID"] === companyID && d.getFullYear() === year;
    });

    if (yearData.length === 0) {
        clearChart();
        return;
    }

    yearData.sort((a, b) => Number(a["DATE"]) - Number(b["DATE"]));

    const labels = yearData.map(r => excelDateToString(Number(r["DATE"])));
    const prices = yearData.map(r => Number(r["P"]));
    const adjPrices = yearData.map(r => Number(r["Adj_P"]));

    const highlightIndex = yearData.findIndex(r => Number(r["DATE"]) === highlightExcelDate);
    const hasHighlight = highlightIndex !== -1;

    const ctx = document.getElementById("chartCanvas").getContext("2d");
    if (stockChart) stockChart.destroy();

    stockChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "股價 (P)",
                    data: prices,
                    borderColor: "#3b82f6",
                    pointBackgroundColor: "#3b82f6",
                    borderWidth: 2,
                    pointRadius: hasHighlight
                        ? prices.map((_, i) => (i === highlightIndex ? 8 : 0))
                        : prices.map(() => 0),
                    pointHoverRadius: hasHighlight
                        ? prices.map((_, i) => (i === highlightIndex ? 10 : 0))
                        : prices.map(() => 0),
                    tension: 0.2
                },
                {
                    label: "調整後股價 (Adj_P)",
                    data: adjPrices,
                    borderColor: "#22c55e",
                    pointBackgroundColor: "#22c55e",
                    borderWidth: 2,
                    pointRadius: hasHighlight
                        ? adjPrices.map((_, i) => (i === highlightIndex ? 8 : 0))
                        : adjPrices.map(() => 0),
                    pointHoverRadius: hasHighlight
                        ? adjPrices.map((_, i) => (i === highlightIndex ? 10 : 0))
                        : adjPrices.map(() => 0),
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { display: false },
                y: { title: { display: true, text: "價格" } }
            },
            plugins: {
                legend: { position: "top" },
                title: {
                    display: true,
                    text: `${companyID} (${year}) 股價走勢`
                },
                tooltip: {
                    callbacks: {
                        title: (items) => labels[items[0].dataIndex],
                        label: (item) => `${item.dataset.label}: ${item.formattedValue}`
                    }
                }
            }
        }
    });
}

function clearChart() {
    if (stockChart) {
        stockChart.destroy();
        stockChart = null;
    }
}


// 初始化 AOS 動畫
AOS.init({
    duration: 800,
    once: true
});

// 初始化 Tilt 效果
VanillaTilt.init(document.querySelectorAll(".highlight-card"), {
    max: 10,
    speed: 400,
    glare: true,
    "max-glare": 0.3
});

// GSAP ScrollTrigger (淡入浮動光暈)
gsap.utils.toArray(".home-block").forEach(block => {
    gsap.fromTo(block, 
        { opacity: 0, y: 30 },
        {
            opacity: 1,
            y: 0,
            scrollTrigger: {
                trigger: block,
                start: "top 80%",
                toggleActions: "play none none none"
            },
            duration: 0.6,
            ease: "power2.out"
        }
    );
});
