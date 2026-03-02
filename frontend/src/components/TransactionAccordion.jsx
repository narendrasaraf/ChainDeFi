import React, { useState } from 'react';
import { FiChevronDown, FiExternalLink, FiHash } from 'react-icons/fi';

const TransactionAccordion = ({ txHash }) => {
 const [isOpen, setIsOpen] = useState(false);

 if (!txHash) return null;

 // Check if it's a full tx hash or a protocol ID
 const isHash = txHash.startsWith('0x');

 return (
 <div className="border border-border rounded-2xl overflow-hidden transition-all duration-300 hover:border-border">
 <button
 onClick={() => setIsOpen(!isOpen)}
 className="w-full flex items-center justify-between p-4 px-5 text-[9px] uppercase font-black tracking-[0.2em] text-text-primary hover:text-brand-accent0 transition-all active:"
 >
 <div className="flex items-center gap-2.5">
 <FiHash className={isOpen ? 'text-brand-accent0' : 'text-text-primary'} />
 <span>Protocol Proof</span>
 </div>
 <FiChevronDown className={`transition-transform duration-500 text-text-primary ${isOpen ? 'rotate-180 text-brand-accent0' : ''}`} />
 </button>

 <div className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
 <div className="p-5 pt-0">
 <div className="p-4 rounded-xl border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
 <span className="truncate font-mono text-[10px] text-text-secondary0 w-full sm:w-auto tracking-tighter sm:tracking-normal">{txHash}</span>
 {isHash && (
 <a
 href={`https://sepolia.etherscan.io/tx/${txHash}`}
 target="_blank"
 rel="noopener noreferrer"
 className="flex-shrink-0 flex items-center gap-1.5 text-[9px] text-brand-accent0 font-black hover:text-brand-accent transition-colors uppercase tracking-[0.1em] border-b border-border0/20 pb-0.5"
 >
 Explorer <FiExternalLink size={11} />
 </a>
 )}
 </div>
 </div>
 </div>
 </div>
 );
};

export default TransactionAccordion;
