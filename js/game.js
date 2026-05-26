// --- 1. CORE ENGINE & UI ---
const formatNumber = (num) => {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return Math.floor(num).toLocaleString();
};

// --- 2. DATA LOADING ---
async function loadItems() {
    try {
        console.log("Fetching items...");
        const response = await fetch('data/items.json');
        const data = await response.json();
        items = data.map(item => ({ ...item, count: 0 }));
        console.log("Loaded " + items.length + " items.");
    } catch (e) {
        console.error("Failed to load items:", e);
    }
}

async function loadNews() {
    try {
        console.log("Fetching news...");
        const response = await fetch('data/news.json');
        newsData = await response.json();
        console.log("Loaded " + newsData.length + " news entries.");
    } catch (e) {
        console.error("Failed to load news:", e);
    }
}

function getCost(item) {
    if (item.isOnetime && item.count > 0) return Infinity;
    if (item.maxLevel && item.count >= item.maxLevel) return Infinity;
    const scaling = item.specialUnlock === "archeologist" || item.specialUnlock === "appraiser" ? 5.0 : (item.maxLevel ? 3.0 : 1.15);
    return Math.round(item.baseCost * Math.pow(scaling, item.count)); 
}

// --- 3. UI HANDLERS & RESIZING ---
function toggleSheet(sheetId) {
    const current = document.getElementById(`sheet-${sheetId}`);
    if (currentSheet === sheetId) { current.classList.remove('active'); currentSheet = null; document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); }
    else {
        document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        current.classList.add('active');
        const navItem = document.getElementById(`nav-${sheetId}`);
        if (navItem) navItem.classList.add('active');
        currentSheet = sheetId;
        current.style.height = "60vh";
        if (sheetId === 'stock') renderStockSheet();
        if (sheetId === 'antique') renderAntiqueSheet();
        if (sheetId === 'auction') renderAuctionSheet();
    }
}
function closeSheet(id) { toggleSheet(id); }

function initSplitResizer() {
    const divider = document.getElementById('ui-divider');
    const gameplay = document.getElementById('main-gameplay');
    const shop = document.getElementById('persistent-shop');
    if (!divider || !gameplay || !shop) return;

    const startResize = (e) => {
        isDraggingDivider = true;
        document.body.style.cursor = 'ns-resize';
    };

    const doResize = (e) => {
        if (!isDraggingDivider) return;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        const wrapper = document.getElementById('game-wrapper');
        const wrapperRect = wrapper.getBoundingClientRect();
        const relativeY = clientY - wrapperRect.top;
        
        let percentage = (relativeY / wrapperRect.height) * 100;
        if (percentage < 10) percentage = 10;
        if (percentage > 85) percentage = 85;

        gameplay.style.height = `${percentage}%`;
        shop.style.height = `${100 - percentage}%`;
    };

    const stopResize = () => {
        isDraggingDivider = false;
        document.body.style.cursor = 'default';
    };

    divider.addEventListener('mousedown', startResize);
    divider.addEventListener('touchstart', startResize);
    window.addEventListener('mousemove', doResize);
    window.addEventListener('touchmove', doResize);
    window.addEventListener('mouseup', stopResize);
    window.addEventListener('touchend', stopResize);
}

function initSheetResizer() {
    const startDrag = (e) => { if(!currentSheet) return; isDraggingSheet = true; sheetStartY = e.type.includes('touch')?e.touches[0].clientY:e.clientY; sheetStartHeight = document.getElementById(`sheet-${currentSheet}`).offsetHeight; document.getElementById(`sheet-${currentSheet}`).style.transition = "none"; };
    const drag = (e) => { if(!isDraggingSheet || !currentSheet) return; const curY = e.type.includes('touch')?e.touches[0].clientY:e.clientY; let newH = sheetStartHeight + (sheetStartY - curY); if (newH < 80) { toggleSheet(currentSheet); isDraggingSheet = false; return; } document.getElementById(`sheet-${currentSheet}`).style.height = newH + "px"; };
    const endDrag = () => { if(isDraggingSheet && currentSheet) document.getElementById(`sheet-${currentSheet}`).style.transition = "transform 0.3s, height 0.2s"; isDraggingSheet = false; };
    document.querySelectorAll('.drag-handle').forEach(h => { h.onmousedown = startDrag; h.ontouchstart = startDrag; });
    window.addEventListener('mousemove', drag); window.addEventListener('touchmove', drag); window.addEventListener('mouseup', endDrag); window.addEventListener('touchend', endDrag);
}

