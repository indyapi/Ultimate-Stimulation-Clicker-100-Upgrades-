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
    if (item.currency === 'adee') return item.baseCost; // Adee items don't scale
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
function setStockCategory(cat) {
    currentStockCategory = cat;
    const unlocked = Object.keys(marketData).filter(k => marketData[k].unlocked);
    const filtered = unlocked.filter(k => marketData[k].type === cat);
    if (filtered.length > 0) currentStockTab = filtered[0];
    renderStockSheet();
}

function renderStockSheet() {
    const container = document.getElementById('stock-content');
    if (!container) return;
    
    let unlocked = Object.keys(marketData).filter(k => marketData[k].unlocked);
    if (unlocked.length === 0) { 
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#888;">⚠️ ซื้อใบอนุมัติเทรดหุ้นในร้านค้าก่อน</div>`; 
        return; 
    }

    const categories = [
        { id: 'stock', label: '📊 หุ้นไทย/ต่างประเทศ' },
        { id: 'crypto', label: '🪙 คริปโตเคอร์เรนซี' },
        { id: 'fund', label: '📈 กองทุนดัชนี' }
    ];

    // Build Category Tabs (Top)
    let html = `<div class="category-tabs" style="display:flex; gap:5px; margin-bottom:15px; overflow-x:auto; padding-bottom:5px;">`;
    categories.forEach(cat => {
        const count = unlocked.filter(k => marketData[k].type === cat.id).length;
        if (count > 0 || cat.id === 'fund') { // Show fund anyway since they start unlocked
            const active = currentStockCategory === cat.id;
            html += `<div class="shop-tab ${active?'active':''}" style="min-width:110px; font-size:0.7rem;" onclick="setStockCategory('${cat.id}')">${cat.label}</div>`;
        }
    });
    html += `</div>`;

    // Filter assets by current category
    const filteredAssets = unlocked.filter(k => marketData[k].type === currentStockCategory);
    
    if (filteredAssets.length === 0) {
        html += `<div style="text-align:center; padding:30px; color:#666; font-size:0.8rem;">ยังไม่ได้ปลดล็อกสินทรัพย์ในหมวดนี้</div>`;
        container.innerHTML = html;
        return;
    }

    if (!currentStockTab || !marketData[currentStockTab] || marketData[currentStockTab].type !== currentStockCategory) {
        currentStockTab = filteredAssets[0];
    }

    // Build Asset Tabs (Secondary)
    html += `<div class="asset-tabs" style="display:flex; gap:8px; overflow-x:auto; margin-bottom:12px; padding-bottom:5px;">`;
    filteredAssets.forEach(k => {
        const active = currentStockTab === k;
        html += `<div class="asset-tab ${active?'active':''}" style="font-size:0.7rem; padding:6px 12px;" onclick="currentStockTab='${k}'; renderStockSheet();">${marketData[k].label}</div>`;
    });
    html += `</div>`;

    let s = marketData[currentStockTab];
    let pnl = (s.owned * s.price) - s.invested;
    
    html += `<div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <b style="font-size:1.1rem;">${s.name}</b> 
            <b style="color:#ffcc00; font-size:1.1rem;">$${formatNumber(s.price)}</b>
        </div>
        <div class="chart-container"><svg class="chart-svg" id="live-chart-${currentStockTab}"></svg></div>
        <div style="font-size:0.8rem; margin:10px 0; color:#888; display:flex; justify-content:space-between;">
            <span>ถือครอง: ${s.owned} หน่วย</span> 
            <span>กำไร/ขาดทุน: <b class="${pnl>=0?'pnl-positive':'pnl-negative'}">$${formatNumber(pnl)}</b></span>
        </div>
        <div style="display:flex; gap:8px;">
            <button class="btn-action btn-success" onclick="buyStock('${currentStockTab}')">ซื้อสะสม</button>
            <button class="btn-action btn-danger" onclick="sellStock('${currentStockTab}')">ขายทำกำไร</button>
        </div>
    </div>`;

    container.innerHTML = html;
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
        // Level up reward: Adee Coin
        adeeCoin += Math.floor(playerLevel / 10) + 1;
    }
    updateUI();
}

