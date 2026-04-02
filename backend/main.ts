import { matchInit, matchJoinAttempt, matchJoin, matchLeave, matchLoop, matchTerminate, matchSignal } from "./match_handler";

const matchmakerMatched: nkruntime.MatchmakerMatchedFunction = function (context, logger, nk, matches) {
    try {
        let mode = "timed";
        if (matches.length > 0 && matches[0].properties && matches[0].properties["mode"]) {
            mode = matches[0].properties["mode"];
        }
        const matchId = nk.matchCreate("tictactoe", { mode });
        return matchId;
    } catch (error: any) {
        logger.error('Error creating match: %s', error.message);
        throw error;
    }
}

const rpcCreateMatch: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
    let params: { roomName?: string, mode?: string } = {};
    try {
        if (payload) {
            params = JSON.parse(payload);
        }
    } catch (e) {
        throw new Error("Invalid payload");
    }

    try {
        const matchId = nk.matchCreate("tictactoe", params);
        return JSON.stringify({ matchId });
    } catch (error: any) {
        logger.error('Error creating match: %s', error.message);
        throw error;
    }
}

let InitModule: nkruntime.InitModule = function (ctx, logger, nk, initializer) {
    initializer.registerMatch("tictactoe", {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLeave,
        matchLoop,
        matchTerminate,
        matchSignal
    });

    try {
        nk.leaderboardCreate("tictactoe_wins", false, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.INCREMENTAL, null, null);
    } catch(e) {
        logger.debug("Leaderboard already exists: tictactoe_wins");
    }

    initializer.registerMatchmakerMatched(matchmakerMatched);
    initializer.registerRpc("create_match", rpcCreateMatch);
    
    logger.info("TicTacToe module initialized!");
};

// @ts-ignore
!InitModule && InitModule.bind(null);
