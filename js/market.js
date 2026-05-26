// --- GLOBAL DATA & STATE ---
var score = 0, cpc = 1, cps = 0;
var currentSheet = null, currentStockTab = null, shopTab = 'upgrade';
var isDraggingSheet = false, sheetStartY, sheetStartHeight;
var isDraggingDivider = false;

var hasAntiqueTicket = false, hasMediaHypePass = false, hasNewsSubscription = false, archeologistLevel = 0, appraiserLevel = 0;
var playerLevel = 0, playerXP = 0, playerTitle = "มือใหม่";
var playerInventory = [], currentMarketItem = null;
var newsData = [], activeNews = [];
var items = [];
var npcProfiles = [];

var ancientArtifacts = [];
var artifactsLoaded = false;
var marketData = {};

const rarityMultipliers = {
    "common": 1,
    "rare": 5,
    "epic": 20,
    "legendary": 100,
    "mythic": 500
};

const gradeMultipliers = {
    "fake": 0.1,
    "authentic": 1,
    "ancient_true": 2.5
};

// --- MARKET DATA LOADING ---
async function loadAncientArtifacts() {
    try {
        console.log("Fetching artifacts...");
        const response = await fetch('data/ancientArtifacts.json');
        ancientArtifacts = await response.json();
        artifactsLoaded = true;
        console.log("Loaded " + ancientArtifacts.length + " artifacts.");
    } catch (e) {
        console.error("Failed to load artifacts:", e);
    }
}

async function loadStocks() {
    try {
        console.log("Fetching stocks...");
        const response = await fetch('data/stocks.json');
        marketData = await response.json();
        console.log("Loaded stocks data.");
    } catch (e) {
        console.error("Failed to load stocks:", e);
    }
}

// --- ANTIQUE GENERATION ---
function generateProceduralAntique() {
    if (!artifactsLoaded || ancientArtifacts.length === 0) {
        return null;
    }

    const filteredArtifacts = ancientArtifacts.filter(a => {
        return (a.minPlayerLevel || 0) <= playerLevel + 20;
    });

    if (filteredArtifacts.length === 0) {
        return generateLowLevelAntique();
    }

    const artifact = filteredArtifacts[Math.floor(Math.random() * filteredArtifacts.length)];
    
    let newsPopularityMultiplier = 1;
    if (activeNews && activeNews.length > 0) {
        activeNews.forEach(n => {
            if (n.impact.type === 'artifact') {
                if (n.impact.target === 'All' || artifact.name.toLowerCase().includes(n.impact.target.toLowerCase())) {
                    newsPopularityMultiplier *= n.impact.multiplier;
                }
            }
        });
    }

    const rarityMult = rarityMultipliers[artifact.rarity] || 1;
    const gradeMult = gradeMultipliers[artifact.grade] || 1;
    const levelScale = 1 + (playerLevel * 0.085);
    const popularity = (artifact.basePopularity || 1) * newsPopularityMultiplier;
    
    // finalPrice = baseValue * rarityMultiplier * gradeMultiplier * (1 + playerLevel * 0.085) * newsPopularityMultiplier
    const marketPrice = Math.round(
        artifact.realValue * 
        rarityMult * 
        gradeMult * 
        levelScale * 
        popularity * 
        (0.9 + Math.random() * 0.2) // Small random variance
    );
    
    return { 
        ...artifact, 
        marketPrice: marketPrice
    };
}

function generateLowLevelAntique() {
    // Find the cheapest artifacts
    const sorted = [...ancientArtifacts].sort((a,b) => a.realValue - b.realValue);
    const artifact = sorted[Math.floor(Math.random() * 20)]; // Pick from top 20 cheapest
    return { ...artifact, marketPrice: Math.round(artifact.realValue * (0.8 + Math.random() * 0.4)) };
}

