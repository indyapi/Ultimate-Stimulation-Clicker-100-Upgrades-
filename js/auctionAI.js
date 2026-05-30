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
    let hypeLevel = 0; // 0 to 5
    let newsMultiplier = 1;
    activeNews.forEach(n => {
        if (n.impact.type === 'artifact') {
            if (n.impact.target === 'All' || item.rarity.toLowerCase() === n.impact.target.toLowerCase()) {
                hypeLevel += 1.5;
                newsMultiplier *= n.impact.multiplier;
            }
        }
    });

    // Categorize NPCs by wealth Mult: Poor < 2, Middle 2-10, Rich 10-50, Billionaire > 50
    let availableNpcs = npcProfiles.filter(npc => !npc.minLevel || playerLevel >= npc.minLevel);
    
    // Filter based on Hype Level
    let pool = [];
    if (hypeLevel < 1) {
        pool = availableNpcs.filter(n => n.wealthMult < 10); // Mostly poor/middle
    } else if (hypeLevel < 3) {
        pool = availableNpcs.filter(n => n.wealthMult < 50); // Include rich
    } else {
        pool = availableNpcs; // Everyone comes to hyped auctions
    }

    // Ensure at least 3 NPCs
    if (pool.length < 3) pool = availableNpcs.slice(0, 5);
    
    // Pick 3-6 random NPCs from the pool
    let selected = [];
    let poolCopy = [...pool];
    let count = Math.floor(Math.random() * 4) + 3;
    for (let i = 0; i < count && poolCopy.length > 0; i++) {
        selected.push(poolCopy.splice(Math.floor(Math.random() * poolCopy.length), 1)[0]);
    }

    const rarityScores = { "common": 1, "rare": 3, "epic": 8, "legendary": 20, "mythic": 50 };
    const gradeScores = { "fake": 0.5, "authentic": 10, "ancient_true": 25 };

    let activeNpcs = selected.map(npc => {
        const rarityMult = (typeof rarityMultipliers !== 'undefined' ? rarityMultipliers[item.rarity] : 1) || 1;
        const gradeMult = (typeof gradeMultipliers !== 'undefined' ? gradeMultipliers[item.grade] : 1) || 1;
        const popularity = (item.basePopularity || 1) * newsMultiplier;
        
        let basePerceived = (item.realValue || 1000) * rarityMult * gradeMult * popularity;
        if (window.hasCollectorAura && mode === 'sell') basePerceived *= 1.15;

        let perceivedValue = basePerceived * npc.greed;
        
        const rarityScore = rarityScores[item.rarity] || 0;
        const gradeScore = gradeScores[item.grade] || 0;
        const desireScore = rarityScore + gradeScore + (popularity * 5);

        return { 
            ...npc, 
            maxWillingToPay: perceivedValue * npc.wealthMult, 
            desireScore: desireScore,
            isActive: true, 
            thinkTimer: Math.floor(Math.random() * 2)
        };
    });

    activeAuction = {
        mode, item, currentHighestBid: startPrice, highestBidder: mode === 'sell' ? "คุณเอง" : "เจ้าหน้าที่",
        timeLeft: 15,
        activeNpcs, 
        bidsLog: [`📢 งานประมูล ${item.name} เริ่มแล้ว!`]
    };
    renderAuctionSheet();
}

function processAuctionTick() {
    if (!activeAuction) return;
    activeAuction.timeLeft--;
    activeAuction.activeNpcs.forEach(n => { if(n.thinkTimer > 0) n.thinkTimer--; });
    
    // Simplified NPC Decision Logic (Probability based)
    let capableNpcs = activeAuction.activeNpcs.filter(n => n.isActive && activeAuction.currentHighestBid < n.maxWillingToPay && n.thinkTimer <= 0);
    
    if (capableNpcs.length > 0) {
        capableNpcs.forEach(bidder => {
            if (activeAuction.highestBidder === bidder.name) return;

            // Simple probability logic: base 15% + bonus from desire and low time
            let bidChance = 0.15;
            bidChance += (bidder.desireScore / 200);
            if (activeAuction.timeLeft < 5) bidChance += 0.2; 

            if (Math.random() < bidChance) {
                let raise = Math.round(activeAuction.currentHighestBid * (0.05 + Math.random()*0.15)) + 100;
                let nextBid = activeAuction.currentHighestBid + raise;
                
                if (nextBid <= bidder.maxWillingToPay) {
                    activeAuction.currentHighestBid = nextBid; 
                    activeAuction.highestBidder = bidder.name; 
                    activeAuction.bidsLog.push(`💬 ${bidder.name} เสนอ $${formatNumber(nextBid)}`);
                    activeAuction.timeLeft = Math.min(activeAuction.timeLeft + 3, 20); 
                    bidder.thinkTimer = Math.floor(Math.random() * 3) + 2;
                } else { 
                    bidder.isActive = false; 
                    activeAuction.bidsLog.push(`🏳️ ${bidder.name} ถอนตัว`); 
                }
            }
        });
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
            if (typeof addStimeAndXP === 'function') {
                addStimeAndXP(activeAuction.currentHighestBid);
            } else {
                score += activeAuction.currentHighestBid;
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