// --- 4. SHEET RENDERING ---
function renderStockSheet() {
    const container = document.getElementById('stock-content');
    if (!container) return;
    let unlocked = Object.keys(marketData).filter(k => marketData[k].unlocked);
    if (unlocked.length === 0) { container.innerHTML = `<div style="text-align:center; padding:40px; color:#888;">⚠️ ซื้อใบอนุมัติเทรดหุ้นในร้านค้าก่อน</div>`; return; }
    if (!currentStockTab || !marketData[currentStockTab].unlocked) currentStockTab = unlocked[0];
    
    let tabsHtml = `<div class="asset-tabs">` + unlocked.map(k => `<div class="asset-tab ${currentStockTab===k?'active':''}" onclick="currentStockTab='${k}'; renderStockSheet();">${marketData[k].label}</div>`).join('') + `</div>`;
    let s = marketData[currentStockTab];
    let pnl = (s.owned * s.price) - s.invested;
    
    container.innerHTML = tabsHtml + `<div class="card"><div style="display:flex; justify-content:space-between;"><b>${s.name}</b> <b style="color:#ffcc00">$${formatNumber(s.price)}</b></div>
    <div class="chart-container"><svg class="chart-svg" id="live-chart-${currentStockTab}"></svg></div>
    <div style="font-size:0.8rem; margin:10px 0; color:#888; display:flex; justify-content:space-between;"><span>ถือ: ${s.owned}</span> <span>กำไร: <b class="${pnl>=0?'pnl-positive':'pnl-negative'}">$${formatNumber(pnl)}</b></span></div>
    <div style="display:flex; gap:8px;"><button class="btn-action btn-success" onclick="buyStock('${currentStockTab}')">ซื้อ</button><button class="btn-action btn-danger" onclick="sellStock('${currentStockTab}')">ขาย</button></div></div>`;
    renderChart(currentStockTab);
}

function renderChart(key) {
    const svg = document.getElementById(`live-chart-${key}`); if(!svg) return;
    const history = marketData[key].history; if(history.length < 2) return;
    const min = Math.min(...history), max = Math.max(...history), range = max - min || 1, w = svg.clientWidth, h = 80;
    let pts = history.map((p, i) => `${(i/(history.length-1))*w},${h - (((p-min)/range)*60 + 10)}`);
    svg.innerHTML = `<polyline fill="none" stroke="${history[history.length-1]>=history[history.length-2]?'#00c805':'#ff3b30'}" stroke-width="2" points="${pts.join(' ')}" />`;
}

// --- 5. ENGINE ---
function getXpNeeded(lv) {
    return Math.floor(100 * Math.pow(1.35, lv));
}

function updateTitle() {
    if (playerLevel >= 900) playerTitle = "พระเจ้าแห่งการกระตุ้น";
    else if (playerLevel >= 750) playerTitle = "ผู้คุมกฎมิติกาแล็กซี";
    else if (playerLevel >= 600) playerTitle = "มหาเศรษฐีข้ามดวงดาว";
    else if (playerLevel >= 450) playerTitle = "เจ้าพ่อตลาดหุ้นจักรวาล";
    else if (playerLevel >= 300) playerTitle = "ผู้เชี่ยวชาญระดับตำนาน";
    else if (playerLevel >= 150) playerTitle = "นักลงทุนมืออาชีพ";
    else if (playerLevel >= 50) playerTitle = "พ่อค้าหน้าใหม่ไฟแรง";
    else playerTitle = "มือใหม่";
    
    const titleEl = document.getElementById('player-title');
    if (titleEl) titleEl.innerText = playerTitle;
}

function addXp(amount) {
    playerXP += amount;
    let needed = getXpNeeded(playerLevel);
    while (playerXP >= needed && playerLevel < 999) {
        playerXP -= needed;
        playerLevel++;
        needed = getXpNeeded(playerLevel);
        console.log(`Level Up! Now Level ${playerLevel}`);
        updateTitle();
        // Level up reward: +1% CPS Global is handled in getTotalCPSMultiplier
    }
    updateUI();
}

function buyStock(k) { 
    let s = marketData[k]; 
    if (score >= s.price) { 
        score -= s.price; 
        s.owned++; 
        s.invested += s.price; 
        addXp(Math.max(1, Math.floor(s.price / 1000)));
        updateUI(); 
        renderStockSheet(); 
    } 
}

