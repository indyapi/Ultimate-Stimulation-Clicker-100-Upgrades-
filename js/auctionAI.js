var activeAuction = null;

async function loadNPCs() {
    try {
        console.log("Fetching NPCs...");
        const response = await fetch('data/npcs.json');
        npcProfiles = await response.json();
        console.log("Loaded " + npcProfiles.length + " NPCs.");
    } catch (e) {
        console.error("Failed to load NPCs:", e);
    }
}

function setupAuction(mode, item, startPrice) {
    let newsMultiplier = 1;
    activeNews.forEach(n => {
        if (n.impact.type === 'artifact') {
            if (n.impact.target === 'All' || item.name.toLowerCase().includes(n.impact.target.toLowerCase())) {
                newsMultiplier *= n.impact.multiplier;
            }
        }
        if ((n.impact.type === 'stock' || n.impact.type === 'crypto') && n.impact.multiplier < 0.8) {
            newsMultiplier *= 1.15; // Safe haven effect
        }
    });

    let hypeChance = 0.05 + (Math.random() * 0.05) * (newsMultiplier > 1 ? 2 : 1); // 5-10% base
    let isHypeMode = (mode === 'sell' && hasMediaHypePass && Math.random() < 0.2) || Math.random() < hypeChance;

    let availableNpcs = npcProfiles.filter(npc => !npc.minLevel || playerLevel >= npc.minLevel);
    if (availableNpcs.length === 0) availableNpcs = [npcProfiles[2]]; // Fallback to หมอสะสมของเก่า

    let activeNpcs = availableNpcs.map(npc => {
        let errorMargin = (1 - npc.trustAppraiser) * (Math.random() > 0.5 ? 1 : -1) * (0.1 + Math.random() * 0.5); 
        
        // NPC perceived value scales with rarity, grade and popularity
        const rarityMult = (typeof rarityMultipliers !== 'undefined' ? rarityMultipliers[item.rarity] : 1) || 1;
        const gradeMult = (typeof gradeMultipliers !== 'undefined' ? gradeMultipliers[item.grade] : 1) || 1;
        const popularity = item.basePopularity || 1;
        
        let basePerceived = (item.realValue || 1000) * rarityMult * gradeMult * popularity * newsMultiplier;
        let perceivedValue = basePerceived * (1 + errorMargin) * npc.greed;
        
        return { ...npc, maxWillingToPay: perceivedValue * npc.wealthMult, isActive: true, thinkTimer: 0 };
    });

    activeAuction = {
        mode, item, currentHighestBid: startPrice, highestBidder: mode === 'sell' ? "คุณเอง" : "NPC",
        timeLeft: 25, isHypeMode, activeNpcs, overbidCount: 0,
        maxOverbids: Math.floor(Math.random() * 3) + 1, lastBidType: 'normal',
        bidsLog: [isHypeMode ? "🔥 ตลาดดุเดือดเริ่มขึ้นแล้ว!" : "📢 เริ่มงานประมูล"]
    };
    renderAuctionSheet();
}

