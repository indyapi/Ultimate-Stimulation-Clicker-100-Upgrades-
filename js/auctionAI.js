import { generateProceduralAntique } from './market.js';

export let activeAuction = null;
// ตัวแปรเช็คว่าผู้เล่นปลดล็อกระบบจ้างสื่อหรือยัง
export let hasMediaHypePass = false; 

export function setMediaHypePass(status) {
    hasMediaHypePass = status;
}

export function setActiveAuction(auctionObj) {
    activeAuction = auctionObj;
}

export function processAuctionTick(gameState, updateUIAndPanel) {
    if (!activeAuction) return;
    activeAuction.timeLeft--;

    const npcNames = ["คุณหญิงพิมพิลา", "เสี่ยอ้วนเพชรบุรี", "หมอสะสมของเก่า", "นักธุรกิจฮ่องกง", "CEO ท่านหนึ่ง"];
    let bidder = npcNames[Math.floor(Math.random() * npcNames.length)];

    // --- 1. โหมดภาวะตลาดปกติ ---
    if (!activeAuction.isHypeMode) {
        if (!activeAuction.hasTriggeredFirstBid && activeAuction.highestBidder.includes("ราคาเปิด")) {
            activeAuction.hasTriggeredFirstBid = true;
            if (Math.random() < 0.70) {
                activeAuction.highestBidder = bidder;
                activeAuction.bidsLog.push(`🤖 ${bidder} เคาะราคาเท่าราคาเริ่มต้นประมูลที่ $${gameState.formatNumber(activeAuction.currentHighestBid)}`);
            } else {
                let raise = Math.round(activeAuction.currentHighestBid * 0.05) + 100;
                activeAuction.currentHighestBid += raise;
                activeAuction.highestBidder = bidder;
                activeAuction.bidsLog.push(`💬 ${bidder} เปิดฉากประมูลบวกเพิ่มเป็น $${gameState.formatNumber(activeAuction.currentHighestBid)}`);
            }
        } else if (Math.random() < 0.4 && activeAuction.highestBidder !== bidder) {
            let ceiling = activeAuction.item.realEstimateValue * (1.1 + Math.random() * 0.3);
            if (activeAuction.currentHighestBid < ceiling) {
                let raise = Math.round(activeAuction.currentHighestBid * 0.06) + 150;
                activeAuction.currentHighestBid += raise;
                activeAuction.highestBidder = bidder;
                activeAuction.bidsLog.push(`💬 ${bidder} ยกป้ายสู้ต่อเป็น $${gameState.formatNumber(activeAuction.currentHighestBid)}`);
                activeAuction.timeLeft = Math.min(activeAuction.timeLeft + 2, 20);
            }
        }
    } 
    // --- 2. โหมดกระแสตลาดดุเดือด (Hyper Hype Mode) ---
    else {
        // เงื่อนไขแกนหลัก: ปรับลดการสแปมลง 20% หากผู้เล่นเป็นคนกดใช้สื่อปั่นกระแสเอง
        let spamChance = activeAuction.isPlayerHyped ? 0.55 : 0.75; 

        if (Math.random() < spamChance && activeAuction.highestBidder !== bidder) {
            activeAuction.hasTriggeredFirstBid = true;
            
            // สุ่มเกทับโหด 2 - 10 เท่าของราคาปัจจุบัน
            let multiplier = Math.floor(Math.random() * 9) + 2; 
            activeAuction.currentHighestBid *= multiplier;
            activeAuction.highestBidder = bidder;
            activeAuction.bidsLog.push(`🔥 [X${multiplier} เท่า!] ${bidder} บ้าเลือดเกทับราคาไปที่ $${gameState.formatNumber(activeAuction.currentHighestBid)} !!!`);
            
            activeAuction.timeLeft = Math.min(activeAuction.timeLeft + 3, 20);
        }
    }

    if (activeAuction.timeLeft <= 0) {
        concludeAuction(gameState, updateUIAndPanel);
    } else {
        updateUIAndPanel();
    }
}

// ฟังก์ชันเปิดใช้งานสื่อปั่นกระแส (หักเงินผู้เล่นและเปิดโหมดคลั่งแบบสแปมน้อยลง)
export function triggerMediaHype(gameState) {
    if (!activeAuction || activeAuction.mode !== 'sell') {
        alert("⚠️ คุณสามารถใช้สื่อปั่นกระแสได้เฉพาะตอนที่คุณเป็นคนตั้งขายวัตถุโบราณของตัวเองเท่านั้น!");
        return;
    }
    
    // คำนวณค่าจ้างสื่อแปรผันตามราคาตลาดชิ้นนั้น (หรือจะตั้งราคาฟิกซ์ไว้ก็ได้ครับ)
    let hypeCost = Math.round(activeAuction.item.marketPrice * 0.40);
    
    if (gameState.score >= hypeCost) {
        gameState.score -= hypeCost;
        activeAuction.isHypeMode = true;
        activeAuction.isPlayerHyped = true; // บันทึกสัญกรณ์ว่าผู้เล่นเปย์จ้างสื่อเอง (สแปมลดลง 20%)
        activeAuction.timeLeft = Math.min(activeAuction.timeLeft + 5, 20); // เพิ่มเวลาให้ตลาดรับรู้ข่าวสาร
        activeAuction.bidsLog.push(`📢 [ข่าวเด่นข่าวด่วน] สื่อหลักลงข่าวทำสกู๊ปพิเศษให้กับ "${activeAuction.item.name}" นักลงทุนกระเป๋าหนักตาลุกวาว!!`);
    } else {
        alert(`เงินไม่พอจ้างสื่อ! ต้องใช้เงินค่าทำข่าวจำนวน $${gameState.formatNumber(hypeCost)}`);
    }
}

function concludeAuction(gameState, updateUIAndPanel) {
    // ... ตรรกะประมวลผลสรุปหลังจบเคาะค้อนแบบเดิม ...
    // ... จ่ายเงินให้ผู้เล่น หรือคืนของเข้าคลัง ...
    setActiveAuction(null);
    updateUIAndPanel();
}