function sellStock(k) { 
    let s = marketData[k]; 
    if (s.owned > 0) { 
        let profit = s.price - (s.invested / s.owned);
        score += s.price; 
        let avg = s.invested / s.owned; 
        s.owned--; 
        s.invested -= avg; 
        if (profit > 0) addXp(Math.max(1, Math.floor(profit / 500)));
        updateUI(); 
        renderStockSheet(); 
    } 
}

function buyItem(id) {
    const item = items.find(it => it.id === id);
    if (!item) return;
    const cost = getCost(item);
    if (score >= cost && cost !== Infinity) {
        score -= cost; item.count++;
        addXp(Math.max(1, Math.floor(cost / 100)));
        if (item.isUnlock) marketData[item.isUnlock].unlocked = true;
        if (item.specialUnlock === "antique_ticket") hasAntiqueTicket = true;
        if (item.specialUnlock === "archeologist") archeologistLevel = item.count;
        if (item.specialUnlock === "appraiser") appraiserLevel = item.count;
        if (item.specialUnlock === "news_subscription") {
            hasNewsSubscription = true;
            const ticker = document.getElementById('news-ticker');
            if (ticker) ticker.style.display = 'block';
        }
        cpc += item.cpcAdd || 0; cps = items.reduce((sum, it) => sum + (it.count * (it.cpsAdd||0)), 0);
        updateUI(); renderShop();
    }
}

function newsCycle() {
    if (!newsData || !newsData.length) return;
    const news = newsData[Math.floor(Math.random() * newsData.length)];
    activeNews.push({ ...news, startTime: Date.now() });
    
    if (hasNewsSubscription) {
        const ticker = document.getElementById('news-text');
        if (ticker) {
            ticker.innerText = `[ข่าวด่วน] ${news.title}: ${news.content} (ผลกระทบ: ${news.impact.type} ${news.impact.target} x${news.impact.multiplier})`;
            ticker.style.animation = 'none';
            ticker.offsetHeight; 
            ticker.style.animation = null;
        }
    }

    if (news.impact.type === 'stock' || news.impact.type === 'crypto') {
        const target = news.impact.target;
        if (target === 'All') {
            Object.keys(marketData).forEach(k => {
                if ((news.impact.type === 'stock' && k !== 'bitcoin') || (news.impact.type === 'crypto' && k === 'bitcoin')) {
                    marketData[k].price *= news.impact.multiplier;
                }
            });
        } else if (marketData[target]) {
            marketData[target].price *= news.impact.multiplier;
        }
    }
    activeNews = activeNews.filter(n => (Date.now() - n.startTime) < (n.duration * 1000));
}

function renderShop() {
    const list = document.getElementById('shop-list-container');
    if (!list) return;
    const searchInput = document.getElementById('shop-search');
    const search = searchInput ? searchInput.value.toLowerCase() : "";
    list.innerHTML = "";
    if (!items || items.length === 0) {
        list.innerHTML = "<div style='color:#666; text-align:center; padding:20px;'>กำลังโหลดไอเท็ม...</div>";
        return;
    }
    items.forEach(item => {
        const cost = getCost(item);
        const matchTab = (shopTab === 'onetime' && (item.isOnetime || item.maxLevel)) || (shopTab === 'upgrade' && !item.isOnetime && !item.maxLevel);
        const matchLevel = !item.minLevel || playerLevel >= item.minLevel;
        
        if (matchTab && matchLevel && item.name.toLowerCase().includes(search)) {
            const div = document.createElement('div');
            div.className = `shop-item ${score < cost || cost === Infinity ? 'disabled' : ''}`;
            div.id = `shop-item-${item.id}`;
            div.onclick = () => buyItem(item.id);
            div.innerHTML = `<div class="item-info"><div class="item-name">${item.name}</div><div class="item-cost">${cost === Infinity ? 'MAX' : '$'+formatNumber(cost)}</div><div class="item-desc">${item.desc}</div></div><div class="item-count">${item.maxLevel ? 'Lv.'+item.count : item.count}</div>`;
            list.appendChild(div);
        }
    });
}

