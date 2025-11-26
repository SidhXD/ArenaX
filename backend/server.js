const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();

// 1. USE RENDER'S PORT (Critical Fix)
const PORT = process.env.PORT || 3000;

// 2. USE RENDER'S DATABASE URL (Critical Fix)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'esportsDB';

app.use(cors());
app.use(express.json());

let db;

async function startServer() {
    try {
        console.log('🟡 Connecting to MongoDB...');
        console.log(`   (URI Length: ${MONGO_URI.length})`); // Debug: check if env var exists

        const client = await MongoClient.connect(MONGO_URI);
        db = client.db(DB_NAME);
        
        console.log(`✅ ARENA X SERVER ONLINE: ${DB_NAME}`);
        
        // 3. START SERVER ONLY AFTER DB CONNECTS
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 SYSTEM READY ON PORT ${PORT}`);
        });

    } catch (err) {
        console.error('❌ CRITICAL SYSTEM FAILURE:', err);
        // Keep the process alive so you can read the logs in Render
        process.exit(1); 
    }
}

startServer();
// --- CRUD ROUTES ---

// TEAMS
app.post('/api/teams', async (req, res) => {
    try {
        const team = {
            teamName: req.body.teamName,
            gameName: req.body.gameName,
            region: req.body.region,
            wins: 0,
            totalScore: 0
        };
        const result = await db.collection('teams').insertOne(team);
        res.json({ id: result.insertedId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/teams', async (req, res) => res.json(await db.collection('teams').find().toArray()));
app.delete('/api/teams/:id', async (req, res) => {
    const id = new ObjectId(req.params.id);
    await db.collection('teams').deleteOne({ _id: id });
    await db.collection('players').deleteMany({ teamId: id });
    res.json({ status: 'deleted' });
});

// PLAYERS (Updated with ASSISTS)
app.post('/api/players', async (req, res) => {
    try {
        const player = {
            gamertag: req.body.gamertag,
            teamId: req.body.teamId ? new ObjectId(req.body.teamId) : null,
            gameName: req.body.gameName,
            kills: parseInt(req.body.kills) || 0,     // Attribute: kills
            assists: parseInt(req.body.assists) || 0 // Attribute: assists (NEW)
        };
        await db.collection('players').insertOne(player);
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/players', async (req, res) => res.json(await db.collection('players').find().toArray()));
app.delete('/api/players/:id', async (req, res) => {
    const id = new ObjectId(req.params.id);
    await db.collection('players').deleteOne({ _id: id });
    await db.collection('awards').deleteMany({ playerId: id });
    res.json({ status: 'deleted' });
});

// REFEREES
app.post('/api/referees', async (req, res) => {
    try {
        const ref = {
            refereeName: req.body.refereeName, // Attribute: refereeName
            experience: parseInt(req.body.experience),
            matchesManaged: parseInt(req.body.matchesManaged) || 0
        };
        await db.collection('referees').insertOne(ref);
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/referees', async (req, res) => res.json(await db.collection('referees').find().toArray()));

// MATCHES
app.post('/api/matches', async (req, res) => {
    try {
        const match = {
            gameName: req.body.gameName,
            round: req.body.round, // Attribute: round
            teamAId: new ObjectId(req.body.teamAId),
            teamBId: new ObjectId(req.body.teamBId),
            scoreA: parseInt(req.body.scoreA), // Attribute: score
            scoreB: parseInt(req.body.scoreB),
            winnerId: req.body.winnerId ? new ObjectId(req.body.winnerId) : null, // Attribute: winner
            refereeId: req.body.refereeId ? new ObjectId(req.body.refereeId) : null
        };
        await db.collection('matches').insertOne(match);
        if (match.winnerId) {
            await db.collection('teams').updateOne({ _id: match.winnerId }, { $inc: { wins: 1, totalScore: 3 } });
        }
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/matches', async (req, res) => res.json(await db.collection('matches').find().toArray()));
app.delete('/api/matches/:id', async (req, res) => {
    const id = new ObjectId(req.params.id);
    await db.collection('matches').deleteOne({ _id: id });
    await db.collection('awards').deleteMany({ matchId: id });
    res.json({ status: 'deleted' });
});

// AWARDS
app.post('/api/awards', async (req, res) => {
    try {
        const award = {
            title: req.body.title,
            category: req.body.category, // Attribute: mvp (stored as category)
            matchId: req.body.matchId ? new ObjectId(req.body.matchId) : null, // Attribute: matchId
            playerId: req.body.playerId ? new ObjectId(req.body.playerId) : null
        };
        await db.collection('awards').insertOne(award);
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/awards', async (req, res) => res.json(await db.collection('awards').find().toArray()));
app.delete('/api/awards/:id', async (req, res) => {
    await db.collection('awards').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ status: 'deleted' });
});

// ==========================================
//           10 SPECIFIC QUERIES
// ==========================================

// 1. List players with the highest total kills.
app.get('/api/queries/highestKills', async (req, res) => {
    // Sorts by kills descending, takes top 5
    const data = await db.collection('players').find().sort({ kills: -1 }).limit(5).toArray();
    res.json(data);
});

// 2. Find teams that reached the semifinals.
app.get('/api/queries/semifinals', async (req, res) => {
    // Filters matches where round is 'Semifinal', joins with Team data to get names
    const data = await db.collection('matches').aggregate([
        { $match: { round: 'Semifinal' } },
        { $lookup: { from: 'teams', localField: 'teamAId', foreignField: '_id', as: 'TeamA' } },
        { $lookup: { from: 'teams', localField: 'teamBId', foreignField: '_id', as: 'TeamB' } },
        { $project: { 
            Round: '$round', 
            TeamA: { $arrayElemAt: ['$TeamA.teamName', 0] }, 
            TeamB: { $arrayElemAt: ['$TeamB.teamName', 0] } 
        }}
    ]).toArray();
    res.json(data);
});

// 3. Show referees who managed more than 10 matches.
app.get('/api/queries/activeReferees', async (req, res) => {
    const data = await db.collection('referees').find({ matchesManaged: { $gt: 10 } }).toArray();
    res.json(data);
});

// 4. Retrieve players who participated in multiple games.
app.get('/api/queries/multiGamePlayers', async (req, res) => {
    // Groups by gamertag, counts unique gameNames
    const data = await db.collection('players').aggregate([
        { $group: { _id: "$gamertag", games: { $addToSet: "$gameName" }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
    ]).toArray();
    res.json(data);
});

// 5. Identify MVPs for each match.
app.get('/api/queries/matchMVPs', async (req, res) => {
    const data = await db.collection('awards').aggregate([
        { $match: { category: 'MVP' } },
        { $lookup: { from: 'players', localField: 'playerId', foreignField: '_id', as: 'p' } },
        { $unwind: '$p' },
        { $project: { Title: '$title', Player: '$p.gamertag', MatchID: '$matchId' } }
    ]).toArray();
    res.json(data);
});

// 6. Calculate average team score per game.
app.get('/api/queries/avgTeamScore', async (req, res) => {
    // Calculates average of scoreA for teamA
    const data = await db.collection('matches').aggregate([
        { $group: { _id: "$teamAId", avgScore: { $avg: "$scoreA" } } },
        { $lookup: { from: 'teams', localField: '_id', foreignField: '_id', as: 't' } },
        { $unwind: '$t' },
        { $project: { Team: '$t.teamName', AvgScore: { $round: ["$avgScore", 1] } } }
    ]).toArray();
    res.json(data);
});

// 7. Find players who won both MVP and Top Scorer.
app.get('/api/queries/dualWinners', async (req, res) => {
    const data = await db.collection('awards').aggregate([
        { $group: { _id: "$playerId", categories: { $addToSet: "$category" } } },
        { $match: { categories: { $all: ["MVP", "Top Scorer"] } } },
        { $lookup: { from: 'players', localField: '_id', foreignField: '_id', as: 'p' } },
        { $unwind: '$p' },
        { $project: { Gamertag: '$p.gamertag', Awards: '$categories' } }
    ]).toArray();
    res.json(data);
});

// 8. Show matches that ended in a draw.
app.get('/api/queries/drawMatches', async (req, res) => {
    // Logic: WinnerID is null
    const data = await db.collection('matches').find({ winnerId: null }).toArray();
    res.json(data);
});

// 9. Retrieve teams with zero wins.
app.get('/api/queries/zeroWinTeams', async (req, res) => {
    const data = await db.collection('teams').find({ wins: 0 }).toArray();
    res.json(data);
});

// 10. List top 3 teams by total score.
app.get('/api/queries/top3Teams', async (req, res) => {
    const data = await db.collection('teams').find().sort({ totalScore: -1 }).limit(3).toArray();
    res.json(data);
});