module.exports = {
	addPerle, initPerlenGame,
	handleImage, handleMovePerle, handlePlacePerle, handlePlayerLeft,
	handleRelayout, handleRemovePerle, handleReset,
	handleStartOrJoin,
}
//#region requires, const, var
const base = require('../public/BASE/base.js');
const fs = require('fs');
const path = require('path');
const utils = require('./utils.js');
const { SKIP_INITIAL_SELECT } = require('../public/BASE/globals.js');
var MessageCounter = 0;
var Verbose = true;
var G;
var PerlenDict;

//#endregion



class GP1 {
	constructor(io, perlenDict, settings) {
		this.io = io;
		this.perlenDict = perlenDict;
		this.players = {};

		this.initState(settings);
	}
	addPlayer(client, x) {
		let username = x;
		let id = client.id;
		console.log('adding player', id);
		let pl = { id: id, client: client, name: username, username: username, arr: [] };
		this.players[id] = pl;
		this.initPlayerState(pl.id);
		return pl;
	}
	addToPool(perle) {
		let p = base.jsCopy(perle);
		p.index = this.maxIndex;
		this.maxIndex += 1;
		this.byIndex[p.index] = p;
		if (base.isdef(this.State.poolArr)) this.State.poolArr.push(p.index); //addToPoolArr(poolPerle.index);

		return p;
	}
	boardLayoutChange(client, x) {
		//update board state!
		let state = this.State;
		state.boardArr = x.boardArr;
		state.poolArr = x.poolArr;
		state.rows = x.rows;
		state.cols = x.cols;
		this.io.emit('gameState',
			{
				state: {
					boardArr: x.boardArr,
					poolArr: x.poolArr,
					rows: x.rows,
					cols: x.cols,
				}, username: x.username, msg: 'user ' + x.username + ' modified board'
			});

	}
	emitPartialGameState(client){

	}
	emitGameStateIncludingPool(client) {
		let pl = this.players[client.id];
		let username = pl.name;
		console.log('username',username);
		// console.log('sollte gameState emitten!',client.id);
		// console.log('this.state.players',this.State.players);
		this.io.emit('gameState', { state: this.State, username:username });
		// this.io.emit('gameState',
		// 	{
		// 		state: {
		// 			rows: this.State.rows,
		// 			cols: this.State.cols,
		// 			boardArr: this.State.boardArr,
		// 			poolArr: this.State.poolArr,
		// 			pool: this.State.byIndex,
		// 			players: this.State.players
		// 		},

		// 		username: username
		// 	});
	}

	getNumActivePlayers() { return this.state.players.length; }
	getNumPlayers() { return Object.keys(this.players).length; }
	getPlayerNames() { return this.State.players.map(x => x.name).join(','); }
	getPlayerState(plid) { return base.firstCond(this.State.players, x => x.id == plid); }
	getPerleByFilename(filename) {
		for (const k in this.byIndex) {
			let p = this.byIndex[k];
			if (p.path == filename) return p;
		}
		return null;
	}
	getPerlenName(iPerle) { return this.byIndex[iPerle].Name; }
	//BROKENgetState(keys){return base.isdef(keys)?partialObject(this.State,keys):this.State;}
	getTurn() { return this.state.turn; }
	initPlayerState(plid) {
		console.log('initPlayerState', plid)
		let pl = this.players[plid];
		let plState = { id: pl.id, name: pl.name, username: pl.username, arr: pl.arr };
		console.log('state', plState);
		if (base.nundef(this.State.players)) this.State.players = [];
		this.State.players.push(plState);
		console.log('added player',pl.id)
		return pl;
	}
	initPlayers() { this.State.players = []; for (const plid in this.players) { this.initPlayerState(plid); } }
	initState(settings = {}) {
		let byIndex = this.byIndex = {}; this.maxIndex = 0; this.State = {};

		let [rows, cols] = [base.valf(settings.rows, 4), base.valf(settings.cols, 4)];
		let board = new Array(rows * cols);
		let keys = getRandomPerlenKeys(base.valf(settings.N, 50));
		//keys[0]='playful';
		//keys[1]='carelessness';
		keys.map(x => this.addToPool(this.perlenDict[x]));

		//console.log('byIndex',keys);
		this.State = {
			rows: rows,
			cols: cols,
			poolArr: Object.values(byIndex).map(x => x.index),
			boardArr: board,
			pool: byIndex,
		};

		this.initPlayers();
		let n = keys.length;
		console.log('==>there are ', n, 'perlen');
	}
	playerJoins(client, x) {
		let pl = this.addPlayer(client, x);
		console.log('hallo', x, 'starts or joins game!');

		if (SKIP_INITIAL_SELECT) {
			logSend('gameState');
			client.emit('gameState', { state: this.State });
		} else {
			let data = { state: State, instruction: 'pick your set of pearls!' };
			client.emit('initialPool', { state: { pool: State.pool }, instruction: 'pick your set!' });
		}
		this.io.emit('userMessage', {
			username: x,
			msg: `user ${pl.name} joined! (players:${this.getPlayerNames()})`,
		});

	}
	playerLeft(client, data) {
		let id = client.id;
		let players = this.players;
		delete players[id];
		let plState = this.getPlayerState(id);
		if (plState) base.removeInPlace(this.State.players, plState);
		console.log('player left: ', client.id, data);
	}
	playerMovesPerle(client, x) {
		let iPerle = x.iPerle;
		let iFrom = x.iFrom;
		let iTo = x.iTo;
		let username = x.username;
		let perle = this.byIndex[iPerle];

		//update board state!
		let boardArr = this.State.boardArr;
		boardArr[iFrom] = null;
		boardArr[iTo] = iPerle;

		this.State.boardArr = boardArr;

		if (base.isdef(x.displaced)) {
			// console.log('DDDDDDDDDDDDDDDDDDIS')
			this.State.poolArr.unshift(x.displaced);
		}


		this.io.emit('gameState',
			{
				state: {
					rows: this.State.rows,
					cols: this.State.cols,
					boardArr: this.State.boardArr,
					poolArr: this.State.poolArr,
				}, username: username, msg: 'user ' + username + ' placed ' + perle.Name + ' to field ' + iTo
			});

		// io.emit('gameState', { state: { boardArr: State.boardArr, poolArr: State.poolArr }, username: username, msg: 'user ' + username + ' moved ' + perle.Name + ' to field ' + iField });

	}

