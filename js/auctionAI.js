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
                let impact = n.impact.multiplier;
                if (window.hasCarterJournal) {
                    if (impact > 1) impact = 1 + (impact - 1) * 1.3;
                    else impact = 1 - (1 - impact) * 1.3;
                }
                newsMultiplier *= impact;
            }
        }
    });

    let availableNpcs = npcProfiles.filter(npc => !npc.minLevel || playerLevel >= npc.minLevel);
    if (availableNpcs.length === 0) availableNpcs = [npcProfiles[2]];

    const rarityScores = { "common": 1, "rare": 3, "epic": 8, "legendary": 20, "mythic": 50 };
    const gradeScores = { "fake": 0.5, "authentic": 10, "ancient_true": 25 };

    let activeNpcs = availableNpcs.map(npc => {
        // Ticket 6: Personal Appraiser accuracy (0.7 to 1.3 margin based on NPC trust)
        let errorMargin = (1 - npc.trustAppraiser) * (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.3); 
        
        const rarityMult = (typeof rarityMultipliers !== 'undefined' ? rarityMultipliers[item.rarity] : 1) || 1;
        const gradeMult = (typeof gradeMultipliers !== 'undefined' ? gradeMultipliers[item.grade] : 1) || 1;
        const popularity = (item.basePopularity || 1) * newsMultiplier;
        
        let basePerceived = (item.realValue || 1000) * rarityMult * gradeMult * popularity;
        
        // Collector's Aura
        if (window.hasCollectorAura && mode === 'sell') basePerceived *= 1.12;

        let perceivedValue = basePerceived * (1 + errorMargin) * npc.greed;
        
        // Ticket 6: Desire Score = (Rarity + Grade + Popularity + Interest)
        const rarityScore = rarityScores[item.rarity] || 0;
        const gradeScore = gradeScores[item.grade] || 0;
        const personalInterest = (Math.random() * 10); // Random interest per auction
        const desireScore = rarityScore + gradeScore + (popularity * 5) + personalInterest;

        return { 
            ...npc, 
            maxWillingToPay: perceivedValue * npc.wealthMult, 
            desireScore: desireScore,
            isActive: true, 
            thinkTimer: 0 
        };
    });

    activeAuction = {
        mode, item, currentHighestBid: startPrice, highestBidder: mode === 'sell' ? "คุณเอง" : "NPC",
        timeLeft: 10, // Ticket 6: Starting time 10s
        activeNpcs, overbidCount: 0,
        maxOverbids: Math.floor(Math.random() * 5) + 2, 
        lastBidType: 'normal',
        bidsLog: ["📢 เริ่มงานประมูล"]
    };
    renderAuctionSheet();
}

function processAuctionTick() {
    if (!activeAuction) return;
    activeAuction.timeLeft--;
    activeAuction.activeNpcs.forEach(n => { if(n.thinkTimer > 0) n.thinkTimer--; });
    
    // NPC Decision Logic
    let capableNpcs = activeAuction.activeNpcs.filter(n => n.isActive && activeAuction.currentHighestBid < n.maxWillingToPay && n.thinkTimer <= 0);
    
    if (capableNpcs.length > 0) {
        // Likelihood of bidding increases with Desire Score
        let bidder = capableNpcs[Math.floor(Math.random() * capableNpcs.length)];
        if (activeAuction.highestBidder !== bidder.name) {
            
            let bidChance = 0.2 + (bidder.desireScore / 100);
            if (activeAuction.timeLeft < 5) bidChance += 0.3; // Panic bidding

            if (Math.random() < bidChance) {
                let isOverbid = false, multiplier = 1;
                
                // Desire Score influences overbid chance
                if (bidder.desireScore > 30 && Math.random() < (bidder.desireScore / 150)) {
                    isOverbid = true;
                    multiplier = 1.2 + (Math.random() * (bidder.desireScore / 25));
                }

                if (isOverbid) {
                    let nextBid = Math.round(activeAuction.currentHighestBid * multiplier);
                    if (nextBid <= bidder.maxWillingToPay) {
                        activeAuction.currentHighestBid = nextBid; activeAuction.highestBidder = bidder.name; activeAuction.overbidCount++; activeAuction.lastBidType = 'overbid';
                        activeAuction.bidsLog.push(`🔥 [เกทับ!] ${bidder.name} อัดไปที่ $${formatNumber(nextBid)}!`);
                        activeAuction.activeNpcs.forEach(n => { if(n.name !== bidder.name) n.thinkTimer = Math.floor(Math.random() * 2) + 2; });
                        activeAuction.timeLeft = Math.min(activeAuction.timeLeft + 5, 25); // Extension for overbid
                    } else isOverbid = false;
                }
                
                if (!isOverbid) {
                    let raise = Math.round(activeAuction.currentHighestBid * (0.05 + Math.random()*0.1)) + 500;
                    let nextBid = activeAuction.currentHighestBid + raise;
                    if (nextBid <= bidder.maxWillingToPay) {
                        activeAuction.currentHighestBid = nextBid; activeAuction.highestBidder = bidder.name; activeAuction.lastBidType = 'normal';
                        activeAuction.bidsLog.push(`💬 ${bidder.name} สู้ $${formatNumber(nextBid)}`);
                        activeAuction.timeLeft = Math.min(activeAuction.timeLeft + 3, 25); // Ticket 6: +3s extension
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
