import React, { useState, useEffect, useMemo } from 'react';
import DiceRollPopup from './DiceRollPopup';
import './DiceRollGallery.css';

/**
 * Shuffle array for randomization
 */
const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

/**
 * DiceRollGallery - Manages multiple concurrent dice rolls with navigation
 * 
 * Props:
 * - rolls: Array of roll data objects
 * - playerCharacterId: string (ID of the current player's character)
 * - onClose: function (called when all rolls have been viewed and closed)
 */
const DiceRollGallery = ({ rolls = [], playerCharacterId, onClose }) => {
    // Sort rolls: own first, then randomize others
    const sortedRolls = useMemo(() => {
        if (!rolls || rolls.length === 0) return [];
        
        const ownRolls = rolls.filter(roll => roll.characterId === playerCharacterId);
        const otherRolls = rolls.filter(roll => roll.characterId !== playerCharacterId);
        
        // Shuffle other rolls for variety
        const shuffledOthers = shuffleArray(otherRolls);
        
        return [...ownRolls, ...shuffledOthers];
    }, [rolls, playerCharacterId]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [viewedRolls, setViewedRolls] = useState(new Set());

    useEffect(() => {
        // Start with first roll (which is own roll if exists)
        if (sortedRolls.length > 0) {
            setCurrentIndex(0);
        }
    }, [sortedRolls]);

    useEffect(() => {
        // Mark current roll as viewed
        if (sortedRolls[currentIndex]) {
            setViewedRolls(prev => new Set([...prev, currentIndex]));
        }
    }, [currentIndex, sortedRolls]);

    if (!sortedRolls || sortedRolls.length === 0) return null;

    const currentRoll = sortedRolls[currentIndex];
    const isOwn = currentRoll?.characterId === playerCharacterId;
    const hasMultiple = sortedRolls.length > 1;

    const handleExit = () => {
        // Exit the entire gallery immediately
        if (onClose) {
            onClose();
        }
    };

    const handleContinue = () => {
        // Mark current roll as viewed first
        setViewedRolls(prev => new Set([...prev, currentIndex]));
        
        // Check if there are more rolls to view
        const updatedViewedRolls = new Set([...viewedRolls, currentIndex]);
        const remainingRolls = sortedRolls.filter((_, index) => !updatedViewedRolls.has(index));
        
        if (remainingRolls.length > 0) {
            // Move to next unviewed roll
            const nextUnviewedIndex = sortedRolls.findIndex((_, index) => !updatedViewedRolls.has(index));
            if (nextUnviewedIndex !== -1) {
                setCurrentIndex(nextUnviewedIndex);
            } else {
                // Fallback: move to next roll
                handleNext();
            }
        } else {
            // All rolls viewed - close the gallery
            console.log('All dice rolls viewed, closing gallery and sending acknowledgment');
            if (onClose) {
                onClose();
            }
        }
    };

    const handleNext = () => {
        if (currentIndex < sortedRolls.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setCurrentIndex(0);
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        } else {
            setCurrentIndex(sortedRolls.length - 1);
        }
    };

    const handleSelectRoll = (index) => {
        setCurrentIndex(index);
    };

    return (
        <div className="dice-roll-gallery">
            <DiceRollPopup
                rollData={currentRoll}
                isOwn={isOwn}
                onClose={handleContinue}
                onExit={handleExit}
            />

            {hasMultiple && (
                <div className="gallery-controls">
                    {/* Navigation Arrows */}
                    <button 
                        className="gallery-nav prev"
                        onClick={handlePrevious}
                        aria-label="Previous roll"
                    >
                        ‹
                    </button>

                    {/* Roll Indicators */}
                    <div className="roll-indicators">
                        {sortedRolls.map((roll, index) => {
                            const isOwnRoll = roll.characterId === playerCharacterId;
                            const isActive = index === currentIndex;
                            const isViewed = viewedRolls.has(index);
                            
                            return (
                                <button
                                    key={index}
                                    className={`roll-indicator ${isActive ? 'active' : ''} ${isOwnRoll ? 'own' : ''} ${isViewed ? 'viewed' : ''}`}
                                    onClick={() => handleSelectRoll(index)}
                                    title={roll.characterName}
                                    aria-label={`View ${roll.characterName}'s roll`}
                                >
                                    <span className="indicator-dot"></span>
                                    <span className="indicator-label">{roll.characterName}</span>
                                </button>
                            );
                        })}
                    </div>

                    <button 
                        className="gallery-nav next"
                        onClick={handleNext}
                        aria-label="Next roll"
                    >
                        ›
                    </button>

                    {/* Counter */}
                    <div className="roll-counter">
                        {currentIndex + 1} / {sortedRolls.length}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DiceRollGallery;