function watchAd(onFinish) {
    const now = Date.now();
    if (!onFinish && now < nextAdAvailableTime) {
        const remaining = Math.ceil((nextAdAvailableTime - now) / 1000);
        alert(`รออีก ${remaining} วินาทีเพื่อดูโฆษณาครั้งต่อไป`);
        return;
    }

    const overlay = document.getElementById('ad-overlay');
    const timer = document.getElementById('ad-timer');
    const closeBtn = document.getElementById('close-ad-btn');
    if (!overlay || !timer || !closeBtn) return;

    overlay.style.display = 'flex';
    let timeLeft = 15;
    timer.innerText = timeLeft;
    closeBtn.disabled = true;
    closeBtn.style.background = '#444';
    closeBtn.style.color = '#888';
    closeBtn.style.cursor = 'not-allowed';

    const interval = setInterval(() => {
        timeLeft--;
        timer.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(interval);
            closeBtn.disabled = false;
            closeBtn.style.background = '#00ffcc';
            closeBtn.style.color = '#000';
            closeBtn.style.cursor = 'pointer';
        }
    }, 1000);

    window.currentAdCallback = onFinish;
}

function finishAd() {
    const overlay = document.getElementById('ad-overlay');
    if (overlay) overlay.style.display = 'none';
    
    if (window.currentAdCallback) {
        window.currentAdCallback();
        window.currentAdCallback = null;
    } else {
        adeeCoin += 1;
        nextAdAvailableTime = Date.now() + 60000;
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
    
    if (item.currency === 'adee') {
        if (adeeCoin >= cost && cost !== Infinity) {
            adeeCoin -= cost;
            item.count++;
            applyItemEffect(item);
            updateUI();
            renderShop();
        } else if (cost !== Infinity) {
            alert("Adee Coin ไม่พอ!");
        }
    } else {
        if (score >= cost && cost !== Infinity) {
            score -= cost;
            item.count++;
            addXp(Math.max(1, Math.floor(cost / 100)));
            applyItemEffect(item);
            cpc += item.cpcAdd || 0; 
            cps = items.reduce((sum, it) => sum + (it.count * (it.cpsAdd||0)), 0);
            updateUI(); 
            renderShop();
        }
    }
}

function applyItemEffect(item) {
    if (item.isUnlock) marketData[item.isUnlock].unlocked = true;
    if (item.specialUnlock === "antique_ticket") hasAntiqueTicket = true;
    if (item.specialUnlock === "archeologist") archeologistLevel = item.count;
    if (item.specialUnlock === "appraiser") appraiserLevel = item.count;
    if (item.specialUnlock === "news_subscription") {
        hasNewsSubscription = true;
        const ticker = document.getElementById('news-ticker');
        if (ticker) ticker.style.display = 'block';
    }
    if (item.specialUnlock === "ad_ticket") {
        adTicketExpiry = Date.now() + (24 * 60 * 60 * 1000);
        setTimeout(() => watchAd(() => { console.log("Ad Ticket Purchase Ad Finished"); }), 100);
    }
    // Unique Items
    if (item.specialUnlock === "quantum_lens") window.hasQuantumLens = true;
    if (item.specialUnlock === "carter_journal") window.hasCarterJournal = true;
    if (item.specialUnlock === "echoes_past") window.hasEchoesPast = true;
    if (item.specialUnlock === "collector_aura") window.hasCollectorAura = true;
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
            const isAdee = item.currency === 'adee';
            const canAfford = isAdee ? adeeCoin >= cost : score >= cost;
            const div = document.createElement('div');
            div.className = `shop-item ${!canAfford || cost === Infinity ? 'disabled' : ''}`;
            if (isAdee) div.classList.add('adee-item');
            div.id = `shop-item-${item.id}`;
            div.onclick = () => buyItem(item.id);
            
            const costText = cost === Infinity ? 'MAX' : (isAdee ? `🪙 ${cost}` : `$${formatNumber(cost)}`);
            div.innerHTML = `<div class="item-info"><div class="item-name">${item.name}</div><div class="item-cost" style="color:${isAdee?'#ffcc00':''}">${costText}</div><div class="item-desc">${item.desc}</div></div><div class="item-count">${item.maxLevel ? 'Lv.'+item.count : item.count}</div>`;
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
    const adeeEl = document.getElementById('adee-display');
    
    if (levelEl) levelEl.innerText = `Lv. ${playerLevel}`;
    if (titleEl) titleEl.innerText = playerTitle;
    if (adeeEl) adeeEl.innerText = `🪙 ${adeeCoin}`;
    if (xpBarFill) {
        const needed = getXpNeeded(playerLevel);
        const percent = (playerXP / needed) * 100;
        xpBarFill.style.width = `${percent}%`;
    }

    // Ad Button Cooldown
    const adBtn = document.getElementById('watch-ad-btn');
    if (adBtn) {
        const now = Date.now();
        if (now < nextAdAvailableTime) {
            const rem = Math.ceil((nextAdAvailableTime - now) / 1000);
            adBtn.innerText = `📺 รอ (${rem}s)`;
            adBtn.classList.add('disabled');
            adBtn.disabled = true;
        } else {
            adBtn.innerText = `📺 ดูโฆษณา (+1 Adee)`;
            adBtn.classList.remove('disabled');
            adBtn.disabled = false;
        }
    }

    if (items) {
        items.forEach(item => {
            const el = document.getElementById(`shop-item-${item.id}`);
            if (el) { 
                const cost = getCost(item); 
                const canAfford = item.currency === 'adee' ? adeeCoin >= cost : score >= cost;
                if (!canAfford || cost === Infinity) el.classList.add('disabled'); 
                else el.classList.remove('disabled'); 
            }
        });
    }
}

function applyDevMode() {
    const s = document.getElementById('dev-score').value;
    const l = document.getElementById('dev-level').value;
    const a = document.getElementById('dev-adee').value;
    const cpsVal = document.getElementById('dev-cps').value;
    const cpcVal = document.getElementById('dev-cpc').value;

    if (s !== "") score = parseFloat(s);
    if (l !== "") {
        playerLevel = parseInt(l);
        playerXP = 0;
        updateTitle();
    }
    if (a !== "") adeeCoin = parseInt(a);
    if (cpsVal !== "") cps = parseFloat(cpsVal);
    if (cpcVal !== "") cpc = parseFloat(cpcVal);

    updateUI();
    closeSecret();
    console.log("DevMode: Changes applied.");
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
                let vol = marketData[k].volatility || 1.0;
                marketData[k].price *= (1 + (Math.random() * 0.06 - 0.03) * vol) * multiplier; 
                if (!marketData[k].history) marketData[k].history = [];
                marketData[k].history.push(marketData[k].price); 
                if(marketData[k].history.length > 20) marketData[k].history.shift(); 
            });
        }
        if (currentSheet === 'stock') renderStockSheet();
    }, 2000);
    setInterval(() => { newsCycle(); }, 120000); 
    
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

