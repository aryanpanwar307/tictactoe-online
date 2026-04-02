var OpCode;
(function (OpCode) {
    OpCode[OpCode["MOVE"] = 1] = "MOVE";
    OpCode[OpCode["BOARD"] = 2] = "BOARD";
    OpCode[OpCode["REJECTED"] = 3] = "REJECTED";
    OpCode[OpCode["WINNER"] = 4] = "WINNER";
    OpCode[OpCode["DRAW"] = 5] = "DRAW";
})(OpCode || (OpCode = {}));
var TICK_RATE = 5;
function getWinner(board) {
    var lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (var i = 0; i < lines.length; i++) {
        var _a = lines[i], a = _a[0], b = _a[1], c = _a[2];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}
function getStats(nk, userId) {
    var stats = { wins: 0, losses: 0, streak: 0 };
    try {
        var records = nk.leaderboardRecordsList("tictactoe_wins", [userId], 1);
        if (records.ownerRecords && records.ownerRecords.length > 0) {
            var r = records.ownerRecords[0];
            stats.wins = r.score;
            if (r.metadata) {
                var meta = r.metadata;
                if (typeof meta.losses === "number")
                    stats.losses = meta.losses;
                if (typeof meta.streak === "number")
                    stats.streak = meta.streak;
            }
        }
    }
    catch (e) { }
    return stats;
}
function updateLeaderboard(nk, userId, username, outcome) {
    try {
        var stats = getStats(nk, userId);
        var scoreIncr = 0;
        if (outcome === "win") {
            stats.wins += 1;
            stats.streak += 1;
            scoreIncr = 1;
        }
        else if (outcome === "loss") {
            stats.losses += 1;
            stats.streak = 0;
            scoreIncr = 0;
        }
        else if (outcome === "draw") {
            stats.streak += 1;
            scoreIncr = 0;
        }
        var metadata = { losses: stats.losses, streak: stats.streak };
        nk.leaderboardRecordWrite("tictactoe_wins", userId, username, scoreIncr, 0, metadata);
    }
    catch (e) { }
}
var matchInit = function (ctx, logger, nk, params) {
    var isTimed = (params === null || params === void 0 ? void 0 : params.mode) !== "classic";
    var state = {
        board: new Array(9).fill(null),
        marks: {},
        players: [],
        activePlayerId: null,
        winnerPlayerId: null,
        draw: false,
        deadline: 0,
        isTimed: isTimed
    };
    var roomName = (params === null || params === void 0 ? void 0 : params.roomName) || "Random Match";
    var labelJSON = JSON.stringify({ type: "tictactoe", open: 1, name: roomName, mode: isTimed ? "timed" : "classic" });
    return {
        state: state,
        tickRate: TICK_RATE,
        label: labelJSON
    };
};
var matchJoinAttempt = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    if (state.players.length >= 2) {
        return { state: state, accept: false, rejectReason: "Match is full" };
    }
    return { state: state, accept: true };
};
var matchJoin = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    for (var _i = 0, presences_1 = presences; _i < presences_1.length; _i++) {
        var presence = presences_1[_i];
        if (state.players.length < 2) {
            state.players.push(presence);
            // Player 1 gets 1 (X), Player 2 gets 2 (O)
            state.marks[presence.userId] = state.players.length;
        }
    }
    if (state.players.length === 2 && !state.activePlayerId) {
        state.activePlayerId = state.players[0].userId;
        if (state.isTimed) {
            state.deadline = tick + (TICK_RATE * 30); // 30 seconds timer
        }
        try {
            if (ctx.matchLabel) {
                var currentLabel = JSON.parse(ctx.matchLabel);
                currentLabel.open = 0;
                dispatcher.matchLabelUpdate(JSON.stringify(currentLabel));
            }
        }
        catch (e) {
            logger.error("Failed to parse label: " + e.message);
        }
        dispatcher.broadcastMessage(OpCode.BOARD, JSON.stringify(state));
    }
    return { state: state };
};
var matchLeave = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    var _loop_1 = function (presence) {
        state.players = state.players.filter(function (p) { return p.userId !== presence.userId; });
        if (!state.winnerPlayerId && !state.draw) {
            var remaining = state.players[0];
            if (remaining) {
                state.winnerPlayerId = remaining.userId;
                updateLeaderboard(nk, remaining.userId, remaining.username, "win");
                updateLeaderboard(nk, presence.userId, presence.username, "loss");
                dispatcher.broadcastMessage(OpCode.WINNER, JSON.stringify(state));
            }
        }
    };
    for (var _i = 0, presences_2 = presences; _i < presences_2.length; _i++) {
        var presence = presences_2[_i];
        _loop_1(presence);
    }
    return { state: state };
};
var matchLoop = function (ctx, logger, nk, dispatcher, tick, state, messages) {
    var _a, _b;
    if (state.winnerPlayerId || state.draw) {
        if (state.players.length === 0)
            return null; // Clean up memory when all leave
        return { state: state };
    }
    // Timer check
    if (state.isTimed && state.players.length === 2 && tick >= state.deadline) {
        var remaining = state.players.find(function (p) { return p.userId !== state.activePlayerId; });
        var active = state.players.find(function (p) { return p.userId === state.activePlayerId; });
        if (remaining && active) {
            state.winnerPlayerId = remaining.userId;
            updateLeaderboard(nk, remaining.userId, remaining.username, "win");
            updateLeaderboard(nk, active.userId, active.username, "loss");
            dispatcher.broadcastMessage(OpCode.WINNER, JSON.stringify(state));
            return { state: state };
        }
    }
    var _loop_2 = function (message) {
        if (message.opCode === OpCode.MOVE) {
            var userId_1 = message.sender.userId;
            if (userId_1 !== state.activePlayerId) {
                dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ error: "Not your turn" }), [message.sender]);
                return "continue";
            }
            var data = void 0;
            try {
                data = JSON.parse(nk.binaryToString(message.data));
            }
            catch (e) {
                return "continue";
            }
            var position = data.position;
            if (typeof position !== "number" || position < 0 || position > 8 || state.board[position] !== null) {
                dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ error: "Invalid move" }), [message.sender]);
                return "continue";
            }
            state.board[position] = state.marks[userId_1];
            var markWin = getWinner(state.board);
            if (markWin) {
                state.winnerPlayerId = userId_1;
                var winnerUsername = ((_a = state.players.find(function (p) { return p.userId === userId_1; })) === null || _a === void 0 ? void 0 : _a.username) || "winner";
                var loser = state.players.find(function (p) { return p.userId !== userId_1; });
                updateLeaderboard(nk, userId_1, winnerUsername, "win");
                if (loser) {
                    updateLeaderboard(nk, loser.userId, loser.username, "loss");
                }
                dispatcher.broadcastMessage(OpCode.WINNER, JSON.stringify(state));
                return { value: { state: state } };
            }
            if (state.board.every(function (cell) { return cell !== null; })) {
                state.draw = true;
                for (var _c = 0, _d = state.players; _c < _d.length; _c++) {
                    var p = _d[_c];
                    updateLeaderboard(nk, p.userId, p.username, "draw");
                }
                dispatcher.broadcastMessage(OpCode.DRAW, JSON.stringify(state));
                return { value: { state: state } };
            }
            state.activePlayerId = ((_b = state.players.find(function (p) { return p.userId !== userId_1; })) === null || _b === void 0 ? void 0 : _b.userId) || null;
            if (state.isTimed) {
                state.deadline = tick + (TICK_RATE * 30); // reset timer
            }
            dispatcher.broadcastMessage(OpCode.BOARD, JSON.stringify(state));
        }
    };
    for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
        var message = messages_1[_i];
        var state_1 = _loop_2(message);
        if (typeof state_1 === "object")
            return state_1.value;
    }
    // Stop tracking abandoned matches
    if (state.players.length === 0 && tick > TICK_RATE * 30) {
        return null;
    }
    return { state: state };
};
var matchTerminate = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    return { state: state };
};
var matchSignal = function (ctx, logger, nk, dispatcher, tick, state, data) {
    return { state: state, data: "" };
};