	playerPlacesPerle(client, x) {
		let iPerle = x.iPerle;
		let iField = x.iField;
		let username = x.username;
		let state = this.State;
		let perle = state.pool[iPerle];

		base.removeInPlace(state.poolArr, iPerle);
		if (base.isdef(x.displaced)) { state.poolArr.unshift(x.displaced); }

		state.boardArr[iField] = iPerle;

		this.io.emit('gameState', {
			state: { rows: state.rows, cols: state.cols, boardArr: state.boardArr, poolArr: state.poolArr },
			username: username,
			msg: 'user ' + username + ' placed ' + perle.Name + ' to field ' + iField
		});

	}

	playerRemovesPerle(client, x) {
		console.log('!!!!!!!!!!!!!!', x, this.State.boardArr)
		let iPerle = x.iPerle;
		let iFrom = x.iFrom;
		let state = this.State;

		state.boardArr[iFrom] = null;//update board state!
		state.poolArr.unshift(iPerle);
		let pl = this.players[client.id];

		// let newState = this.getState(['rows', 'cols', 'boardArr', 'poolArr']);
		let newState = {
			rows: state.rows,
			cols: state.cols,
			boardArr: state.boardArr,
			poolArr: state.poolArr
		};
		console.log('danch', newState)
		let msg = `user ${pl.name} removed ${this.getPerlenName(iPerle)}`;
		console.log(msg);
		this.sendGameState(pl, newState, msg);
	}

	sendGameState(pl, newState, msg) {
		let username = pl.username;

		this.io.emit('gameState', {
			state: newState, // { rows: G.State.rows, cols: G.State.cols, boardArr: G.State.boardArr, poolArr: G.State.poolArr, },
			username: username,
			msg: msg,
		});


	}
}

//#region interface
function addPerle(filename,client) {
	console.log('adding perle for', filename);
	console.assert(filename == filename.toLowerCase(), 'FILENAME CASING!!!!')

	// if this filename is already present in pool, do NOT add it again!!!
	let emitPool = false, savePerlen = false;
	//not in PerlenDict => not in pool!
	let perle;
	if (perleNichtInPerlenDict(filename)) { emitPool = true; savePerlen = true; perle = addToPerlenDict(filename); }
	else perle = PerlenDict[filename];

	console.assert(base.isdef(perle), 'KEINE PERLE!!!!!!!!!!!!!! ' + filename);

	let poolPerle = G.getPerleByFilename(filename);
	if (poolPerle == null) {
		poolPerle = G.addToPool(perle);
		G.emitGameStateIncludingPool(client);		//io.emit('gameState', { state: State });		
		if (savePerlen) { savePerlenDictToFile(); }
	}
	// if (perleNichtInStatePool(perle)) { emitPool = true; addToByIndex(perle); }
	else { console.assert(base.isdef(G.State.pool[poolPerle.index]), 'SCHON IN STATE POOL!!! do nothing!'); }
}
//BROKENfunction partialObject(o, keys) { let onew = {}; for (const k of keys) onew = o[k]; return onew; }
function handleImage(client, x) {
	try {
		let isTesting = x.filename == 'aaa';
		let fname;
		if (isTesting) {
			fname = path.join(__dirname, x.filename + '.png');
			console.log('...fake saving file', fname); return;
		}
		let filename = x.filename.toLowerCase();
		fname = path.join(__dirname, '../public/assets/games/perlen/perlen/' + x.filename + '.png')
		let imgData = decodeBase64Image(x.data);
		fs.writeFile(fname, imgData.data,
			function () {
				console.log('...images saved:', fname);
				addPerle(filename, client);		// add perle!
			});
	}
	catch (error) {
		console.log('ERROR:', error);
	}
}


