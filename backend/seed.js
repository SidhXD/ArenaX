const { MongoClient, ObjectId } = require('mongodb');

// Connection Config
const uri = 'mongodb+srv://admin:test123@cluster0.u3wdx27.mongodb.net/?appName=Cluster0';
const dbName = 'esportsDB';

async function seedDatabase() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('🔌 Connected to Database...');
        const db = client.db(dbName);

        // ====================================================
        // 1. DROP COLLECTIONS (Removes Data AND Old Indexes)
        // ====================================================
        try { await db.collection('teams').drop(); } catch (e) {}
        try { await db.collection('players').drop(); } catch (e) {}
        try { await db.collection('referees').drop(); } catch (e) {}
        try { await db.collection('matches').drop(); } catch (e) {}
        try { await db.collection('awards').drop(); } catch (e) {}
        console.log('🧹 Old data and indexes cleared.');

        // ====================================================
        // 2. INSERT NEW DATA
        // ====================================================

        // --- TEAMS ---
        const teams = await db.collection('teams').insertMany([
            { teamName: "Sentinels", gameName: "Valorant", region: "NA", wins: 5, totalScore: 15 },
            { teamName: "Fnatic", gameName: "Valorant", region: "EU", wins: 3, totalScore: 9 },
            { teamName: "Paper Rex", gameName: "Valorant", region: "ASIA", wins: 0, totalScore: 1 },
            { teamName: "Team Liquid", gameName: "PUBG", region: "EU", wins: 2, totalScore: 6 }
        ]);
        const t = teams.insertedIds; 
        console.log('✅ Teams inserted');

        // --- PLAYERS ---
        const players = await db.collection('players').insertMany([
            // Team Sentinels (Index 0)
            { gamertag: "TenZ", teamId: t[0], gameName: "Valorant", totalKills: 150 },
            { gamertag: "Zekken", teamId: t[0], gameName: "Valorant", totalKills: 120 },
            
            // Team Fnatic (Index 1)
            { gamertag: "Boaster", teamId: t[1], gameName: "Valorant", totalKills: 80 },
            
            // Multi-Game Player (Same Gamertag, Different Games)
            { gamertag: "Shroud", teamId: null, gameName: "PUBG", totalKills: 200 },
            { gamertag: "Shroud", teamId: t[0], gameName: "Valorant", totalKills: 45 }
        ]);
        const p = players.insertedIds;
        console.log('✅ Players inserted');

        // --- REFEREES ---
        const referees = await db.collection('referees').insertMany([
            { name: "Ref John", experience: 5, matchesManaged: 15 },
            { name: "Ref Doe", experience: 2, matchesManaged: 3 }
        ]);
        const r = referees.insertedIds;
        console.log('✅ Referees inserted');

        // --- MATCHES ---
        const matches = await db.collection('matches').insertMany([
            {
                gameName: "Valorant",
                round: "Semifinal",
                teamAId: t[0],
                teamBId: t[1],
                scoreA: 13,
                scoreB: 11,
                winnerId: t[0],
                refereeId: r[0]
            },
            {
                gameName: "Valorant",
                round: "Group Stage",
                teamAId: t[1],
                teamBId: t[2],
                scoreA: 10,
                scoreB: 10,
                winnerId: null, // Draw
                refereeId: r[0]
            }
        ]);
        const m = matches.insertedIds;
        console.log('✅ Matches inserted');

        // --- AWARDS ---
        await db.collection('awards').insertMany([
            { title: "Match MVP", category: "MVP", matchId: m[0], playerId: p[1] },
            { title: "Golden Gun", category: "Top Scorer", matchId: m[0], playerId: p[1] },
            { title: "Fair Play", category: "Fair Play", matchId: m[1], playerId: p[2] }
        ]);
        console.log('✅ Awards inserted');

        console.log('------------------------------------------------');
        console.log('🎉 DATABASE FIXED AND SEEDED!');
        console.log('------------------------------------------------');

    } catch (err) {
        console.error('❌ Error seeding:', err);
    } finally {
        await client.close();
    }
}

seedDatabase();