var matchmakerMatched = function (context, logger, nk, matches) {
    try {
        var mode = "timed";
        if (matches.length > 0 && matches[0].properties && matches[0].properties["mode"]) {
            mode = matches[0].properties["mode"];
        }
        var matchId = nk.matchCreate("tictactoe", { mode: mode });
        return matchId;
    }
    catch (error) {
        logger.error('Error creating match: %s', error.message);
        throw error;
    }
};
var rpcCreateMatch = function (ctx, logger, nk, payload) {
    var params = {};
    try {
        if (payload) {
            params = JSON.parse(payload);
        }
    }
    catch (e) {
        throw new Error("Invalid payload");
    }
    try {
        var matchId = nk.matchCreate("tictactoe", params);
        return JSON.stringify({ matchId: matchId });
    }
    catch (error) {
        logger.error('Error creating match: %s', error.message);
        throw error;
    }
};
var InitModule = function (ctx, logger, nk, initializer) {
    initializer.registerMatch("tictactoe", {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal
    });
    try {
        nk.leaderboardCreate("tictactoe_wins", false, "descending" /* nkruntime.SortOrder.DESCENDING */, "increment" /* nkruntime.Operator.INCREMENTAL */, null, null);
    }
    catch (e) {
        logger.debug("Leaderboard already exists: tictactoe_wins");
    }
    initializer.registerMatchmakerMatched(matchmakerMatched);
    initializer.registerRpc("create_match", rpcCreateMatch);
    logger.info("TicTacToe module initialized!");
};
// @ts-ignore
!InitModule && InitModule.bind(null);
