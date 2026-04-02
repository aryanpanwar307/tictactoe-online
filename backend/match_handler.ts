interface State {
    board: (number | null)[];
    marks: { [userId: string]: number };
    players: nkruntime.Presence[];
    activePlayerId: string | null;
    winnerPlayerId: string | null;
    draw: boolean;
    deadline: number;
    isTimed: boolean;
}

enum OpCode {
    MOVE = 1,
    BOARD = 2,
    REJECTED = 3,
    WINNER = 4,
    DRAW = 5
}

const TICK_RATE = 5;

function getWinner(board: (number | null)[]): number | null {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
        const [a, b, c] = lines[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

function getStats(nk: nkruntime.Nakama, userId: string): { wins: number, losses: number, streak: number } {
    let stats = { wins: 0, losses: 0, streak: 0 };
    try {
        const records = nk.leaderboardRecordsList("tictactoe_wins", [userId], 1);
        if (records.ownerRecords && records.ownerRecords.length > 0) {
            const r = records.ownerRecords[0];
            stats.wins = r.score;
            if (r.metadata) {
                const meta = r.metadata as any;
                if (typeof meta.losses === "number") stats.losses = meta.losses;
                if (typeof meta.streak === "number") stats.streak = meta.streak;
            }
        }
    } catch (e) { }
    return stats;
}

function updateLeaderboard(nk: nkruntime.Nakama, userId: string, username: string, outcome: "win" | "loss" | "draw") {
    try {
        const stats = getStats(nk, userId);
        let scoreIncr = 0;
        if (outcome === "win") {
            stats.wins += 1;
            stats.streak += 1;
            scoreIncr = 1;
        } else if (outcome === "loss") {
            stats.losses += 1;
            stats.streak = 0;
            scoreIncr = 0;
        } else if (outcome === "draw") {
            stats.streak += 1;
            scoreIncr = 0;
        }
        
        const metadata = { losses: stats.losses, streak: stats.streak };
        nk.leaderboardRecordWrite("tictactoe_wins", userId, username, scoreIncr, 0, metadata);
    } catch (e: any) {}
}

export const matchInit: nkruntime.MatchInitFunction<State> = function (ctx, logger, nk, params) {
    const isTimed = params?.mode !== "classic";
    const state: State = {
        board: new Array(9).fill(null),
        marks: {},
        players: [],
        activePlayerId: null,
        winnerPlayerId: null,
        draw: false,
        deadline: 0,
        isTimed
    };
    const roomName = params?.roomName || "Random Match";
    const labelJSON = JSON.stringify({ type: "tictactoe", open: 1, name: roomName, mode: isTimed ? "timed" : "classic" });
    
    return {
        state,
        tickRate: TICK_RATE,
        label: labelJSON
    };
};

export const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<State> = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    if (state.players.length >= 2) {
        return { state, accept: false, rejectReason: "Match is full" };
    }
    return { state, accept: true };
};

export const matchJoin: nkruntime.MatchJoinFunction<State> = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    for (const presence of presences) {
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
                const currentLabel = JSON.parse(ctx.matchLabel);
                currentLabel.open = 0;
                dispatcher.matchLabelUpdate(JSON.stringify(currentLabel));
            }
        } catch (e: any) {
            logger.error("Failed to parse label: " + e.message);
        }

        dispatcher.broadcastMessage(OpCode.BOARD, JSON.stringify(state));
    }

    return { state };
};

export const matchLeave: nkruntime.MatchLeaveFunction<State> = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    for (const presence of presences) {
        state.players = state.players.filter(p => p.userId !== presence.userId);
        
        if (!state.winnerPlayerId && !state.draw) {
            const remaining = state.players[0];
            if (remaining) {
                state.winnerPlayerId = remaining.userId;
                updateLeaderboard(nk, remaining.userId, remaining.username, "win");
                updateLeaderboard(nk, presence.userId, presence.username, "loss");
                dispatcher.broadcastMessage(OpCode.WINNER, JSON.stringify(state));
            }
        }
    }
    return { state };
};

export const matchLoop: nkruntime.MatchLoopFunction<State> = function (ctx, logger, nk, dispatcher, tick, state, messages) {
    if (state.winnerPlayerId || state.draw) {
        if (state.players.length === 0) return null; // Clean up memory when all leave
        return { state };
    }

    // Timer check
    if (state.isTimed && state.players.length === 2 && tick >= state.deadline) {
        const remaining = state.players.find(p => p.userId !== state.activePlayerId);
        const active = state.players.find(p => p.userId === state.activePlayerId);
        if (remaining && active) {
            state.winnerPlayerId = remaining.userId;
            updateLeaderboard(nk, remaining.userId, remaining.username, "win");
            updateLeaderboard(nk, active.userId, active.username, "loss");
            dispatcher.broadcastMessage(OpCode.WINNER, JSON.stringify(state));
            return { state };
        }
    }

    for (const message of messages) {
        if (message.opCode === OpCode.MOVE) {
            const userId = message.sender.userId;
            
            if (userId !== state.activePlayerId) {
                dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ error: "Not your turn" }), [message.sender]);
                continue;
            }

            let data;
            try {
                data = JSON.parse(nk.binaryToString(message.data));
            } catch (e) {
                continue;
            }

            const position = data.position;
            if (typeof position !== "number" || position < 0 || position > 8 || state.board[position] !== null) {
                dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ error: "Invalid move" }), [message.sender]);
                continue;
            }

            state.board[position] = state.marks[userId];
            
            const markWin = getWinner(state.board);
            if (markWin) {
                state.winnerPlayerId = userId;
                const winnerUsername = state.players.find(p => p.userId === userId)?.username || "winner";
                const loser = state.players.find(p => p.userId !== userId);
                
                updateLeaderboard(nk, userId, winnerUsername, "win");
                if (loser) {
                    updateLeaderboard(nk, loser.userId, loser.username, "loss");
                }
                
                dispatcher.broadcastMessage(OpCode.WINNER, JSON.stringify(state));
                return { state };
            }
            
            if (state.board.every(cell => cell !== null)) {
                state.draw = true;
                for (const p of state.players) {
                    updateLeaderboard(nk, p.userId, p.username, "draw");
                }
                dispatcher.broadcastMessage(OpCode.DRAW, JSON.stringify(state));
                return { state };
            }

            state.activePlayerId = state.players.find(p => p.userId !== userId)?.userId || null;
            if (state.isTimed) {
                state.deadline = tick + (TICK_RATE * 30); // reset timer
            }
            dispatcher.broadcastMessage(OpCode.BOARD, JSON.stringify(state));
        }
    }
    
    // Stop tracking abandoned matches
    if (state.players.length === 0 && tick > TICK_RATE * 30) {
        return null;
    }

    return { state };
};

export const matchTerminate: nkruntime.MatchTerminateFunction<State> = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    return { state };
};

export const matchSignal: nkruntime.MatchSignalFunction<State> = function (ctx, logger, nk, dispatcher, tick, state, data) {
    return { state, data: "" };
};
