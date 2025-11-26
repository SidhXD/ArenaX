const { MongoClient } = require('mongodb');

// 1. CONNECTION CONFIG
const uri = 'mongodb://localhost:27017';
const dbName = 'esportsDB'; // Must match server.js

async function seed() {
    const client = new MongoClient(uri);

    try {
        // 2. CONNECT
        console.log('🟡 Attempting to connect to MongoDB...');
        await client.connect();
        console.log('🟢 Connected successfully!');
        
        const db = client.db(dbName);

        // 3. CLEANUP (Drop existing collections)
        console.log('🟡 Dropping old collections...');
        const collections = await db.listCollections().toArray();
        for (const col of collections) {
            await db.collection(col.name).drop();
            console.log(`   - Dropped: ${col.name}`);
        }

        // 4. INSERT TEAMS
        console.log('🟡 Inserting Teams...');
        const teamsData = [
            { teamName: "Sentinels", gameName: "Valorant", region: "NA", wins: 12, totalScore: 36 },
            { teamName: "Fnatic", gameName: "Valorant", region: "EU", wins: 10, totalScore: 30 },
            { teamName: "Paper Rex", gameName: "Valorant", region: "ASIA", wins: 8, totalScore: 24 },
            { teamName: "LOUD", gameName: "Valorant", region: "BR", wins: 6, totalScore: 18 },
            { teamName: "DRX", gameName: "Valorant", region: "KR", wins: 0, totalScore: 2 },
            { teamName: "T1", gameName: "League of Legends", region: "KR", wins: 20, totalScore: 60 },
            { teamName: "G2 Esports", gameName: "League of Legends", region: "EU", wins: 15, totalScore: 45 },
            { teamName: "JDG", gameName: "League of Legends", region: "CN", wins: 14, totalScore: 42 },
            { teamName: "Gen.G", gameName: "League of Legends", region: "KR", wins: 12, totalScore: 36 },
            { teamName: "Cloud9", gameName: "League of Legends", region: "NA", wins: 5, totalScore: 15 },
            { teamName: "Natus Vincere", gameName: "CS:GO", region: "CIS", wins: 18, totalScore: 54 },
            { teamName: "FaZe Clan", gameName: "CS:GO", region: "EU", wins: 16, totalScore: 48 },
            { teamName: "Vitality", gameName: "CS:GO", region: "EU", wins: 11, totalScore: 33 },
            { teamName: "Heroic", gameName: "CS:GO", region: "EU", wins: 9, totalScore: 27 },
            { teamName: "Liquid", gameName: "CS:GO", region: "NA", wins: 0, totalScore: 5 }
        ];
        const teamsResult = await db.collection('teams').insertMany(teamsData);
        const t = teamsResult.insertedIds;
        console.log(`🟢 Inserted ${teamsResult.insertedCount} Teams.`);

        // 5. INSERT PLAYERS
        console.log('🟡 Inserting Players...');
        const playersData = [
            { gamertag: "TenZ", teamId: t[0], gameName: "Valorant", kills: 450, assists: 120 },
            { gamertag: "Zekken", teamId: t[0], gameName: "Valorant", kills: 380, assists: 150 },
            { gamertag: "Boaster", teamId: t[1], gameName: "Valorant", kills: 150, assists: 400 },
            { gamertag: "f0rsakeN", teamId: t[2], gameName: "Valorant", kills: 400, assists: 100 },
            { gamertag: "Faker", teamId: t[5], gameName: "League of Legends", kills: 200, assists: 800 },
            { gamertag: "Caps", teamId: t[6], gameName: "League of Legends", kills: 250, assists: 500 },
            { gamertag: "Ruler", teamId: t[7], gameName: "League of Legends", kills: 300, assists: 200 },
            { gamertag: "s1mple", teamId: t[10], gameName: "CS:GO", kills: 900, assists: 150 },
            { gamertag: "ZywOo", teamId: t[12], gameName: "CS:GO", kills: 850, assists: 140 },
            { gamertag: "Shroud", teamId: t[0], gameName: "Valorant", kills: 50, assists: 10 },
            { gamertag: "Shroud", teamId: null, gameName: "PUBG", kills: 600, assists: 20 }
        ];
        const playersResult = await db.collection('players').insertMany(playersData);
        const p = playersResult.insertedIds;
        console.log(`🟢 Inserted ${playersResult.insertedCount} Players.`);

        // 6. INSERT REFEREES
        console.log('🟡 Inserting Referees...');
        const refereesData = [
            { refereeName: "Ref Anderson", experience: 10, matchesManaged: 55 },
            { refereeName: "Ref Jones", experience: 5, matchesManaged: 12 },
            { refereeName: "Ref Rookie", experience: 1, matchesManaged: 2 }
        ];
        const refResult = await db.collection('referees').insertMany(refereesData);
        const r = refResult.insertedIds;
        console.log(`🟢 Inserted ${refResult.insertedCount} Referees.`);

        // 7. INSERT MATCHES
        console.log('🟡 Inserting Matches...');
        const matchesData = [
            { gameName: "Valorant", round: "Semifinal", teamAId: t[0], teamBId: t[1], scoreA: 13, scoreB: 11, winnerId: t[0], refereeId: r[0] },
            { gameName: "Valorant", round: "Semifinal", teamAId: t[2], teamBId: t[3], scoreA: 10, scoreB: 13, winnerId: t[3], refereeId: r[0] },
            { gameName: "CS:GO", round: "Semifinal", teamAId: t[10], teamBId: t[11], scoreA: 16, scoreB: 14, winnerId: t[10], refereeId: r[1] },
            { gameName: "League of Legends", round: "Group Stage", teamAId: t[5], teamBId: t[7], scoreA: 1, scoreB: 1, winnerId: null, refereeId: r[1] }
        ];
        const matchResult = await db.collection('matches').insertMany(matchesData);
        const m = matchResult.insertedIds;
        console.log(`🟢 Inserted ${matchResult.insertedCount} Matches.`);

        // 8. INSERT AWARDS
        console.log('🟡 Inserting Awards...');
        const awardsData = [
            { title: "Match MVP", category: "MVP", matchId: m[0], playerId: p[1] },
            { title: "Server Admin", category: "Top Scorer", matchId: m[0], playerId: p[1] },
            { title: "Clutch King", category: "MVP", matchId: m[2], playerId: p[7] }
        ];
        const awardsResult = await db.collection('awards').insertMany(awardsData);
        console.log(`🟢 Inserted ${awardsResult.insertedCount} Awards.`);

        console.log('\n=========================================');
        console.log('🎉 SEEDING COMPLETE. NO ERRORS DETECTED.');
        console.log('=========================================\n');

    } catch (error) {
        console.error('\n❌ ❌ ❌ CRITICAL ERROR ❌ ❌ ❌');
        console.error('The script failed. Here is the error message:\n');
        console.error(error);
    } finally {
        await client.close();
        console.log('🟡 Connection closed.');
    }
}

seed();