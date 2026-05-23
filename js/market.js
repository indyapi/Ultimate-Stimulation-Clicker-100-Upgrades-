// ส่งออกตัวแปรและฟังก์ชันเพื่อให้ไฟล์อื่นเรียกใช้
export const marketData = {
    anthropic: { name: "Anthropic (Stock)", price: 120, owned: 0, invested: 0, history: [], unlocked: false, label: "Anthropic" },
    bitcoin: { name: "Bitcoin (Crypto)", price: 65000, owned: 0, invested: 0, history: [], unlocked: false, label: "Bitcoin 🪙" }
};

export function generateProceduralAntique() {
    // ... โค้ดสร้างวัตถุโบราณสุ่มแบบเดิม ...
    return { name: "ถ้วยชาเคลือบราชวงศ์ซ่ง", marketPrice: 5000, isReal: true };
}