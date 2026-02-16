import React from 'react';
import { User, Heart, Zap, Droplet } from "lucide-react";

// Mock navigate function for demo
import { useNavigate } from 'react-router-dom';

// ============================================
// GENERAL PURPOSE INDEX CARD FOLDER COMPONENT
// ============================================

export default function IndexCardFolder({ children, className = "" }) {

    return (
        <div className={`
            grid grid-cols-1  lg:grid-cols-3
            2xl:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]
            gap-6 p-6
            ${className}`}>
            {children}
        </div>
    );
}

IndexCardFolder.File = function IndexCardFile({ children, className = "", to, href, onClick }) {
    const navigate = useNavigate();
    const isClickable = to || href || onClick;

    const handleClick = (e) => {
        const clickedElement = e.target instanceof Element ? e.target : null;
        if (clickedElement?.closest("button, a, [data-card-ignore-click='true']")) {
            return;
        }

        if (onClick) {
            onClick();
        } else if (to) {
            navigate(to);
        } else if (href) {
            window.location.href = href;
        }
    };

    return (
        <div 
            className={`
                group relative
                aspect-[3/4]
                grid grid-rows-[20%-1fr-1fr]
                p-5 rounded-2xl
                bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900
                border-2 border-slate-700/50
                shadow-xl shadow-black/20
                overflow-hidden
                transition-all duration-300 ease-out
                ${isClickable ? 'cursor-pointer hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-500/50 hover:-translate-y-1' : ''} 
                ${className}
            `}
            onClick={isClickable ? handleClick : undefined}
        > 
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />
            
            {/* Animated border glow on hover */}
            {isClickable && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/0 via-purple-500/30 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl -z-10" />
            )}
            
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}

IndexCardFolder.File.Top = function FileTop({ children, className = "" }) {
    return (
        <div className={`row-start-1 mb-3 ${className}`}>
            {children}
        </div>
    );
}

IndexCardFolder.File.Middle = function FileMiddle({ children, className = "" }) {
    return (
        <div className={`row-start-2 ${className}`}>
            {children}
            <div className="relative mt-4 mb-3">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700/50" />
                </div>
                <div className="relative flex justify-center">
                    <div className="bg-gradient-to-r from-transparent via-purple-500/20 to-transparent h-px w-1/2" />
                </div>
            </div>
        </div>
    );
}

IndexCardFolder.File.Bottom = function FileBottom({ children, className = "" }) {
    return (
        <div className={`
            row-start-3 
            flex flex-col items-center justify-start
            overflow-y-auto
            scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent
            ${className}
        `}>
            {children}
        </div>
    );
}

IndexCardFolder.File.Image = function FileImage({ children, className = "", src, alt = "" }) {
    return (
        <div className={`
            relative overflow-hidden rounded-xl
            ring-2 ring-slate-700/50
            ${className}
        `}>
            {src ? (
                <img src={src} alt={alt} className="w-full h-full object-cover" />
            ) : (
                children
            )}
        </div>
    );
}

IndexCardFolder.File.Title = function FileTitle({ children, className = "" }) {
    return (
        <div className={`
            text-lg font-bold text-white
            mb-1
            ${className}
        `}>
            {children}
        </div>
    );
}

IndexCardFolder.File.Description = function FileDescription({ children, className = "" }) {
    return (
        <div className={`
            text-slate-400 text-sm leading-relaxed
            ${className}
        `}>
            {children}
        </div>
    );
}

IndexCardFolder.File.Actions = function FileAction({ children, className = "" }) {
    return (
        <div className={`
            flex gap-2 flex-wrap
            mt-3
            ${className}
        `}>
            {children}
        </div>
    );
}

IndexCardFolder.File.Detail = function FileDetail({ children, className = "" }) {
    return (
        <div className={`
            bg-slate-800/40 backdrop-blur-sm
            rounded-lg p-3
            border border-slate-700/30
            ${className}
        `}>
            {children}
        </div>
    );
}