function processAuctionTick() {
    if (!activeAuction) return;
    activeAuction.timeLeft--;
    activeAuction.activeNpcs.forEach(n => { if(n.thinkTimer > 0) n.thinkTimer--; });
    let capableNpcs = activeAuction.activeNpcs.filter(n => n.isActive && activeAuction.currentHighestBid < n.maxWillingToPay && n.thinkTimer <= 0);
    
    if (capableNpcs.length > 0) {
        let decisionChance = activeAuction.isHypeMode ? 0.6 : 0.35;
        if (Math.random() < decisionChance) {
            let bidder = capableNpcs[Math.floor(Math.random() * capableNpcs.length)];
            if (activeAuction.highestBidder !== bidder.name) {
                let isOverbid = false, multiplier = 1;
                if (activeAuction.overbidCount < activeAuction.maxOverbids && (activeAuction.isHypeMode || Math.random() < 0.15)) {
                    let isCounter = activeAuction.lastBidType === 'overbid';
                    if (Math.random() < (isCounter ? 0.25 : 0.70)) {
                        isOverbid = true;
                        multiplier = isCounter ? (1.2 + Math.random() * 0.8) : (1.5 + Math.random() * 1.5);
                    }
                }
                if (isOverbid) {
                    let nextBid = Math.round(activeAuction.currentHighestBid * multiplier);
                    if (nextBid <= bidder.maxWillingToPay) {
                        activeAuction.currentHighestBid = nextBid; activeAuction.highestBidder = bidder.name; activeAuction.overbidCount++; activeAuction.lastBidType = 'overbid';
                        activeAuction.bidsLog.push(`🔥 [เกทับ x${multiplier.toFixed(1)}] ${bidder.name} อัดไปที่ $${formatNumber(nextBid)}!`);
                        activeAuction.activeNpcs.forEach(n => { if(n.name !== bidder.name) n.thinkTimer = Math.floor(Math.random() * 3) + 3; });
                        activeAuction.timeLeft = Math.min(activeAuction.timeLeft + 5, 25);
                    } else isOverbid = false;
                }
                if (!isOverbid) {
                    let raise = Math.round(activeAuction.currentHighestBid * (0.04 + Math.random()*0.06)) + 200;
                    let nextBid = activeAuction.currentHighestBid + raise;
                    if (nextBid <= bidder.maxWillingToPay) {
                        activeAuction.currentHighestBid = nextBid; activeAuction.highestBidder = bidder.name; activeAuction.lastBidType = 'normal';
                        activeAuction.bidsLog.push(`💬 ${bidder.name} สู้ $${formatNumber(nextBid)}`);
                        activeAuction.timeLeft = Math.min(activeAuction.timeLeft + 2, 25);
                        bidder.thinkTimer = Math.floor(bidder.baseDelay + Math.random() * 2);
                    } else { bidder.isActive = false; activeAuction.bidsLog.push(`🏳️ ${bidder.name} ถอนตัว`); }
                }
            }
        }
    }
    if (activeAuction.timeLeft <= 0) concludeAuction();
    else if (currentSheet === 'auction') renderAuctionSheet();
}

function concludeAuction() {
    if (!activeAuction) return;
    if (activeAuction.mode === 'sell') {
        if (activeAuction.highestBidder === "คุณเอง") { 
            playerInventory.push(activeAuction.item); 
            alert("ขายไม่ออก!"); 
        }
        else { 
            score += activeAuction.currentHighestBid; 
            if (typeof addXp === 'function') {
                addXp(Math.max(5, Math.floor(activeAuction.currentHighestBid / 500)));
            }
            alert(`ขายสำเร็จ $${formatNumber(activeAuction.currentHighestBid)}`); 
        }
    } else {
        if (activeAuction.highestBidder === "คุณ (ผู้เล่น)") { 
            playerInventory.push(activeAuction.item); 
            alert("ชนะประมูล!"); 
        }
        else alert(`ตกเป็นของ ${activeAuction.highestBidder}`);
    }
    activeAuction = null; 
    if (typeof updateUI === 'function') updateUI(); 
    renderAuctionSheet();
}

function playerPlaceBid(raise) {
    if (!activeAuction) return;
    let newBid = activeAuction.currentHighestBid + raise;
    if (score >= newBid) {
        score -= raise; activeAuction.currentHighestBid = newBid; activeAuction.highestBidder = "คุณ (ผู้เล่น)";
        activeAuction.bidsLog.push(`🔴 คุณยกป้าย $${formatNumber(newBid)}!`);
        activeAuction.timeLeft = Math.min(activeAuction.timeLeft + 3, 25);
        activeAuction.activeNpcs.forEach(n => { n.thinkTimer = Math.floor(Math.random()*2)+1; });
        renderAuctionSheet();
    } else alert("เงินไม่พอ!");
}
