import React from 'react';
import { FiCheckCircle, FiCircle, FiLoader } from 'react-icons/fi';

const LoanTimeline = ({ status }) => {
    const steps = [
        { id: 'Pending', label: 'Created', color: '' },
        { id: 'Funded', label: 'Funded', },
        { id: 'Repaid', label: 'Repaid', }
    ];

    const currentStepIndex = steps.findIndex(s => s.id === status);

    return (
        <div className="relative flex justify-between items-center w-full py-4">
            {/* Background Line */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 -translate-y-1/2 z-0"></div>

            {/* Active Progress Line */}
            <div
                className="absolute top-1/2 left-0 h-0.5 0 0 -translate-y-1/2 z-0 transition-all duration-1000"
                style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
            ></div>

            {steps.map((step, index) => {
                const isActive = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                    <div key={step.id} className="relative z-10 flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isActive
                            ? 'bg-card-bg border-border0 text-brand-accent0 '
                            : 'bg-card-bg border-border text-text-primary'
                            }`}>
                            {isActive ? (
                                <FiCheckCircle />
                            ) : (
                                <FiCircle />
                            )}
                        </div>
                        <span className={`absolute -bottom-6 text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 whitespace-nowrap ${isActive ? 'text-text-primary' : 'text-text-secondary0'
                            }`}>
                            {step.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default LoanTimeline;