function setAuctionPriceUnit(unit) {
    if (auctionPriceUnit === unit) auctionPriceUnit = 1; 
    else auctionPriceUnit = unit;
    renderAuctionSheet();
}

function startPlayerAuction() { 
    const idx = window.selectedInventoryIndex;
    let pr = parseFloat(document.getElementById('auc-price').value); 
    if (idx !== null && idx !== undefined && pr > 0) {
        pr *= auctionPriceUnit;
        const item = playerInventory.splice(idx, 1)[0];
        setupAuction('sell', item, pr); 
        window.selectedInventoryIndex = null;
        auctionPriceUnit = 1;
        const selectBtn = document.getElementById('select-item-btn');
        if (selectBtn) selectBtn.innerText = "📦 คลิกเลือกไอเท็ม";
    } else {
        alert("กรุณาเลือกไอเท็มและระบุราคาเริ่มต้น");
    }
}

function openInventoryModal() {
    const modal = document.getElementById('inventory-modal');
    const grid = document.getElementById('inventory-grid');
    const detail = document.getElementById('selected-item-detail');
    if (!modal || !grid || !detail) return;

    detail.style.display = 'none';
    grid.innerHTML = "";
    
    if (playerInventory.length === 0) {
        grid.innerHTML = `<div style="grid-column: span 2; color:#666; padding:20px; text-align:center;">คลังว่างเปล่า...</div>`;
    } else {
        playerInventory.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.cursor = 'pointer';
            card.style.margin = '0';
            card.style.border = '1px solid #333';
            card.style.padding = '10px';
            card.onclick = () => selectInventoryItem(index);
            card.innerHTML = `
                <div style="font-size:0.8rem; font-weight:bold; color:#eee;">${item.name}</div>
                <div style="font-size:0.7rem; color:#ffcc00; margin-top:5px;">$${formatNumber(item.marketPrice)}</div>
            `;
            grid.appendChild(card);
        });
    }

    modal.style.display = 'flex';
}

