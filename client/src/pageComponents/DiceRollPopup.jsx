import React, { useState, useEffect } from 'react';
import './DiceRollPopup.css';

/**
 * DiceRollPopup - A popup component that displays dice rolling animations and results
 * 
 * Props:
 * - rollData: {
 *     characterName: string,
 *     characterId: string,
 *     description: string (e.g., "Initiative Roll", "Attack Roll"),
 *     dice: [{ type: "d20", value: 18 }, { type: "d6", value: 4 }],
 *     bonuses: [{ name: "Dexterity Modifier", value: 3 }, { name: "Inspiration", value: 2 }],
 *     total: number,
 *     timestamp: number
 *   }
 * - isOwn: boolean (whether this is the current player's roll)
 * - onClose: function
 * - onExit: function (exit entire gallery)
 */
const DiceRollPopup = ({ rollData, isOwn = false, onClose, onExit }) => {
    const [isRolling, setIsRolling] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [autoRoll, setAutoRoll] = useState(() => {
        // Load auto-roll setting from localStorage
        const saved = localStorage.getItem('diceAutoRoll');
        return saved !== null ? saved === 'true' : true;
    });

    useEffect(() => {
        // Auto-roll if setting is enabled
        if (autoRoll) {
            setIsRolling(true);
            const rollingTimer = setTimeout(() => {
                setIsRolling(false);
                setShowResults(true);
            }, 2000);
            return () => clearTimeout(rollingTimer);
        }
    }, [autoRoll]);

    const handleRollClick = () => {
        if (!isRolling && !showResults) {
            setIsRolling(true);
            setTimeout(() => {
                setIsRolling(false);
                setShowResults(true);
            }, 2000);
        }
    };

    const toggleAutoRoll = () => {
        const newValue = !autoRoll;
        setAutoRoll(newValue);
        localStorage.setItem('diceAutoRoll', String(newValue));
    };

    if (!rollData) return null;

    const { characterName, description, dice = [], bonuses = [], total } = rollData;

    // Calculate dice total (before bonuses)
    const diceTotal = dice.reduce((sum, die) => sum + die.value, 0);
    const bonusTotal = bonuses.reduce((sum, bonus) => sum + bonus.value, 0);

    return (
        <div className={`dice-popup-overlay ${isOwn ? 'own-roll' : 'other-roll'}`}>
            <div className="dice-popup-container">
                {/* Exit Button */}
                <button className="exit-button" onClick={onExit} title="Close dice rolls">
                    ✕
                </button>

                {/* Settings Button */}
                <button 
                    className={`settings-button ${autoRoll ? 'auto' : 'manual'}`}
                    onClick={toggleAutoRoll}
                    title={autoRoll ? 'Auto-roll enabled (click to disable)' : 'Manual roll (click to enable auto-roll)'}
                >
                    {autoRoll ? '⚡' : '👆'}
                </button>

                {/* Header */}
                <div className="dice-popup-header">
                    <h2>{characterName}</h2>
                    <p className="roll-description">{description}</p>
                </div>

                {/* Dice Display */}
                <div className="dice-display-area">
                    {!isRolling && !showResults && !autoRoll && (
                        <div className="click-to-roll-hint">
                            Click a die to roll!
                        </div>
                    )}
                    {dice.map((die, index) => {
                        // Handle both 'type' (e.g., "d20") and 'sides' (e.g., 20) formats
                        const diceType = die.type || (die.sides ? `d${die.sides}` : 'd20');
                        const sides = parseInt(diceType.replace('d', ''));
                        return (
                            <div
                                key={index}
                                className={`dice ${diceType} ${isRolling ? 'rolling' : 'stopped'} ${!autoRoll && !isRolling && !showResults ? 'clickable' : ''}`}
                                onClick={!autoRoll ? handleRollClick : undefined}
                            >
                                <div className={`dice-face dice-shape-${sides}`}>
                                    {showResults ? die.value : '?'}
                                </div>
                                <div className="dice-label">{diceType.toUpperCase()}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Results Section */}
                {showResults && (
                    <div className="results-section">
                        {/* Dice Breakdown */}
                        <div className="dice-breakdown">
                            <span className="breakdown-label">Dice Roll:</span>
                            <div className="breakdown-values">
                                {dice.map((die, index) => (
                                    <span key={index} className="dice-value">
                                        {die.value}
                                        {index < dice.length - 1 && ' + '}
                                    </span>
                                ))}
                                <span className="breakdown-total">= {diceTotal}</span>
                            </div>
                        </div>

                        {/* Bonuses */}
                        {bonuses.length > 0 && (
                            <div className="bonuses-section">
                                <span className="breakdown-label">Bonuses:</span>
                                <div className="bonus-list">
                                    {bonuses.map((bonus, index) => (
                                        <div key={index} className="bonus-item">
                                            <span className="bonus-name">{bonus.name}</span>
                                            <span className="bonus-value">
                                                {bonus.value >= 0 ? '+' : ''}{bonus.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Final Total */}
                        <div className="final-total">
                            <span className="total-label">Total:</span>
                            <span className="total-value">{total}</span>
                        </div>
                    </div>
                )}

                {/* Close Button - Only show after results are revealed */}
                {showResults && (
                    <button className="close-button" onClick={onClose}>
                        Continue
                    </button>
                )}
            </div>
        </div>
    );
};

export default DiceRollPopup;
