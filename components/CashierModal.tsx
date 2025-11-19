import React, { useState, useEffect } from 'react';
import { X, Wallet, ArrowRight, ArrowLeft } from 'lucide-react';

interface CashierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
  currentBalance: number;
}

export const CashierModal: React.FC<CashierModalProps> = ({ 
  isOpen, 
  onClose, 
  onDeposit, 
  onWithdraw, 
  currentBalance 
}) => {
  const [activeTab, setActiveTab] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [amount, setAmount] = useState<string>('');

  useEffect(() => {
    if (isOpen) setAmount('');
  }, [isOpen]);

  if (!isOpen) return null;

  const quickAmounts = [100, 500, 1000, 5000, 10000];

  const handleConfirm = () => {
    const val = parseInt(amount.replace(/,/g, ''));
    if (isNaN(val) || val <= 0) return;
    
    if (activeTab === 'DEPOSIT') {
      onDeposit(val);
    } else {
      if (val > currentBalance) return;
      onWithdraw(val);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#0f2015] w-full max-w-md rounded-2xl border border-yellow-500/30 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-black/40 p-4 flex justify-between items-center border-b border-white/10">
          <div className="flex items-center gap-2 text-yellow-400">
            <Wallet size={24} />
            <h2 className="font-serif text-xl font-bold tracking-wide">CASHIER</h2>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button 
            onClick={() => setActiveTab('DEPOSIT')}
            className={`flex-1 py-4 text-sm font-bold tracking-wider transition-colors flex items-center justify-center gap-2
              ${activeTab === 'DEPOSIT' ? 'bg-green-900/30 text-green-400 border-b-2 border-green-500' : 'text-white/40 hover:bg-white/5'}
            `}
          >
            <ArrowLeft size={16} /> DEPOSIT
          </button>
          <button 
            onClick={() => setActiveTab('WITHDRAW')}
            className={`flex-1 py-4 text-sm font-bold tracking-wider transition-colors flex items-center justify-center gap-2
              ${activeTab === 'WITHDRAW' ? 'bg-red-900/30 text-red-400 border-b-2 border-red-500' : 'text-white/40 hover:bg-white/5'}
            `}
          >
            WITHDRAW <ArrowRight size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-6">
           <div className="flex justify-between items-end">
              <label className="text-xs uppercase text-white/50 font-bold tracking-widest">
                {activeTab === 'DEPOSIT' ? 'Deposit Amount' : 'Withdraw Amount'}
              </label>
              <span className="text-xs text-white/50">Balance: <span className="text-white font-mono">${currentBalance.toLocaleString()}</span></span>
           </div>

           <div className="relative">
             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-white/30">$</span>
             <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-black/30 border border-white/10 rounded-xl py-4 pl-10 pr-4 text-2xl font-mono text-white focus:outline-none focus:border-yellow-500/50 transition-colors placeholder-white/10"
                autoFocus
             />
           </div>

           {/* Quick Select */}
           <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map(amt => (
                <button 
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className="py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 text-xs font-mono text-yellow-400/80 transition-colors"
                >
                  +${amt.toLocaleString()}
                </button>
              ))}
           </div>

           {/* Action Button */}
           <button 
             onClick={handleConfirm}
             disabled={!amount || parseInt(amount) <= 0 || (activeTab === 'WITHDRAW' && parseInt(amount) > currentBalance)}
             className={`
               w-full py-4 rounded-xl font-bold text-black uppercase tracking-widest shadow-lg transition-all transform active:scale-95
               ${activeTab === 'DEPOSIT' 
                 ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-green-900/20' 
                 : 'bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500 shadow-red-900/20'
               }
               disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
             `}
           >
             {activeTab === 'DEPOSIT' ? 'Confirm Deposit' : 'Confirm Withdraw'}
           </button>

           {activeTab === 'WITHDRAW' && parseInt(amount) > currentBalance && (
             <p className="text-red-500 text-xs text-center -mt-2">Insufficient funds available.</p>
           )}
        </div>

      </div>
    </div>
  );
};