//#endregion

//#region DONE!
function initPerlenGame(IO, perlenDict) {
	console.log('hhhhhhhhhhhhhhhh');
	PerlenDict = perlenDict;
	G = new GP1(IO, perlenDict);
	console.log('players', G.players);
}
function handleMovePerle(client, x) { G.playerMovesPerle(client, x); }
function handlePlayerLeft(client, x) { G.playerLeft(client, x); }
function handlePlacePerle(client, x) { G.playerPlacesPerle(client, x); }
function handleRelayout(client, x) { G.boardLayoutChange(client, x); }
function handleRemovePerle(client, x) { G.playerRemovesPerle(client, x); }
function handleReset(client, x) {
	console.log('handleReset', x)
	G.initState(x);
	//console.log('...',G.State.poolArr)
	//G.io.emit('gameState', { state: G.State });
	G.emitGameStateIncludingPool(client);

}
function handleStartOrJoin(client, x) { G.playerJoins(client, x); }

//#region helpers
function addToPerlenDict(filename) {
	let perle = {
		Name: filename,
		path: filename,
		Update: base.formatDate(),
		Created: base.formatDate(),
		"Fe Tags": '',
		"Wala Tags": '',
		"Ma Tags": ''
	};
	PerlenDict[filename] = perle;
	return perle;
}
function addToByIndex(perle) {
	function nextIndex(perle) {
		perle.index = MaxIndex;
		MaxIndex += 1;
		byIndex[perle.index] = perle;
	}
	let newPerle = {};
	base.copyKeys(perle, newPerle);
	nextIndex(newPerle);
	//console.assert(base.isdef(State.pool[newPerle.index]));
	return newPerle;
}
function addToPoolArr(index) { State.poolArr.push(index); }
function decodeBase64Image(dataString) {
	var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
	var response = {};

	if (matches.length !== 3) {
		return new Error('Invalid input string');
	}

	response.type = matches[1];
	response.data = Buffer.from(matches[2], 'base64');

	return response;
}
function emitGameStateIncludingPool(username) { io.emit('gameState', { state: State, username: username }); }
function findPerleInStatePool(p) {
	for (const idx in State.pool) {
		if (State.pool.path == p.path) return State.pool[idx];
	}
	return null;
}
function getRandomPerlenKeys(n) { return base.choose(Object.keys(PerlenDict), n); }

function initState(settings = {}) {
	byIndex = {}; MaxIndex = 0; State = {};

	let [rows, cols] = [base.valf(settings.rows, ROWS), base.valf(settings.cols, COLS)];
	let board = new Array(rows * cols);
	let keys = getRandomPerlenKeys(base.valf(settings.N, N));
	//keys[0]='playful';
	//keys[1]='carelessness';
	keys.map(x => addToByIndex(PerlenDict[x]));

	State = {
		rows: rows,
		cols: cols,
		poolArr: Object.values(byIndex).map(x => x.index),
		boardArr: board,
		pool: byIndex,
		players: [],
	};

	let n = keys.length;
	console.log('==>there are ', n, 'perlen');
}
function log() { if (Verbose) console.log('perlen: ', ...arguments); }
function logBroadcast(type) { MessageCounter++; log('#' + MessageCounter, 'broadcast ' + type); }
function logSend(type) { MessageCounter++; log('#' + MessageCounter, 'send ' + type); }
function logReceive(type) { MessageCounter++; log('#' + MessageCounter, 'receive ' + type); }
function perleNichtInPerlenDict(filename) { return base.nundef(PerlenDict[filename]); }
function perleNichtInStatePool(p) {
	for (const idx in State.pool) {
		if (State.pool.path == p.path) return false;
	}
	return true;
}
function savePerlenDictToFile() {
	// let newDict = {};
	// for (const k in PerlenDict) {
	// 	let newPerle = jsCopy(PerlenDict[k]);
	// 	delete newPerle.index;
	// 	newDict[k] = newPerle;
	// }

	utils.toYamlFile(PerlenDict, path.join(__dirname, '../public/perlenDict.yaml'));
}




