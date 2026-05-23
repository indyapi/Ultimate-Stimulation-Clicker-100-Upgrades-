import { activeAuction, hasMediaHypePass, triggerMediaHype } from './auctionAI.js';

function renderAuctionSubsystem(panel) {
    // ... เช็คเงื่อนไขบัตรผ่านปกติ ...

    if (!activeAuction) {
        // ... โหมดเลือกของจากคลังมาตั้งประมูล ...
    } else {
        let logsHtml = activeAuction.bidsLog.map(l => `<div style="font-size:0.8rem; margin-bottom:2px;">${l}</div>`).join('');
        let actionButtonHtml = "";

        if (activeAuction.mode === 'sell') {
            actionButtonHtml = `<button class="trade-btn" style="background:#ff3b30;" onclick="concludeAuction()">🔨 เคาะค้อนปิดดีลทันที</button>`;
            
            // หากผู้เล่นครอบครองบัตรจ้างสื่อ และงานประมูลนี้ยังไม่ได้อยู่ในโหมดปั่นกระแส ให้แสดงปุ่มนี้ขึ้นมา
            if (hasMediaHypePass && !activeAuction.isHypeMode) {
                let hypeCost = Math.round(activeAuction.item.marketPrice * 0.40);
                actionButtonHtml += `
                    <button class="trade-btn" style="background:#a100ff; color:#fff; margin-top:5px; width:100%;" onclick="callMediaHypeApi()">
                        📢 จ้างสื่อออกข่าวสร้างกระแส (จ่าย $${formatNumber(hypeCost)})
                    </button>
                `;
            }
        } else {
            // ... ปุ่มโหมดคนเข้าซื้อสู้ราคา ...
        }

        // ... พ่นโค้ดสร้างกล่องสเตตัส Badge และ Log บันทึกประมูลลงหน้าจอ ...
    }
}

// ฟังก์ชันเชื่อมโยง Event Listener จากฝั่งปุ่มกดไปหาไฟล์ AI
window.callMediaHypeApi = function() {
    // ส่ง State เงินและฟังก์ชันอัปเดตหน้าจอหลักข้ามไฟล์ไปให้โมดูล AI ประมวลผล
    triggerMediaHype(gameState); 
    renderMainPanel();
    updateUI();
};