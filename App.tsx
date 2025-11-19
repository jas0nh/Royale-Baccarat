import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Hand, GameState, BetPosition, Bets, GameResult, PnLPoint, Suit } from './types';
import { createShoe, calculateScore, isPair, calculatePayout, determineWinner } from './utils/gameLogic';
import { Card as CardComponent } from './components/Card';
import { BettingTable } from './components/BettingTable';
import { PnLChart } from './components/PnLChart';
import { CashierModal } from './components/CashierModal';
import { CHIP_VALUES, INITIAL_BALANCE, MAX_BET, MIN_BET } from './constants';
import { getDealerCommentary } from './services/geminiService';
import { History, RefreshCw, Wallet, User, ChevronDown, Mic, Plus, TrendingUp, Percent } from 'lucide-react';

const INITIAL_BETS: Bets = {
  PLAYER: 0,
  BANKER: 0,
  TIE: 0,
  PLAYER_PAIR: 0,
  BANKER_PAIR: 0
};

export default function App() {
  // Game State
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [shoe, setShoe] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Hand>([]);
  const [bankerHand, setBankerHand] = useState<Hand>([]);
  
  // Betting State
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [currentBets, setCurrentBets] = useState<Bets>(INITIAL_BETS);
  const [selectedChip, setSelectedChip] = useState(CHIP_VALUES[1]);
  
  // Financial State
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [isCashierOpen, setIsCashierOpen] = useState(false);

  // Performance Stats
  const [stats, setStats] = useState({
    totalWagered: 0,
    wins: 0,
    losses: 0
  });

  // History & Stats
  const [history, setHistory] = useState<GameResult[]>([]);
  const [pnlData, setPnlData] = useState<PnLPoint[]>([{ hand: 0, pnl: 0 }]);
  const [commentary, setCommentary] = useState<string>("Welcome to Royale Baccarat. Please deposit funds to start.");
  
  // Refs for audio/animations
  const historyRef = useRef<HTMLDivElement>(null);

  // Initialize Shoe
  useEffect(() => {
    setShoe(createShoe());
    if (INITIAL_BALANCE === 0 && totalDeposited === 0) {
      setIsCashierOpen(true);
    }
  }, []);

  // Scroll history
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollLeft = historyRef.current.scrollWidth;
    }
  }, [history]);

  const handleDeposit = (amount: number) => {
    setBalance(prev => prev + amount);
    setTotalDeposited(prev => prev + amount);
    setCommentary("Deposit successful. Place your bets.");
  };

  const handleWithdraw = (amount: number) => {
    if (amount > balance) return;
    setBalance(prev => prev - amount);
    setTotalWithdrawn(prev => prev + amount);
    setCommentary(`Withdrawn $${amount.toLocaleString()}.`);
  };

  const handlePlaceBet = (position: BetPosition) => {
    if (gameState !== GameState.IDLE && gameState !== GameState.BETTING) return;
    
    // Start betting phase if in idle
    if (gameState === GameState.IDLE) setGameState(GameState.BETTING);

    // Calculate potential new total bet
    const currentTotalBet = Object.values(currentBets).reduce((a, b) => a + b, 0);
    
    if (currentTotalBet + selectedChip > balance) {
      // Logic to add remaining balance could go here, but simple block for now
      setCommentary("Insufficient funds.");
      return;
    }

    if (currentBets[position] + selectedChip > MAX_BET) return;

    setCurrentBets(prev => ({
      ...prev,
      [position]: prev[position] + selectedChip
    }));
    
    setBalance(prev => prev - selectedChip);
  };

  const clearBets = () => {
    const totalRefund = Object.values(currentBets).reduce((a, b) => a + b, 0);
    setBalance(prev => prev + totalRefund);
    setCurrentBets(INITIAL_BETS);
    setGameState(GameState.IDLE);
  };

  const dealGame = async () => {
    const totalBet = Object.values(currentBets).reduce((a, b) => a + b, 0);
    if (totalBet < MIN_BET) {
      setCommentary("Minimum bet is $" + MIN_BET);
      return;
    }
    if (shoe.length < 20) {
       // Reshuffle
       setCommentary("Reshuffling shoe...");
       setShoe(createShoe());
       await new Promise(r => setTimeout(r, 1000));
    }

    setGameState(GameState.DEALING);
    setPlayerHand([]);
    setBankerHand([]);
    setCommentary("Dealing...");

    const newShoe = [...shoe];
    const pHand: Card[] = [];
    const bHand: Card[] = [];

    // Initial Deal: P, B, P, B
    // We use timeouts to simulate dealing animation
    const dealCard = (target: 'P' | 'B', card: Card) => {
       if (target === 'P') pHand.push(card);
       else bHand.push(card);
    };

    const draw = () => newShoe.pop()!;

    // Logic execution immediately to determine outcome, then animate
    const c1 = draw();
    const c2 = draw();
    const c3 = draw();
    const c4 = draw();

    // --- 3rd Card Logic Pre-calculation ---
    let finalPHand = [c1, c3];
    let finalBHand = [c2, c4];
    
    let pScore = calculateScore(finalPHand);
    let bScore = calculateScore(finalBHand);

    let pDrawnCard: Card | null = null;
    let bDrawnCard: Card | null = null;

    // Natural Win Check (8 or 9)
    const isNatural = pScore >= 8 || bScore >= 8;

    if (!isNatural) {
      // Player Rules
      if (pScore <= 5) {
        pDrawnCard = draw();
        finalPHand.push(pDrawnCard);
        pScore = calculateScore(finalPHand);
      }

      // Banker Rules
      if (!pDrawnCard) {
        // Player stood
        if (bScore <= 5) {
          bDrawnCard = draw();
          finalBHand.push(bDrawnCard);
        }
      } else {
        // Player drew, banker rules depend on player's 3rd card value
        const p3Val = pDrawnCard.value;
        let bankerDraws = false;
        
        if (bScore <= 2) bankerDraws = true;
        else if (bScore === 3 && p3Val !== 8) bankerDraws = true;
        else if (bScore === 4 && [2,3,4,5,6,7].includes(p3Val)) bankerDraws = true;
        else if (bScore === 5 && [4,5,6,7].includes(p3Val)) bankerDraws = true;
        else if (bScore === 6 && [6,7].includes(p3Val)) bankerDraws = true;

        if (bankerDraws) {
          bDrawnCard = draw();
          finalBHand.push(bDrawnCard);
        }
      }
    }
    
    bScore = calculateScore(finalBHand); // Recalculate final

    setShoe(newShoe);

    // Animation Sequence
    // Deal initial 4
    setPlayerHand([c1]);
    await wait(500);
    setBankerHand([c2]);
    await wait(500);
    setPlayerHand([c1, c3]);
    await wait(500);
    setBankerHand([c2, c4]);
    await wait(800);

    if (pDrawnCard) {
        setCommentary("Player draws...");
        setPlayerHand(prev => [...prev, pDrawnCard!]);
        await wait(800);
    }

    if (bDrawnCard) {
        setCommentary("Banker draws...");
        setBankerHand(prev => [...prev, bDrawnCard!]);
        await wait(800);
    }

    // Result
    const winner = determineWinner(pScore, bScore);
    const result: GameResult = {
      winner,
      playerScore: pScore,
      bankerScore: bScore,
      isPlayerPair: isPair([c1, c3]), // Only first two cards count for pair bet
      isBankerPair: isPair([c2, c4]),
      payout: 0,
      totalBet,
      timestamp: Date.now(),
      balanceAfter: 0
    };

    const totalPayout = calculatePayout(currentBets, result);
    const netProfit = totalPayout - totalBet; // Profit for this hand
    
    // Update Stats
    setStats(prev => ({
      totalWagered: prev.totalWagered + totalBet,
      wins: netProfit > 0 ? prev.wins + 1 : prev.wins,
      losses: netProfit < 0 ? prev.losses + 1 : prev.losses
      // Pushes (netProfit === 0) are ignored for win rate
    }));

    // Update Balance (add winnings)
    let newBalance = 0;
    setBalance(prev => {
        const newBal = prev + totalPayout;
        newBalance = newBal; // Capture for PnL logic
        result.balanceAfter = newBal;
        result.payout = totalPayout;
        return newBal;
    });

    setGameState(GameState.RESULT);
    setHistory(prev => [...prev, result]);

    // PnL Logic: Current Balance + Total Withdrawn - Total Deposited
    // We use the calculated newBalance because setBalance state update might be async in PnL calculation
    setPnlData(prev => {
      const lastPnl = prev[prev.length - 1]?.pnl ?? 0;
      const nextHand = prev.length;
      const cumulativePnl = lastPnl + netProfit;

      return [...prev, { hand: nextHand, pnl: cumulativePnl }];
    });

    // AI Commentary
    const aiText = await getDealerCommentary(result, pScore, bScore, totalPayout);
    setCommentary(aiText);

    // Reset for next round after delay? No, let user decide when to clear/rebet
  };

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const resetGame = () => {
    setPlayerHand([]);
    setBankerHand([]);
    setCurrentBets(INITIAL_BETS);
    setGameState(GameState.IDLE);
    setCommentary("Place your bets.");
  };

  // Calculations for UI
  const winRate = stats.wins + stats.losses > 0 
    ? (stats.wins / (stats.wins + stats.losses)) * 100 
    : 0;
  
  const currentPnL = (balance + totalWithdrawn) - totalDeposited;
  const roi = stats.totalWagered > 0 
    ? (currentPnL / stats.totalWagered) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-[#0f2015] text-white flex flex-col font-sans overflow-hidden">
      <CashierModal 
        isOpen={isCashierOpen}
        onClose={() => setIsCashierOpen(false)}
        onDeposit={handleDeposit}
        onWithdraw={handleWithdraw}
        currentBalance={balance}
      />

      {/* Header */}
      <header className="bg-black/30 border-b border-white/10 p-4 flex justify-between items-center backdrop-blur-md z-20 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center shadow-lg">
            <span className="font-serif text-xl font-bold text-black">R</span>
          </div>
          <div>
            <h1 className="font-serif text-xl text-yellow-400 tracking-wider">ROYALE</h1>
            <p className="text-xs text-white/50 tracking-[0.2em]">NO COMMISSION BACCARAT</p>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
             <div className="hidden md:flex flex-col items-end text-right">
                <span className="text-xs text-white/50 uppercase">Balance</span>
                <span className="font-mono text-xl text-yellow-400">${balance.toLocaleString()}</span>
             </div>
             <button 
                onClick={() => setIsCashierOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full border border-white/20 transition-colors"
             >
                <Wallet size={18} className="text-yellow-400" />
                <span className="text-sm font-bold md:hidden">${balance.toLocaleString()}</span>
                <Plus size={14} className="text-white/50" />
             </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative">
        {/* Felt Texture Overlay */}
        <div className="absolute inset-0 opacity-30 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/felt.png')]"></div>

        {/* Game Area */}
        <div className="flex-1 flex flex-col items-center justify-start pt-4 md:pt-8 relative z-10 w-full max-w-6xl mx-auto">
            
            {/* Table Info */}
            <div className="w-full flex justify-between px-6 mb-4 md:mb-8">
                <div className="flex flex-col items-center">
                    <h2 className="text-blue-400 font-serif text-2xl font-bold mb-1 drop-shadow-md">PLAYER</h2>
                    <div className="text-4xl font-mono font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {gameState !== GameState.IDLE && gameState !== GameState.BETTING ? calculateScore(playerHand) : '-'}
                    </div>
                </div>
                
                {/* Dealer/AI Chat Bubble */}
                <div className="flex-1 mx-4 md:mx-12 flex items-center justify-center">
                    <div className="bg-black/60 backdrop-blur border border-yellow-500/30 rounded-full px-6 py-2 flex items-center gap-3 shadow-xl max-w-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <p className="text-sm md:text-base text-white/90 italic text-center font-serif">"{commentary}"</p>
                    </div>
                </div>

                <div className="flex flex-col items-center">
                    <h2 className="text-red-500 font-serif text-2xl font-bold mb-1 drop-shadow-md">BANKER</h2>
                    <div className="text-4xl font-mono font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {gameState !== GameState.IDLE && gameState !== GameState.BETTING ? calculateScore(bankerHand) : '-'}
                    </div>
                </div>
            </div>

            {/* Cards Area */}
            <div className="flex justify-center gap-8 md:gap-24 w-full px-4 h-48">
                {/* Player Hand */}
                <div className="flex -space-x-12 md:-space-x-16">
                    {playerHand.map((card, i) => (
                        <div key={card.id} className={`transform transition-all duration-500 ease-out origin-bottom-left hover:-translate-y-2`} style={{ zIndex: i }}>
                            <CardComponent card={card} />
                        </div>
                    ))}
                    {playerHand.length === 0 && (
                         <div className="border-2 border-white/10 rounded-lg w-20 h-28 md:w-28 md:h-40 flex items-center justify-center text-white/10">
                            <span className="text-xs">PLAYER</span>
                         </div>
                    )}
                </div>

                {/* Banker Hand */}
                <div className="flex -space-x-12 md:-space-x-16">
                     {bankerHand.map((card, i) => (
                        <div key={card.id} className={`transform transition-all duration-500 ease-out origin-bottom-left hover:-translate-y-2`} style={{ zIndex: i }}>
                            <CardComponent card={card} />
                        </div>
                    ))}
                    {bankerHand.length === 0 && (
                         <div className="border-2 border-white/10 rounded-lg w-20 h-28 md:w-28 md:h-40 flex items-center justify-center text-white/10">
                            <span className="text-xs">BANKER</span>
                         </div>
                    )}
                </div>
            </div>

            {/* Betting Table */}
            <div className="w-full flex-1 flex flex-col justify-end pb-4">
                <BettingTable 
                    bets={currentBets} 
                    onPlaceBet={handlePlaceBet} 
                    disabled={gameState === GameState.DEALING || balance === 0} 
                />

                {/* Controls */}
                <div className="flex flex-col items-center gap-4 mt-4 px-4">
                    
                    {/* Chip Selector */}
                    <div className="flex gap-2 md:gap-4 bg-black/40 p-2 rounded-full backdrop-blur-sm border border-white/10">
                        {CHIP_VALUES.map(val => (
                            <button
                                key={val}
                                onClick={() => setSelectedChip(val)}
                                disabled={gameState === GameState.DEALING}
                                className={`
                                    w-10 h-10 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center font-bold text-xs shadow-lg transition-transform hover:scale-110
                                    ${selectedChip === val ? 'transform -translate-y-2 ring-2 ring-yellow-400' : ''}
                                    ${val < 25 ? 'bg-white text-black border-gray-300' : 
                                      val < 100 ? 'bg-red-600 text-white border-red-300' :
                                      val < 500 ? 'bg-green-600 text-white border-green-300' :
                                      val < 1000 ? 'bg-black text-white border-gray-600' :
                                      'bg-yellow-500 text-black border-yellow-200'
                                    }
                                `}
                            >
                                {val >= 1000 ? '1K' : val}
                            </button>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        {gameState === GameState.RESULT ? (
                             <button 
                                onClick={resetGame}
                                className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-full shadow-[0_0_20px_rgba(234,179,8,0.4)] uppercase tracking-widest transition-all hover:scale-105"
                            >
                                New Bet
                            </button>
                        ) : (
                            <>
                                <button 
                                    onClick={clearBets}
                                    disabled={gameState !== GameState.BETTING}
                                    className="px-6 py-3 bg-gray-700/50 hover:bg-gray-600 text-white rounded-full uppercase text-sm font-bold tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Clear
                                </button>
                                <button 
                                    onClick={dealGame}
                                    disabled={Object.values(currentBets).reduce((a, b) => a + b, 0) === 0 || gameState === GameState.DEALING}
                                    className="px-10 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-full shadow-[0_0_20px_rgba(34,197,94,0.4)] uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                                >
                                    Deal
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Bottom Panels (History & Stats) */}
        <div className="border-t border-white/10 bg-black/60 backdrop-blur-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4 h-auto md:h-64 z-20">
            
            {/* Bead Plate History */}
            <div className="md:col-span-2 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-white/70 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        <History size={12} /> History
                    </h3>
                    <div className="text-[10px] flex gap-3 text-white/50">
                         <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Player</span>
                         <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Banker</span>
                         <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Tie</span>
                    </div>
                </div>
                <div 
                    ref={historyRef}
                    className="flex-1 overflow-x-auto flex flex-col flex-wrap content-start gap-1 h-40 md:h-full p-2 bg-black/20 rounded-lg border border-white/5 scroll-smooth" 
                    style={{ maxHeight: '100%' }}
                >
                    {/* Rendering a simple Grid/Bead plate simulation */}
                    {history.map((h, i) => (
                        <div 
                            key={i} 
                            className={`
                                w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold border
                                ${h.winner === 'PLAYER' ? 'bg-blue-600 border-blue-400' : 
                                  h.winner === 'BANKER' ? 'bg-red-600 border-red-400' : 
                                  'bg-green-600 border-green-400'}
                                relative
                            `}
                        >
                            {h.winner === 'PLAYER' ? 'P' : h.winner === 'BANKER' ? 'B' : 'T'}
                            {h.isPlayerPair && <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-blue-200 rounded-full border border-blue-800"></div>}
                            {h.isBankerPair && <div className="absolute bottom-0 left-0 w-1.5 h-1.5 bg-red-200 rounded-full border border-red-800"></div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Stats & Chart Column */}
            <div className="h-full flex flex-col gap-2">
                {/* Stats Widget */}
                <div className="flex gap-2 h-16">
                    <div className="flex-1 bg-black/40 rounded-lg border border-white/10 flex flex-col items-center justify-center p-1">
                        <span className="text-[10px] uppercase text-white/50 tracking-widest flex items-center gap-1">
                           <Percent size={10} /> Win Rate
                        </span>
                        <span className={`text-lg font-mono font-bold ${winRate >= 50 ? 'text-green-400' : 'text-white'}`}>
                            {winRate.toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex-1 bg-black/40 rounded-lg border border-white/10 flex flex-col items-center justify-center p-1">
                        <span className="text-[10px] uppercase text-white/50 tracking-widest flex items-center gap-1">
                           <TrendingUp size={10} /> ROI
                        </span>
                        <span className={`text-lg font-mono font-bold ${roi >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {roi > 0 ? '+' : ''}{roi.toFixed(2)}%
                        </span>
                    </div>
                </div>

                {/* Chart */}
                <div className="flex-1 min-h-0">
                   <PnLChart data={pnlData} />
                </div>
            </div>

        </div>
      </main>
    </div>
  );
}
