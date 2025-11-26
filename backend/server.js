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
app.get('/api/queries/highestKills', async (req, res) => {
    res.json(await db.collection('players').find().sort({ kills: -1 }).limit(5).toArray());
});
app.get('/api/queries/semifinals', async (req, res) => {
    res.json(await db.collection('matches').aggregate([
        { $match: { round: 'Semifinal' } },
        { $lookup: { from: 'teams', localField: 'teamAId', foreignField: '_id', as: 'TeamA' } },
        { $unwind: '$TeamA' },
        { $project: { TeamName: '$TeamA.teamName', Round: 'Semifinal', Game: '$gameName' } }
    ]).toArray());
});
app.get('/api/queries/activeReferees', async (req, res) => {
    res.json(await db.collection('referees').find({ matchesManaged: { $gt: 10 } }).toArray());
});
app.get('/api/queries/multiGamePlayers', async (req, res) => {
    res.json(await db.collection('players').aggregate([
        { $group: { _id: "$gamertag", games: { $addToSet: "$gameName" }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
    ]).toArray());
});
app.get('/api/queries/matchMVPs', async (req, res) => {
    res.json(await db.collection('awards').aggregate([
        { $match: { category: 'MVP' } },
        { $lookup: { from: 'players', localField: 'playerId', foreignField: '_id', as: 'p' } },
        { $unwind: '$p' },
        { $project: { Award: '$title', Gamertag: '$p.gamertag', MatchId: '$matchId' } }
    ]).toArray());
});
app.get('/api/queries/top3Teams', async (req, res) => {
    res.json(await db.collection('teams').find().sort({ totalScore: -1 }).limit(3).toArray());
});
app.get('/api/queries/zeroWinTeams', async (req, res) => {
    res.json(await db.collection('teams').find({ wins: 0 }).toArray());
});
app.get('/api/queries/drawMatches', async (req, res) => {
    res.json(await db.collection('matches').find({ winnerId: null }).toArray());
});
app.get('/api/queries/avgTeamScore', async (req, res) => {
    res.json(await db.collection('matches').aggregate([
        { $group: { _id: "$teamAId", avgScore: { $avg: "$scoreA" } } },
        { $lookup: { from: 'teams', localField: '_id', foreignField: '_id', as: 't' } },
        { $unwind: '$t' },
        { $project: { Team: '$t.teamName', AvgScore: { $round: ["$avgScore", 1] } } }
    ]).toArray());
});
app.get('/api/queries/dualWinners', async (req, res) => {
    res.json(await db.collection('awards').aggregate([
        { $group: { _id: "$playerId", categories: { $addToSet: "$category" } } },
        { $match: { categories: { $all: ["MVP", "Top Scorer"] } } },
        { $lookup: { from: 'players', localField: '_id', foreignField: '_id', as: 'p' } },
        { $unwind: '$p' },
        { $project: { Gamertag: '$p.gamertag', Awards: '$categories' } }
    ]).toArray());
});