import React, { useState, useEffect } from 'react';
import './ActionSelector.css';

/**
 * ActionSelector - UI component for selecting and confirming actions in combat
 * 
 * Props:
 * - character: object (current character data)
 * - availableActions: array of action objects
 * - isYourTurn: boolean
 * - onActionSelect: function(action)
 * - onActionConfirm: function(action, target)
 * - onActionCancel: function()
 * - selectedAction: object (currently staged action)
 */
const ActionSelector = ({
    character,
    availableActions = [],
    isYourTurn = false,
    onActionSelect,
    onActionConfirm,
    onActionCancel,
    selectedAction = null
}) => {
    const [activeTab, setActiveTab] = useState('main');
    const [targetSelection, setTargetSelection] = useState(null);
    const [showConfirmation, setShowConfirmation] = useState(false);

    useEffect(() => {
        if (!isYourTurn) {
            setShowConfirmation(false);
            setTargetSelection(null);
        }
    }, [isYourTurn]);

    if (!isYourTurn) {
        return (
            <div className="action-selector disabled">
                <div className="waiting-message">
                    <h3>Waiting for your turn...</h3>
                    <p>Prepare your action while others play</p>
                </div>
            </div>
        );
    }

    // Group actions by category
    const actionsByCategory = {
        main: availableActions.filter(a => a.category === 'main' || a.type === 'attack' || a.type === 'cast'),
        movement: availableActions.filter(a => a.category === 'movement' || a.type === 'move'),
        bonus: availableActions.filter(a => a.category === 'bonus'),
        reaction: availableActions.filter(a => a.category === 'reaction'),
        other: availableActions.filter(a => !a.category || a.category === 'other')
    };

    const handleActionClick = (action) => {
        if (selectedAction?.id === action.id) {
            // Deselect
            if (onActionCancel) onActionCancel();
            setShowConfirmation(false);
            setTargetSelection(null);
        } else {
            // Select action
            if (onActionSelect) onActionSelect(action);
            
            // If action requires target, don't show confirmation yet
            if (action.requiresTarget) {
                setShowConfirmation(false);
                // Target selection will happen in the game view
            } else {
                setShowConfirmation(true);
            }
        }
    };

    const handleConfirm = () => {
        if (selectedAction && onActionConfirm) {
            onActionConfirm(selectedAction, targetSelection);
            setShowConfirmation(false);
            setTargetSelection(null);
        }
    };

    const handleCancel = () => {
        if (onActionCancel) onActionCancel();
        setShowConfirmation(false);
        setTargetSelection(null);
    };

    const renderAction = (action) => {
        const isSelected = selectedAction?.id === action.id;
        const isDisabled = action.disabled || !action.available;

        return (
            <button
                key={action.id}
                className={`action-button ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && handleActionClick(action)}
                disabled={isDisabled}
                title={action.description}
            >
                <div className="action-icon">
                    {action.icon || getDefaultIcon(action.type)}
                </div>
                <div className="action-info">
                    <div className="action-name">{action.name}</div>
                    {action.cost && (
                        <div className="action-cost">{action.cost}</div>
                    )}
                </div>
                {action.requiresTarget && (
                    <div className="requires-target-badge">⊕</div>
                )}
            </button>
        );
    };

    const getDefaultIcon = (type) => {
        const icons = {
            attack: '⚔️',
            cast: '✨',
            move: '🏃',
            dash: '💨',
            dodge: '🛡️',
            help: '🤝',
            hide: '👤',
            search: '🔍',
            use: '📦',
            disengage: '↩️',
            ready: '⌛'
        };
        return icons[type] || '⚙️';
    };

    return (
        <div className="action-selector">
            {/* Header */}
            <div className="action-selector-header">
                <h3>Your Turn - {character?.name || 'Character'}</h3>
                {selectedAction && (
                    <span className="selected-indicator">
                        Action Selected: {selectedAction.name}
                    </span>
                )}
            </div>

            {/* Tabs */}
            <div className="action-tabs">
                <button
                    className={`tab ${activeTab === 'main' ? 'active' : ''}`}
                    onClick={() => setActiveTab('main')}
                >
                    Main Actions ({actionsByCategory.main.length})
                </button>
                <button
                    className={`tab ${activeTab === 'movement' ? 'active' : ''}`}
                    onClick={() => setActiveTab('movement')}
                >
                    Movement ({actionsByCategory.movement.length})
                </button>
                <button
                    className={`tab ${activeTab === 'bonus' ? 'active' : ''}`}
                    onClick={() => setActiveTab('bonus')}
                >
                    Bonus ({actionsByCategory.bonus.length})
                </button>
                <button
                    className={`tab ${activeTab === 'other' ? 'active' : ''}`}
                    onClick={() => setActiveTab('other')}
                >
                    Other ({actionsByCategory.other.length})
                </button>
            </div>

            {/* Actions List */}
            <div className="actions-list">
                {actionsByCategory[activeTab].length > 0 ? (
                    actionsByCategory[activeTab].map(action => renderAction(action))
                ) : (
                    <div className="no-actions">
                        No {activeTab} actions available
                    </div>
                )}
            </div>

            {/* Confirmation Panel */}
            {showConfirmation && selectedAction && (
                <div className="confirmation-panel">
                    <div className="confirmation-content">
                        <h4>Confirm Action</h4>
                        <div className="action-details">
                            <p><strong>{selectedAction.name}</strong></p>
                            <p className="action-description">{selectedAction.description}</p>
                            {selectedAction.requiresTarget && targetSelection && (
                                <p>Target: {targetSelection.name || 'Selected'}</p>
                            )}
                        </div>
                        <div className="confirmation-buttons">
                            <button 
                                className="btn-confirm"
                                onClick={handleConfirm}
                                disabled={selectedAction.requiresTarget && !targetSelection}
                            >
                                ✓ Confirm Action
                            </button>
                            <button 
                                className="btn-cancel"
                                onClick={handleCancel}
                            >
                                ✗ Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActionSelector;
