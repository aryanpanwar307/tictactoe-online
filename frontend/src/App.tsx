import { useState, useEffect } from 'react';
import { authenticate, connectSocket, disconnectSocket, nakamaSession, nakamaSocket, nakamaClient } from './nakama';
import type { MatchmakerMatched } from '@heroiclabs/nakama-js';
import './index.css';

const AppState = {
  LOGIN: 0,
  MENU: 1,
  MATCHMAKING: 2,
  IN_GAME: 3,
  LEADERBOARD: 4,
  CREATE_ROOM: 5,
  LOBBY_BROWSER: 6
} as const;
type AppState = typeof AppState[keyof typeof AppState];

const OpCode = {
    MOVE: 1,
    BOARD: 2,
    REJECTED: 3,
    WINNER: 4,
    DRAW: 5
} as const;

interface GameState {
    board: (number | null)[];
    marks: { [userId: string]: number };
    players: { userId: string }[];
    activePlayerId: string | null;
    winnerPlayerId: string | null;
    draw: boolean;
    isTimed: boolean;
}

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.LOGIN);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  
  // Matchmaking
  const [ticket, setTicket] = useState<string>('');
  
  // Game
  const [matchId, setMatchId] = useState<string>('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  
  // Leaderboard
  const [leaderboardRecords, setLeaderboardRecords] = useState<any[]>([]);

  // Lobby & Custom Rooms
  const [roomName, setRoomName] = useState('');
  const [lobbyRooms, setLobbyRooms] = useState<any[]>([]);

  // Game Mode
  const [gameMode, setGameMode] = useState<"timed" | "classic">("timed");

  // Restore session if available
  useEffect(() => {
    return () => {
      disconnectSocket();
    }
  }, []);

  // Setup socket listeners
  useEffect(() => {
    if (!nakamaSocket) return;

    nakamaSocket.onmatchmakermatched = async (matched: MatchmakerMatched) => {
      console.log("Matched!", matched);
      try {
        const match = await nakamaSocket!.joinMatch(matched.match_id);
        setMatchId(match.match_id);
        setAppState(AppState.IN_GAME);
      } catch (err) {
        console.error("Failed to join match", err);
        setError("Failed to join match");
        setAppState(AppState.MENU);
      }
    };

    nakamaSocket.onmatchdata = (matchData) => {
      const { op_code, data } = matchData;
      
      if (op_code === OpCode.BOARD || op_code === OpCode.WINNER || op_code === OpCode.DRAW) {
          const str = new TextDecoder().decode(data);
          const state = JSON.parse(str) as GameState;
          setGameState(state);
          setTimeLeft(30); // reset local timer clock
      } else if (op_code === OpCode.REJECTED) {
          const str = new TextDecoder().decode(data);
          console.warn("Move rejected:", str);
      }
    };
  }, [appState]);

  useEffect(() => {
    if (appState === AppState.IN_GAME && gameState && !gameState.winnerPlayerId && !gameState.draw) {
        const interval = setInterval(() => {
            setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
        }, 1000);
        return () => clearInterval(interval);
    }
  }, [appState, gameState]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    try {
      setError('');
      await authenticate(username);
      await connectSocket();
      setAppState(AppState.MENU);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const handleFindMatch = async () => {
    if (!nakamaSocket) return;
    try {
      setAppState(AppState.MATCHMAKING);
      const query = `+properties.mode:${gameMode}`;
      const matchmakerTicket = await nakamaSocket.addMatchmaker(query, 2, 2, { mode: gameMode });
      setTicket(matchmakerTicket.ticket);
    } catch (err: any) {
      setError(err.message || 'Matchmaking failed');
      setAppState(AppState.MENU);
    }
  };

  const handleCancelMatch = async () => {
    if (!nakamaSocket) return;
    if (ticket) {
        await nakamaSocket.removeMatchmaker(ticket);
        setTicket('');
    }
    setAppState(AppState.MENU);
  }

  const handleMove = async (index: number) => {
    if (!nakamaSocket || !matchId || !gameState) return;
    
    // Optimistic check
    if (gameState.winnerPlayerId || gameState.draw) return;
    if (gameState.activePlayerId !== nakamaSession?.user_id) return;
    if (gameState.board[index] !== null) return;

    const moveData = JSON.stringify({ position: index });
    await nakamaSocket.sendMatchState(matchId, OpCode.MOVE, moveData);
  };

  const leaveMatch = async () => {
      if (matchId && nakamaSocket) {
          await nakamaSocket.leaveMatch(matchId);
      }
      setMatchId('');
      setGameState(null);
      setAppState(AppState.MENU);
  }

  const handleShowLeaderboards = async () => {
    if (!nakamaSession) return;
    try {
      // Explicitly request up to 5 records from the backend
      const records = await nakamaClient.listLeaderboardRecords(nakamaSession, "tictactoe_wins", undefined, 5);
      // Guarantee that we don't display more than 5 in the UI
      const top5 = (records.records || []).slice(0, 5);
      setLeaderboardRecords(top5);
      setAppState(AppState.LEADERBOARD);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nakamaSession || !nakamaClient || !nakamaSocket || !roomName.trim()) return;
    try {
      setError('');
      const response = await nakamaClient.rpc(nakamaSession, "create_match", { roomName, mode: gameMode });
      const matchId = (response.payload as any)?.matchId;
      if (matchId) {
        const match = await nakamaSocket.joinMatch(matchId);
        setMatchId(match.match_id);
        setAppState(AppState.IN_GAME);
      }
    } catch (err: any) {
      setError("Failed to create match");
      console.error(err);
    }
  };

  const handleListRooms = async () => {
    if (!nakamaSession || !nakamaClient) return;
    try {
      setAppState(AppState.LOBBY_BROWSER);
      setError('');
      const matches = await nakamaClient.listMatches(nakamaSession, 10, true, undefined, undefined, undefined, "+label.type:tictactoe +label.open:1");
      setLobbyRooms(matches.matches || []);
    } catch (e: any) {
      console.error(e);
      setError("Failed to fetch matches");
    }
  };

  const handleJoinRoom = async (joinMatchId: string) => {
    if (!nakamaSocket) return;
    try {
      const match = await nakamaSocket.joinMatch(joinMatchId);
      setMatchId(match.match_id);
      setAppState(AppState.IN_GAME);
    } catch (err: any) {
      setError("Failed to join this match: " + err.message);
      console.error(err);
    }
  };

  const renderLogin = () => (
    <div className="card">
      <h2>Welcome to <span className="game-title" style={{fontSize: "1.5rem"}}>Neo Tic-Tac-Toe</span></h2>
      <form onSubmit={handleLogin}>
        <input 
          className="input-field" 
          placeholder="Enter display name..." 
          value={username} 
          onChange={e => setUsername(e.target.value)}
          maxLength={15}
        />
        <button type="submit" className="btn btn-primary" disabled={!username.trim()}>
          Join the Arena
        </button>
      </form>
      {error && <p style={{color: 'var(--primary-red)', marginTop: '1rem'}}>{error}</p>}
    </div>
  );

  const renderMenu = () => (
    <div className="card">
      <h2 style={{marginBottom: "1rem"}}>Hello, {nakamaSession?.username || 'Player'}!</h2>
      <p style={{color: 'var(--text-muted)', marginBottom: "1rem"}}>Ready to play?</p>
      
      <div style={{ marginBottom: "1.5rem" }}>
         <label style={{ marginRight: '1rem', color: 'var(--text-main)' }}>Game Mode: </label>
         <select value={gameMode} onChange={e => setGameMode(e.target.value as any)} className="input-field" style={{ width: 'auto', display: 'inline-block' }}>
            <option value="timed">Timed (30s)</option>
            <option value="classic">Classic (Unlimited)</option>
         </select>
      </div>

      <button onClick={handleFindMatch} className="btn btn-primary" style={{marginBottom: "1rem"}}>
        Find Random Match
      </button>

      <button onClick={() => setAppState(AppState.CREATE_ROOM)} className="btn btn-primary" style={{marginBottom: "1rem", background: 'var(--accent)'}}>
        Create Custom Room
      </button>

      <button onClick={handleListRooms} className="btn btn-primary" style={{marginBottom: "1rem", background: 'var(--accent)'}}>
        Browse Lobbies
      </button>

      <button onClick={handleShowLeaderboards} className="btn" style={{background: 'var(--border)'}}>
        Top Players
      </button>
    </div>
  );

  const renderCreateRoom = () => (
    <div className="card">
      <h2>Create Custom Room</h2>
      <form onSubmit={handleCreateRoomSubmit}>
        <input 
          className="input-field" 
          placeholder="Enter room name..." 
          value={roomName} 
          onChange={e => setRoomName(e.target.value)}
          maxLength={20}
          style={{marginBottom: '1rem'}}
        />
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', justifyContent: 'center' }}>
            <label style={{ marginRight: '1rem', color: 'var(--text-main)' }}>Mode: </label>
            <select value={gameMode} onChange={e => setGameMode(e.target.value as any)} className="input-field" style={{ width: 'auto' }}>
                <option value="timed">Timed</option>
                <option value="classic">Classic</option>
            </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={!roomName.trim()}>
          Create & Join
        </button>
      </form>
      <button onClick={() => setAppState(AppState.MENU)} className="btn btn-danger" style={{marginTop: "1rem"}}>
        Cancel
      </button>
      {error && <p style={{color: 'var(--primary-red)', marginTop: '1rem'}}>{error}</p>}
    </div>
  );

  const renderLobbyBrowser = () => (
    <div className="card">
      <h2>Lobby Browser</h2>
      <div style={{marginTop: "1.5rem", marginBottom: "1.5rem", textAlign: "left"}}>
          {lobbyRooms.length === 0 ? <p>No open rooms found.</p> : (
            lobbyRooms.map((match, i) => {
              let label = { name: "Unknown Room" };
              try { if (match.label) label = JSON.parse(match.label); } catch(e) {}
              return (
                <div key={i} style={{display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem", borderBottom: "1px solid var(--border)"}}>
                    <span>{label.name}</span>
                    <button onClick={() => handleJoinRoom(match.match_id)} className="btn btn-primary" style={{padding: "5px 10px", fontSize: "0.9rem"}}>
                      Join
                    </button>
                </div>
              );
            })
          )}
      </div>
      <button onClick={handleListRooms} className="btn btn-primary" style={{marginBottom: "1rem", marginRight: "1rem"}}>
        Refresh
      </button>
      <button onClick={() => setAppState(AppState.MENU)} className="btn btn-danger">
        Back
      </button>
      {error && <p style={{color: 'var(--primary-red)', marginTop: '1rem'}}>{error}</p>}
    </div>
  );

  const renderLeaderboards = () => (
    <div className="card">
      <h2>Global Hall of Fame</h2>
      <div style={{marginTop: "1.5rem", marginBottom: "1.5rem", textAlign: "left"}}>
          {leaderboardRecords.length === 0 ? <p>No records found.</p> : (
            leaderboardRecords.map((r, i) => {
                const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {});
                return (
                    <div key={i} className="leaderboard-row">
                        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                            <div>
                                <span className="leaderboard-rank">#{i+1}</span>
                                <span style={{fontSize: "1.2rem", fontWeight: "600"}}>{r.username}</span>
                            </div>
                            <span style={{color: "var(--primary-blue)", fontWeight: "bold", fontSize: "1.3rem", textShadow: "0 0 10px rgba(14, 165, 233, 0.4)"}}>{r.score} WINS</span>
                        </div>
                        <div style={{display: "flex", justifyContent: "flex-end", fontSize: "0.95rem", color: "var(--text-muted)", gap: "1.5rem", marginTop: "0.5rem"}}>
                            <span style={{color: "rgba(239, 68, 68, 0.8)", fontWeight: "bold"}}>{meta.losses || 0} LOSSES</span>
                            <span style={{color: "rgba(139, 92, 246, 0.8)", fontWeight: "bold"}}>{meta.streak || 0} STREAK</span>
                        </div>
                    </div>
                )
            })
          )}
      </div>
      <button onClick={() => setAppState(AppState.MENU)} className="btn btn-primary">
        Back
      </button>
    </div>
  );

  const renderMatchmaking = () => (
    <div className="card">
      <h2>Finding Opponent</h2>
      <div className="loader"></div>
      <p style={{color: 'var(--text-muted)', marginBottom: "2rem"}}>Matching you with a random player...</p>
      <button onClick={handleCancelMatch} className="btn btn-danger">
        Cancel
      </button>
    </div>
  );

  const renderGame = () => {
    if (!gameState) {
        return <div className="card"><div className="loader"></div><p>Initializing...</p></div>;
    }

    const { board, marks, activePlayerId, winnerPlayerId, draw } = gameState;
    const isMyTurn = activePlayerId === nakamaSession?.user_id;
    const myMark = marks[nakamaSession?.user_id ?? ""] === 1 ? 'X' : 'O';
    
    return (
      <div>
        <div className="game-header">
            <div className={`player-info ${isMyTurn && !winnerPlayerId && !draw ? 'active-turn' : ''}`}>
                <div className="player-name">Player ({myMark})</div>
                <div className="turn-indicator">{isMyTurn ? 'YOUR TURN' : 'WAITING...'}</div>
            </div>
            {!winnerPlayerId && !draw && gameState.isTimed && (
                <div className="timer-text" style={{color: timeLeft <= 5 ? 'var(--primary-red)' : 'var(--text-main)'}}>
                    {timeLeft}s
                </div>
            )}
        </div>
        
        <div className="board">
          {board.map((cell, idx) => (
            <div 
              key={idx} 
              className={`cell ${cell === 1 ? 'mark-x' : cell === 2 ? 'mark-o' : ''}`}
              onClick={() => handleMove(idx)}
            >
              {cell === 1 ? 'X' : cell === 2 ? 'O' : ''}
            </div>
          ))}
        </div>
        
        {winnerPlayerId || draw ? (
            <div className="modal-overlay">
                <div className="modal">
                    <h2 className={`result-text ${!draw && winnerPlayerId === nakamaSession?.user_id ? 'win-text' : !draw ? 'loss-text' : ''}`}>
                        {draw ? "DRAW!" : winnerPlayerId === nakamaSession?.user_id ? "VICTORY" : "DEFEAT"}
                    </h2>
                    <button onClick={leaveMatch} className="btn btn-primary" style={{marginTop: '1rem'}}>
                        RETURN TO LOBBY
                    </button>
                </div>
            </div>
        ) : (
             <button onClick={leaveMatch} className="btn btn-danger" style={{marginTop: "2rem"}}>
                Surrender & Leave
            </button>
        )}
      </div>
    );
  };

  return (
    <div className="container">
      {appState === AppState.LOGIN && <h1 className="game-title">NEO TIC-TAC-TOE</h1>}
      
      {appState === AppState.LOGIN && renderLogin()}
      {appState === AppState.MENU && renderMenu()}
      {appState === AppState.MATCHMAKING && renderMatchmaking()}
      {appState === AppState.IN_GAME && renderGame()}
      {appState === AppState.LEADERBOARD && renderLeaderboards()}
      {appState === AppState.CREATE_ROOM && renderCreateRoom()}
      {appState === AppState.LOBBY_BROWSER && renderLobbyBrowser()}
    </div>
  );
}

export default App;