function closeInventoryModal() {
    document.getElementById('inventory-modal').style.display = 'none';
}

function selectInventoryItem(index) {
    const item = playerInventory[index];
    const detail = document.getElementById('selected-item-detail');
    const nameEl = document.getElementById('detail-name');
    const priceEl = document.getElementById('detail-price');
    const descEl = document.getElementById('detail-desc');
    const confirmBtn = document.getElementById('confirm-select-btn');

    nameEl.innerText = item.name;
    priceEl.innerText = `ราคาตลาด: $${formatNumber(item.marketPrice)}`;
    descEl.innerText = item.description;
    
    window.selectedInventoryIndex = index;
    
    confirmBtn.onclick = () => {
        const selectBtn = document.getElementById('select-item-btn');
        if (selectBtn) selectBtn.innerText = `✅ ${item.name}`;
        closeInventoryModal();
    };

    detail.style.display = 'block';
}

function getExpertReportHTML(item) {
    if (!archeologistLevel && !appraiserLevel) return "";
    
    // Quantum Appraisal Lens effect: Reveal full details immediately
    if (window.hasQuantumLens) {
        return `<div class="expert-box">
            ✨ <b>Quantum Report:</b><br>
            ความหายาก: ${item.rarity.toUpperCase()}<br>
            เกรด: ${item.grade.replace('_', ' ').toUpperCase()}<br>
            ราคาตลาดโดยประมาณ: $${formatNumber(item.marketPrice)}
        </div>`;
    }

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
        const u = auctionPriceUnit;
        container.innerHTML = `<div class="card"><button class="btn-action btn-primary" onclick="setupAuction('buy', generateProceduralAntique(), 1000)">🎰 ส่องงานประมูล NPC</button></div>
        <div class="card">
            <b>🔨 จัดโต๊ะประมูล</b><br>
            <button class="btn-action" id="select-item-btn" onclick="openInventoryModal()" style="background:#1c1c24; border:1px solid #333; margin:10px 0;">📦 คลิกเลือกไอเท็ม</button>
            <div style="display:flex; gap:5px; margin-bottom:10px;">
                <input type="number" id="auc-price" class="input-box" placeholder="ราคาเริ่มต้น" value="1000" style="margin-bottom:0; flex:1;">
                <div style="display:flex; gap:3px;">
                    <div class="asset-tab ${u===1e6?'active':''}" style="padding:10px; min-width:40px; text-align:center;" onclick="setAuctionPriceUnit(1e6)">M</div>
                    <div class="asset-tab ${u===1e9?'active':''}" style="padding:10px; min-width:40px; text-align:center;" onclick="setAuctionPriceUnit(1e9)">B</div>
                    <div class="asset-tab ${u===1e12?'active':''}" style="padding:10px; min-width:40px; text-align:center;" onclick="setAuctionPriceUnit(1e12)">T</div>
                </div>
            </div>
            <button class="btn-action btn-success" onclick="startPlayerAuction()">เปิดประมูล</button>
        </div>`;
    } else {
        let raise = Math.round(activeAuction.currentHighestBid * 0.1) || 500;
        container.innerHTML = `<div class="card"><b>${activeAuction.item.name}</b> [${activeAuction.timeLeft}s]<div class="expert-box" style="margin-bottom:10px; font-style:italic; font-size:0.85rem;">"${activeAuction.item.description}"</div><div style="background:#000; text-align:center; padding:15px; margin:10px 0; border-radius:10px; border:1px solid #333;"><div style="color:#00ffcc; font-size:1.8rem; font-weight:900;">$${formatNumber(activeAuction.currentHighestBid)}</div><div style="font-size:0.7rem; color:#666;">โดย: ${activeAuction.highestBidder}</div></div>
        <div class="auction-log"><div>${activeAuction.bidsLog.map(l => `<div>${l}</div>`).join('')}</div></div>
        <div style="margin-top:10px;">${activeAuction.mode==='sell'?'<button class="btn-action btn-danger" onclick="concludeAuction()">ปิดดีล</button>':`<button class="btn-action btn-success" onclick="playerPlaceBid(${raise})">✋ ยกป้าย (+$${formatNumber(raise)})</button>`}</div></div>`;
    }
}