function updateUI() {
    const scoreEl = document.getElementById('score-display');
    const cpsEl = document.getElementById('cps-display');
    if (scoreEl) scoreEl.innerText = formatNumber(score);
    if (cpsEl) cpsEl.innerText = `CPS: ${formatNumber(cps)} | พลังคลิก: ${formatNumber(cpc)}`;
    
    // Level UI
    const levelEl = document.getElementById('player-level');
    const titleEl = document.getElementById('player-title');
    const xpBarFill = document.getElementById('xp-bar-fill');
    if (levelEl) levelEl.innerText = `Lv. ${playerLevel}`;
    if (titleEl) titleEl.innerText = playerTitle;
    if (xpBarFill) {
        const needed = getXpNeeded(playerLevel);
        const percent = (playerXP / needed) * 100;
        xpBarFill.style.width = `${percent}%`;
    }

    if (items) {
        items.forEach(item => {
            const el = document.getElementById(`shop-item-${item.id}`);
            if (el) { const cost = getCost(item); if (score < cost || cost === Infinity) el.classList.add('disabled'); else el.classList.remove('disabled'); }
        });
    }
}

async function init() {
    console.log("Game initializing...");
    await loadItems();
    await loadNews();
    await loadAncientArtifacts();
    await loadStocks();
    await loadNPCs();
    
    const clickBtn = document.getElementById('click-btn');
    if (clickBtn) {
        clickBtn.addEventListener('click', () => { 
            score += cpc; 
            addXp(1);
            updateUI(); 
        });
    }
    
    window.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === '1') { e.preventDefault(); document.getElementById('secret-modal').style.display = 'flex'; }
    });
    
    initSplitResizer();
    initSheetResizer();
    
    setInterval(() => { score += (cps * getTotalCPSMultiplier()) / 10; updateUI(); }, 100);
    setInterval(() => { if (typeof processAuctionTick === 'function') processAuctionTick(); }, 1000);
    setInterval(() => {
        activeNews = activeNews.filter(n => (Date.now() - n.startTime) < (n.duration * 1000));
        if (typeof marketData !== 'undefined') {
            Object.keys(marketData).forEach(k => { 
                let multiplier = getActiveMarketMultiplier(k);
                marketData[k].price *= (1 + (Math.random() * 0.06 - 0.03)) * multiplier; 
                if (!marketData[k].history) marketData[k].history = [];
                marketData[k].history.push(marketData[k].price); 
                if(marketData[k].history.length > 20) marketData[k].history.shift(); 
            });
        }
        if (currentSheet === 'stock') renderStockSheet();
    }, 2000);
    setInterval(() => { newsCycle(); }, Math.random() * 30000 + 30000); 
    
    renderShop();
    updateUI();
    console.log("Game initialized successfully.");
}

function getTotalCPSMultiplier() {
    let mult = 1 + (playerLevel * 0.01); // +1% per level
    activeNews.forEach(n => {
        if (n.impact.type === 'general' && n.impact.target === 'All') {
            mult *= n.impact.multiplier;
        }
    });
    return mult;
}


function getActiveMarketMultiplier(key) {
    let mult = 1;
    activeNews.forEach(n => {
        if ((n.impact.type === 'stock' && key !== 'bitcoin') || (n.impact.type === 'crypto' && key === 'bitcoin')) {
            if (n.impact.target === 'All' || n.impact.target === key) {
                mult *= (1 + (n.impact.multiplier - 1) * 0.1); 
            }
        }
    });
    return mult;
}

function setSecretScore() {
    const val = parseFloat(document.getElementById('secret-input').value);
    if (!isNaN(val)) { score = val; updateUI(); closeSecret(); }
}
function closeSecret() { document.getElementById('secret-modal').style.display = 'none'; }

window.onload = init;

