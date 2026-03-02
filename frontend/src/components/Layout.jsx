import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { FiMenu, FiX } from 'react-icons/fi';

const Layout = ({ children }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

    return (
        <div className="flex min-h-screen bg-bg-primary font-sans text-text-secondary antialiased relative">
            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card-bg border-b border-border z-40 flex items-center justify-between px-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                        <span className="text-text-primary font-black italic text-xs">A</span>
                    </div>
                    <span className="text-sm font-black text-text-primary tracking-widest uppercase">PanCred</span>
                </div>
                <button
                    onClick={toggleMobileMenu}
                    className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                >
                    {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
                </button>
            </header>

            {/* Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-card-bg z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar — fixed on all screen sizes */}
            <div className={`
 fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
 `}>
                <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
            </div>

            {/* Main Content — offset by sidebar width on desktop */}
            <main className="flex-1 w-full pt-16 lg:pt-0 lg:ml-60 overflow-x-hidden">
                <div className="global-container py-8 lg:py-12">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
