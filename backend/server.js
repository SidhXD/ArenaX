const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'esportsDB';

app.use(cors());
app.use(express.json());

let db;

async function startServer() {
    try {
        const client = await MongoClient.connect(MONGO_URI);
        db = client.db(DB_NAME);
        console.log(`✅ ARENA X SERVER ONLINE: ${DB_NAME}`);
        app.listen(PORT, () => console.log(`🚀 SYSTEM READY ON PORT ${PORT}`));
    } catch (err) { console.error('❌ SYSTEM FAILURE:', err); }
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

// PLAYERS (Updated with ROLE and Game Dropdown support)
app.post('/api/players', async (req, res) => {
    try {
        const player = {
            gamertag: req.body.gamertag,
            teamId: req.body.teamId ? new ObjectId(req.body.teamId) : null,
            gameName: req.body.gameName, // Now comes from dropdown
            role: req.body.role,         // NEW: Sniper, IGL, etc.
            kills: parseInt(req.body.kills) || 0,
            assists: parseInt(req.body.assists) || 0
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

// REFEREES (Updated with GAME selection)
app.post('/api/referees', async (req, res) => {
    try {
        const ref = {
            refereeName: req.body.refereeName,
            gameName: req.body.gameName, // NEW: Specific game specialization
            experience: parseInt(req.body.experience),
            matchesManaged: parseInt(req.body.matchesManaged) || 0
        };
        await db.collection('referees').insertOne(ref);
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/referees', async (req, res) => res.json(await db.collection('referees').find().toArray()));

// MATCHES (Updated with GAME selection)
app.post('/api/matches', async (req, res) => {
    try {
        const match = {
            gameName: req.body.gameName, // Now comes from dropdown
            round: req.body.round,
            teamAId: new ObjectId(req.body.teamAId),
            teamBId: new ObjectId(req.body.teamBId),
            scoreA: parseInt(req.body.scoreA),
            scoreB: parseInt(req.body.scoreB),
            winnerId: req.body.winnerId ? new ObjectId(req.body.winnerId) : null,
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
            category: req.body.category,
            matchId: req.body.matchId ? new ObjectId(req.body.matchId) : null,
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

// --- QUERIES ---
// --- OPTIMIZED QUERIES (Clean Data, No IDs) ---

// 1. Highest Kills (Now shows Team Name instead of ID)
app.get('/api/queries/highestKills', async (req, res) => {
    res.json(await db.collection('players').aggregate([
        { $sort: { kills: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'teams', localField: 'teamId', foreignField: '_id', as: 't' } },
        { $unwind: { path: '$t', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, Rank: { $literal: 'ELITE' }, Player: '$gamertag', Team: { $ifNull: ['$t.teamName', 'Free Agent'] }, Kills: '$kills', Role: '$role' } }
    ]).toArray());
});

// 2. Semifinals (Cleaned up)
app.get('/api/queries/semifinals', async (req, res) => {
    res.json(await db.collection('matches').aggregate([
        { $match: { round: 'Semifinal' } },
        { $lookup: { from: 'teams', localField: 'teamAId', foreignField: '_id', as: 'tA' } },
        { $lookup: { from: 'teams', localField: 'teamBId', foreignField: '_id', as: 'tB' } },
        { $project: { _id: 0, Game: '$gameName', Round: '$round', Matchup: { $concat: [{ $arrayElemAt: ['$tA.teamName', 0] }, " vs ", { $arrayElemAt: ['$tB.teamName', 0] }] } } }
    ]).toArray());
});

// 3. Active Referees (Clean format)
app.get('/api/queries/activeReferees', async (req, res) => {
    res.json(await db.collection('referees').aggregate([
        { $match: { matchesManaged: { $gt: 10 } } },
        { $project: { _id: 0, Official: '$refereeName', Specialty: '$gameName', Matches: '$matchesManaged', Exp: { $concat: [{ $toString: '$experience' }, " Years"] } } }
    ]).toArray());
});

// 4. Multi-Game Players (Formatted list)
app.get('/api/queries/multiGamePlayers', async (req, res) => {
    res.json(await db.collection('players').aggregate([
        { $group: { _id: "$gamertag", games: { $addToSet: "$gameName" }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $project: { _id: 0, Player: '$_id', Games_Played: '$games' } }
    ]).toArray());
});

// 5. Match MVPs (Clean names)
app.get('/api/queries/matchMVPs', async (req, res) => {
    res.json(await db.collection('awards').aggregate([
        { $match: { category: 'MVP' } },
        { $lookup: { from: 'players', localField: 'playerId', foreignField: '_id', as: 'p' } },
        { $unwind: '$p' },
        { $project: { _id: 0, Title: '$title', Winner: '$p.gamertag', Role: '$p.role', Game: '$p.gameName' } }
    ]).toArray());
});

// 6. Top 3 Teams (No IDs)
app.get('/api/queries/top3Teams', async (req, res) => {
    res.json(await db.collection('teams').aggregate([
        { $sort: { totalScore: -1 } },
        { $limit: 3 },
        { $project: { _id: 0, Rank: { $literal: 'TOP 3' }, Team: '$teamName', Region: '$region', Wins: '$wins', Score: '$totalScore' } }
    ]).toArray());
});

// 7. Zero Win Teams (No IDs)
app.get('/api/queries/zeroWinTeams', async (req, res) => {
    res.json(await db.collection('teams').aggregate([
        { $match: { wins: 0 } },
        { $project: { _id: 0, Status: { $literal: 'ELIMINATED' }, Team: '$teamName', Game: '$gameName', Region: '$region' } }
    ]).toArray());
});

// 8. Draw Matches (Clean format)
app.get('/api/queries/drawMatches', async (req, res) => {
    res.json(await db.collection('matches').aggregate([
        { $match: { winnerId: null } },
        { $lookup: { from: 'teams', localField: 'teamAId', foreignField: '_id', as: 'tA' } },
        { $lookup: { from: 'teams', localField: 'teamBId', foreignField: '_id', as: 'tB' } },
        { $project: { _id: 0, Game: '$gameName', Round: '$round', Result: { $concat: ["DRAW (", { $toString: '$scoreA' }, "-", { $toString: '$scoreB' }, ")"] }, Teams: { $concat: [{ $arrayElemAt: ['$tA.teamName', 0] }, " vs ", { $arrayElemAt: ['$tB.teamName', 0] }] } } }
    ]).toArray());
});

// 9. Avg Team Score
app.get('/api/queries/avgTeamScore', async (req, res) => {
    res.json(await db.collection('matches').aggregate([
        { $group: { _id: "$teamAId", avgScore: { $avg: "$scoreA" } } },
        { $lookup: { from: 'teams', localField: '_id', foreignField: '_id', as: 't' } },
        { $unwind: '$t' },
        { $project: { _id: 0, Team: '$t.teamName', Avg_Score: { $round: ["$avgScore", 1] } } }
    ]).toArray());
});

// 10. Dual Winners
app.get('/api/queries/dualWinners', async (req, res) => {
    res.json(await db.collection('awards').aggregate([
        { $group: { _id: "$playerId", categories: { $addToSet: "$category" } } },
        { $match: { categories: { $all: ["MVP", "Top Scorer"] } } },
        { $lookup: { from: 'players', localField: '_id', foreignField: '_id', as: 'p' } },
        { $unwind: '$p' },
        { $project: { _id: 0, Legend_Status: { $literal: 'DUAL WINNER' }, Player: '$p.gamertag', Game: '$p.gameName', Achievements: '$categories' } }
    ]).toArray());
});