// External placeholders (these call functions defined in market.js / auctionAI.js)
function renderAntiqueSheet() {
    const container = document.getElementById('antique-content');
    if (!container) return;
    if (!hasAntiqueTicket) { container.innerHTML = `<div style="text-align:center; padding:40px; color:#888;">⚠️ ต้องมีบัตรเข้าตลาดโบราณ</div>`; return; }
    if (!currentMarketItem && typeof generateProceduralAntique === 'function') currentMarketItem = generateProceduralAntique();
    if (!currentMarketItem) { container.innerHTML = `<div style="text-align:center; padding:40px; color:#888;">กำลังค้นหาวัตถุโบราณ...</div>`; return; }
    let expert = getExpertReportHTML(currentMarketItem);
    container.innerHTML = `<div class="card"><b>${currentMarketItem.name}</b><div class="antique-story">"${currentMarketItem.description}"</div>${expert}<button class="btn-action btn-success" onclick="buyAntique()">ซื้อเข้าคลัง ($${formatNumber(currentMarketItem.marketPrice)})</button></div>`;
}
function buyAntique() { 
    if (currentMarketItem && score >= currentMarketItem.marketPrice) { 
        score -= currentMarketItem.marketPrice; 
        playerInventory.push(currentMarketItem); 
        addXp(Math.max(10, Math.floor(currentMarketItem.marketPrice / 1000)));
        currentMarketItem = typeof generateProceduralAntique === 'function' ? generateProceduralAntique() : null; 
        alert("สำเร็จ!"); 
        updateUI(); 
        renderAntiqueSheet(); 
    } 
}
function startPlayerAuction() { const idx = document.getElementById('auc-select').value; const pr = parseFloat(document.getElementById('auc-price').value); if (pr > 0) setupAuction('sell', playerInventory.splice(idx,1)[0], pr); }
function getExpertReportHTML(item) {
    if (!archeologistLevel && !appraiserLevel) return "";
    let h = `<div class="expert-box">`;
    if (archeologistLevel) {
        h += `🕵️ <b>โบราณคดี (Lv.${archeologistLevel}):</b> `;
        if (archeologistLevel >= 1) h += `ความหายาก: ${item.rarity.toUpperCase()} | `;
        if (archeologistLevel >= 2) h += `ประวัติ: ${item.grade === 'fake' ? 'ของปลอมทำเหมือน' : 'ของแท้ดั้งเดิม'} | `;
        if (archeologistLevel >= 3) h += `ยุคสมัย: ${item.grade === 'ancient_true' ? 'ยุคบรรพกาล' : 'ยุคหลัง'}`;
        h += `<br>`;
    }
    if (appraiserLevel) {
        h += `🧮 <b>นักประเมิน (Lv.${appraiserLevel}):</b> `;
        const levelKey = "level" + appraiserLevel;
        const appraisal = item.appraisalLevels ? item.appraisalLevels[levelKey] : null;
        if (appraisal) {
            h += `ราคาประเมิน: $${formatNumber(appraisal.estimatedValue)} | `;
            if (appraiserLevel >= 2) h += `ความมั่นใจ: ${appraisal.estimatedReal} | `;
            if (appraiserLevel >= 3) h += `เกรด: ${item.grade.replace('_', ' ').toUpperCase()}`;
        } else {
            h += `ยังไม่สามารถประเมินได้`;
        }
    }
    return h + `</div>`;
}
function renderAuctionSheet() {
    const container = document.getElementById('auction-content');
    if (!container) return;
    if (!hasAntiqueTicket) { container.innerHTML = `<div style="text-align:center; padding:40px; color:#888;">⚠️ ต้องมีบัตรเข้าตลาดโบราณ</div>`; return; }
    if (typeof activeAuction === 'undefined') return;
    if (!activeAuction) {
        let opts = playerInventory.map((it, i) => `<option value="${i}">${it.name}</option>`).join('');
        container.innerHTML = `<div class="card"><button class="btn-action btn-primary" onclick="setupAuction('buy', generateProceduralAntique(), 1000)">🎰 ส่องงานประมูล NPC</button></div>
        <div class="card"><b>🔨 จัดโต๊ะประมูล</b><br>${playerInventory.length?'<select id="auc-select" class="input-box">'+opts+'</select><input type="number" id="auc-price" class="input-box" value="1000"><button class="btn-action btn-success" onclick="startPlayerAuction()">เปิดประมูล</button>':'คลังว่าง'}</div>`;
    } else {
        let raise = Math.round(activeAuction.currentHighestBid * 0.1) || 500;
        container.innerHTML = `<div class="card"><b>${activeAuction.item.name}</b> [${activeAuction.timeLeft}s]<div class="expert-box" style="margin-bottom:10px; font-style:italic; font-size:0.85rem;">"${activeAuction.item.description}"</div><div style="background:#000; text-align:center; padding:15px; margin:10px 0; border-radius:10px; border:1px solid #333;"><div style="color:#00ffcc; font-size:1.8rem; font-weight:900;">$${formatNumber(activeAuction.currentHighestBid)}</div><div style="font-size:0.7rem; color:#666;">โดย: ${activeAuction.highestBidder}</div></div>
        <div class="auction-log"><div>${activeAuction.bidsLog.map(l => `<div>${l}</div>`).join('')}</div></div>
        <div style="margin-top:10px;">${activeAuction.mode==='sell'?'<button class="btn-action btn-danger" onclick="concludeAuction()">ปิดดีล</button>':`<button class="btn-action btn-success" onclick="playerPlaceBid(${raise})">✋ ยกป้าย (+$${formatNumber(raise)})</button>`}</div></div>`;
    }
}
