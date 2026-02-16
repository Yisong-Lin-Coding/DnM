import React, { useMemo } from 'react';
import { Card } from '../../../pageComponents/card';
import { CircleUser } from 'lucide-react';
import { useGameData } from '../../../data/gameDataContext';
import {
    toTitleCase,
    startingPacks,
    isStartingPack,
    isAnyItem,
    addItemsToInventory,
    toolLists,
    languages,
    getAnyItemOptions
} from '../utils/inventory';

export function Background({ values, onChange, backgrounds = [], items = [], classes = [] }) {
    // Get game data from context (items, maps, selectors)
    const { maps } = useGameData();

    const selected = values?.background || '';
    const emit = (partial) => { if (typeof onChange === 'function') onChange(partial); };

    // Memoize the selected background object
    const selectedBackground = useMemo(() => {
        return backgrounds.find(b => b._id === selected);
    }, [backgrounds, selected]);

    const selectedClass = useMemo(() => {
        return classes?.find(c => c._id === values?.class);
    }, [classes, values?.class]);

    // Import tool and language lists from shared utilities
    const { musicalInstruments, artisansTools, gamingSets } = toolLists;

    // Helper: Check if an option is "any"
    const isAnyOption = (option) => {
        return option && option.toLowerCase().includes('any');
    };

    // Helper: Get dropdown options based on "any" type
    const getAnyOptions = (option) => {
        const lowerOption = option.toLowerCase();
        // First check if it matches weapon/tool patterns from shared utility
        const itemOptions = getAnyItemOptions(option);
        if (itemOptions && itemOptions.length > 0) {
            return itemOptions;
        }
        // Otherwise check for language (special case for backgrounds)
        if (lowerOption === 'any') {
            return languages;
        }
        return [];
    };

    // Note: All inventory helper functions (toTitleCase, isStartingPack, isAnyItem, 
    // addItemsToInventory) are now imported from the shared utility module above

    // 2. Logic: Handle Background Selection & Auto-populate
    const handleBackgroundChange = (backgroundId) => {
        const fullBackgroundData = backgrounds.find(b => b._id === backgroundId);
        if (!fullBackgroundData) return;

        // Parse base equipment items
        const fixedItems = (fullBackgroundData.baseEquipment || []).map(itemStr => {
            // Handle format: itemName or itemName:quantity
            const parts = itemStr.split(':');
            const name = parts[0];
            const qty = parts[1] ? parseInt(parts[1]) : 1;
            return { itemId: name, quantity: qty };
        });

        const applyUpdate = (inventoryMap) => {
            const currentItems = { ...(values.inv?.items || {}) };
            const itemIdsToRemove = [
                ...(values.backgroundBaseItemIds || []),
                ...Object.values(values.backgroundEquipmentChoices || {}).flatMap(choice => choice?.addedIds || []),
                ...Object.values(values.backgroundAnyItemSelections || {}).map(selection => selection?.uniqueId).filter(Boolean),
            ];
            itemIdsToRemove.forEach((id) => {
                if (currentItems[id]) delete currentItems[id];
            });
            const updatedItems = { ...currentItems, ...inventoryMap };

            // Convert proficiency selections to map and replace previous background contributions.
            const proficienciesMap = { ...values.skills?.proficiencies || {} };
            const previousBackgroundBase = values.backgroundBaseProficiencies || [];
            const previousChoiceSelections = Object.values(values.proficiencyChoices || {});

            [...previousBackgroundBase, ...previousChoiceSelections].forEach((prof) => {
                delete proficienciesMap[prof];
            });

            const nextBackgroundBase = fullBackgroundData.baseProficiencies || [];
            nextBackgroundBase.forEach((prof) => {
                proficienciesMap[prof] = 'proficient';
            });

            const previousBackgroundGp = Number(values.backgroundBaseGp || 0);
            const currentGp = Number(values.inv?.gp || 0);
            const nextBackgroundGp = Number(fullBackgroundData.gp || 0);
            const normalizedGp = Math.max(0, currentGp - previousBackgroundGp + nextBackgroundGp);

            const update = {
                background: backgroundId,
                // Replace prior background gold/items/proficiencies contribution.
                inv: { 
                    gp: normalizedGp,
                    items: updatedItems,
                    equipment: values.inv?.equipment || {}
                },
                // Update proficiencies
                skills: {
                    ...values.skills,
                    proficiencies: proficienciesMap
                },
                backgroundBaseGp: nextBackgroundGp,
                backgroundBaseItemIds: Object.keys(inventoryMap),
                backgroundBaseProficiencies: nextBackgroundBase,
                // Reset choices
                proficiencyChoices: {},
                backgroundEquipmentChoices: {},
                backgroundAnyItemSelections: {}
            };

            emit(update);
        };

        // Convert items to inventory format using context-provided items map
        if (fixedItems.length > 0) {
            const inventoryMap = addItemsToInventory(fixedItems, { itemsByItemId: maps.itemsByItemId });
            applyUpdate(inventoryMap);
        } else {
            applyUpdate({});
        }
    };

    // 3. Logic: Handle Skill/Language/Tool Choice Toggles
    const handleProficiencyToggle = (category, option) => {
        // Special handling for tools which might be under proficiencies
        const choiceData = selectedBackground?.choices?.proficiencies?.[category];
        if (!choiceData) return;

        const currentProficiencies = values.skills?.proficiencies || {};
        const choiceKey = `${category}_${option}`;
        const currentChoices = values.proficiencyChoices || {};
        const maxAllowed = choiceData.amount;
        
        // Count how many from this category are chosen
        const categoryChoices = Object.keys(currentChoices).filter(key => 
            key.startsWith(`${category}_`)
        );
        const currentCount = categoryChoices.length;

        // Create new proficiencies and choices
        const newProficiencies = { ...currentProficiencies };
        const newChoices = { ...currentChoices };

        if (newChoices[choiceKey]) {
            // Remove the choice
            delete newChoices[choiceKey];
            delete newProficiencies[option];
        } else {
            // Add the choice if limit not reached
            if (currentCount < maxAllowed) {
                newChoices[choiceKey] = option;
                newProficiencies[option] = 'proficient';
            } else {
                return; // Limit reached
            }
        }

        emit({
            skills: {
                ...values.skills,
                proficiencies: newProficiencies
            },
            proficiencyChoices: newChoices
        });
    };

    // 3b. Logic: Handle "Any" Proficiency Selection (Dropdown)
    const handleAnyProficiencySelection = (category, anyOption, slotIndex, selectedValue) => {
        if (!selectedValue) return;

        const currentProficiencies = values.skills?.proficiencies || {};
        const choiceKey = `${category}_${anyOption}_${slotIndex}`;
        const currentChoices = values.proficiencyChoices || {};
        
        // Remove previous selection if exists
        if (currentChoices[choiceKey]) {
            const previousValue = currentChoices[choiceKey];
            delete currentProficiencies[previousValue];
        }

        // Add new selection
        const newProficiencies = { ...currentProficiencies, [selectedValue]: 'proficient' };
        const newChoices = { ...currentChoices, [choiceKey]: selectedValue };

        emit({
            skills: {
                ...values.skills,
                proficiencies: newProficiencies
            },
            proficiencyChoices: newChoices
        });
    };

    // 4. Logic: Handle Equipment Choice Selection
    const handleEquipmentChoice = (choiceKey, optionKey, items) => {
        if (!selectedBackground?.choices?.equipment?.[choiceKey]?.[optionKey]) return;

        const currentItems = { ...(values.inv?.items || {}) };
        const previousChoices = values.backgroundEquipmentChoices || {};
        const previousChoice = previousChoices[choiceKey];
        const previousOptionKey = previousChoice?.optionKey;
        if (previousOptionKey === optionKey) return;

        const nextAnySelections = { ...(values.backgroundAnyItemSelections || {}) };

        if (previousChoice) {
            (previousChoice.addedIds || []).forEach((id) => {
                if (currentItems[id]) delete currentItems[id];
            });

            Object.keys(nextAnySelections).forEach((key) => {
                if (!key.startsWith(`${choiceKey}_${previousOptionKey}_`)) return;
                const uniqueId = nextAnySelections[key]?.uniqueId;
                if (uniqueId && currentItems[uniqueId]) delete currentItems[uniqueId];
                delete nextAnySelections[key];
            });
        }

        const itemsToAdd = [];
        Object.entries(items).forEach(([name, qty]) => {
            if (isAnyItem(name)) return;

            if (isStartingPack(name)) {
                itemsToAdd.push({ itemId: name, quantity: qty });
                const packContents = startingPacks[name].items;
                packContents.forEach((itemStr) => {
                    const parts = itemStr.split(':');
                    const itemName = parts[0];
                    const itemQty = parseInt(parts[1], 10) || 1;
                    itemsToAdd.push({ itemId: itemName, quantity: itemQty * qty });
                });
                return;
            }

            itemsToAdd.push({ itemId: name, quantity: qty });
        });

        const newInventoryItems = addItemsToInventory(itemsToAdd, { itemsByItemId: maps.itemsByItemId });
        const addedIds = Object.keys(newInventoryItems);
        const updatedItems = { ...currentItems, ...newInventoryItems };

        emit({
            backgroundEquipmentChoices: {
                ...previousChoices,
                [choiceKey]: { optionKey, items, addedIds }
            },
            backgroundAnyItemSelections: nextAnySelections,
            inv: {
                ...values.inv,
                items: updatedItems
            }
        });
    };

    // 4b. Logic: Handle "Any" Item Selection (Dropdown)
    const handleAnyItemSelection = (choiceKey, optionKey, anyItemKey, selectedItem) => {
        if (!selectedItem) return;

        const choiceItems = selectedBackground?.choices?.equipment?.[choiceKey]?.[optionKey];
        if (!choiceItems) return;

        const currentItems = { ...(values.inv?.items || {}) };
        const nextAnySelections = { ...(values.backgroundAnyItemSelections || {}) };
        const nextChoices = { ...(values.backgroundEquipmentChoices || {}) };
        const previousChoice = nextChoices[choiceKey];
        const previousOptionKey = previousChoice?.optionKey;
        const isSwitching = Boolean(previousChoice) && previousOptionKey !== optionKey;

        if (isSwitching) {
            (previousChoice.addedIds || []).forEach((id) => {
                if (currentItems[id]) delete currentItems[id];
            });

            Object.keys(nextAnySelections).forEach((key) => {
                if (!key.startsWith(`${choiceKey}_${previousOptionKey}_`)) return;
                const uniqueId = nextAnySelections[key]?.uniqueId;
                if (uniqueId && currentItems[uniqueId]) delete currentItems[uniqueId];
                delete nextAnySelections[key];
            });
        }

        if (!previousChoice || isSwitching) {
            const itemsToAdd = [];
            Object.entries(choiceItems).forEach(([name, qty]) => {
                if (isAnyItem(name)) return;

                if (isStartingPack(name)) {
                    itemsToAdd.push({ itemId: name, quantity: qty });
                    const packContents = startingPacks[name].items;
                    packContents.forEach((itemStr) => {
                        const parts = itemStr.split(':');
                        const itemName = parts[0];
                        const itemQty = parseInt(parts[1], 10) || 1;
                        itemsToAdd.push({ itemId: itemName, quantity: itemQty * qty });
                    });
                    return;
                }

                itemsToAdd.push({ itemId: name, quantity: qty });
            });

            const fixedInventoryItems = addItemsToInventory(itemsToAdd, { itemsByItemId: maps.itemsByItemId });
            const addedIds = Object.keys(fixedInventoryItems);
            Object.assign(currentItems, fixedInventoryItems);
            nextChoices[choiceKey] = { optionKey, items: choiceItems, addedIds };
        }

        const selectionKey = `${choiceKey}_${optionKey}_${anyItemKey}`;
        const previousSelection = nextAnySelections[selectionKey];
        if (previousSelection?.uniqueId && currentItems[previousSelection.uniqueId]) {
            delete currentItems[previousSelection.uniqueId];
        }

        const quantity = Number(choiceItems[anyItemKey] || 1);
        const selectedInventoryItems = addItemsToInventory([{ itemId: selectedItem, quantity }], { itemsByItemId: maps.itemsByItemId });
        const uniqueIds = Object.keys(selectedInventoryItems);
        Object.assign(currentItems, selectedInventoryItems);

        nextAnySelections[selectionKey] = {
            itemId: selectedItem,
            uniqueId: uniqueIds[0]
        };

        emit({
            backgroundEquipmentChoices: nextChoices,
            backgroundAnyItemSelections: nextAnySelections,
            inv: {
                ...values.inv,
                items: currentItems
            }
        });
    };

    return (
        <div className='bg-website-default-900 min-h-screen grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr]'>
            <div className='p-4 space-y-4 md:col-start-2'>

                {/* Name Input */}
                <div className='flex flex-col sm:flex-row sm:items-center p-4 gap-3 sm:gap-4 border-b border-website-specials-500'>
                    <CircleUser size={48} />
                    <div className='flex flex-col'>
                        <div className='text-left text-l font-semibold'>Character Name</div>
                        <input
                            type="text"
                            placeholder='Name...'
                            className='border-b border-website-highlights-400 bg-website-default-900 focus:outline-none focus:bg-gradient-to-t from-website-highlights-500 to-website-default-900'
                            value={values.name || ''}
                            onChange={(e) => emit({ name: e.target.value })}
                        />
                    </div>
                </div>

                <div className='space-y-8 flex flex-col text-left'>
                    <div>
                        <h1 className="text-2xl font-semibold mb-4 text-white">Choose Background</h1>

                        <div className="grid grid-cols-1 gap-6">
                            {/* Background Selector */}
                            <Card className='bg-website-default-800 border-website-specials-500'>
                                <Card.Header>
                                    <Card.Title className='text-website-default-100'>Background</Card.Title>
                                    <Card.Description className='text-website-default-300'>Select your character's background.</Card.Description>
                                </Card.Header>
                                <Card.Content>
                                    <div className='flex flex-col'>
                                        <select
                                            className='rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 text-white focus:outline-none'
                                            value={selected}
                                            onChange={(e) => handleBackgroundChange(e.target.value)}
                                        >
                                            <option value='' disabled>Select background</option>
                                            {backgrounds.map(b => (
                                                <option key={b._id} value={b._id}>{b.name}</option>
                                            ))}
                                        </select>
                                        {selectedBackground && (
                                            <div className='mt-4 p-4 border border-website-specials-500 rounded bg-website-default-900/50'>
                                                <div className='text-website-default-300 text-sm'>
                                                    {selectedBackground.description}
                                                </div>
                                                <div className='mt-3 pt-3 border-t border-website-default-700'>
                                                    <span className='text-website-highlights-400 font-semibold'>Starting Gold: </span>
                                                    <span className='text-white'>{selectedBackground.gp} gp</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card.Content>
                            </Card>

                            {selectedBackground && (
                                <>
                                    {/* Features Card */}
                                    {selectedBackground.features && Object.keys(selectedBackground.features).length > 0 && (
                                        <Card className='bg-website-default-800 border-website-specials-500'>
                                            <Card.Header className="border-b border-website-default-700 pb-4">
                                                <Card.Title className='text-website-default-100'>✨ Background Features</Card.Title>
                                            </Card.Header>
                                            <Card.Content className="pt-6 space-y-4">
                                                {Object.entries(selectedBackground.features).map(([featureName, descriptions]) => (
                                                    <div key={featureName} className="bg-website-default-900/50 p-4 rounded-lg border border-website-default-700">
                                                        <h4 className="text-website-highlights-400 text-sm font-semibold mb-2 capitalize">
                                                            {toTitleCase(featureName)}
                                                        </h4>
                                                        <ul className="space-y-2">
                                                            {descriptions.map((desc, idx) => (
                                                                <li key={idx} className="text-website-default-200 text-sm flex gap-2">
                                                                    <span className="text-website-specials-400">•</span>
                                                                    <span>{desc}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </Card.Content>
                                        </Card>
                                    )}

                                    {/* Proficiencies Card */}
                                    <Card className='bg-website-default-800 border-website-specials-500'>
                                        <Card.Header className="border-b border-website-default-700/50">
                                            <Card.Title className='text-website-default-100'>🎯 Proficiencies</Card.Title>
                                        </Card.Header>
                                        <Card.Content className="pt-6 space-y-4">
                                            {/* Base Proficiencies */}
                                            {selectedBackground.baseProficiencies && selectedBackground.baseProficiencies.length > 0 && (
                                                <div className="bg-website-default-900/60 p-3 rounded-lg border border-website-default-700">
                                                    <h4 className="text-website-highlights-400 text-[10px] uppercase mb-2">Base Proficiencies</h4>
                                                    <div className="flex flex-wrap gap-1">
                                                        {selectedBackground.baseProficiencies.map(prof => (
                                                            <span key={prof} className="px-2 py-0.5 bg-website-default-700 text-white text-[10px] rounded border border-website-default-600">
                                                                {toTitleCase(prof)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Proficiency Choices */}
                                            {selectedBackground.choices?.proficiencies && Object.entries(selectedBackground.choices.proficiencies)
                                                .filter(([category]) => category !== 'tools') // Filter out tools from proficiencies
                                                .map(([category, choiceData]) => (
                                                <div key={category} className="bg-website-specials-900/20 border border-website-specials-700/30 p-3 rounded-lg">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h4 className="text-website-specials-400 text-[10px] uppercase capitalize">
                                                            {category} Choices
                                                        </h4>
                                                        <span className="text-[10px] text-white bg-website-specials-600 px-2 py-0.5 rounded-full">
                                                            Picked {Object.keys(values.proficiencyChoices || {}).filter(k => k.startsWith(`${category}_`)).length} / {choiceData.amount}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {choiceData.options.map((option) => {
                                                            const choiceKey = `${category}_${option}`;
                                                            const isSelected = (values.proficiencyChoices || {})[choiceKey];
                                                            const isAny = isAnyOption(option);
                                                            
                                                            if (isAny) {
                                                                return null; // Skip "any" options from button display
                                                            }
                                                            
                                                            return (
                                                                <button
                                                                    key={option}
                                                                    onClick={() => handleProficiencyToggle(category, option)}
                                                                    className={`text-[11px] flex items-center gap-1.5 capitalize p-1.5 rounded border transition-all ${
                                                                        isSelected 
                                                                        ? 'border-website-specials-500 bg-website-specials-900/40 text-white' 
                                                                        : 'border-website-default-700 text-website-default-400 hover:border-website-default-500'
                                                                    }`}
                                                                >
                                                                    <div className={`w-1 h-1 rotate-45 ${isSelected ? 'bg-website-specials-400' : 'bg-website-default-600'}`} />
                                                                    {toTitleCase(option)}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    
                                                    {/* Dropdowns for "any" proficiencies */}
                                                    {choiceData.options.some(isAnyOption) && (
                                                        <div className="mt-3 space-y-2 p-3 bg-website-default-900/50 rounded border border-website-default-700">
                                                            {(() => {
                                                                // Create slots based on amount
                                                                const slots = Array.from({ length: choiceData.amount }, (_, idx) => idx);
                                                                const anyOption = choiceData.options.find(isAnyOption);
                                                                if (!anyOption) return null;
                                                                
                                                                const dropdownOptions = getAnyOptions(anyOption);
                                                                // Get already selected values for this category
                                                                const selectedValues = new Set(
                                                                    Object.entries(values.proficiencyChoices || {})
                                                                        .filter(([key, value]) => key.startsWith(`${category}_${anyOption}_`))
                                                                        .map(([_, value]) => value)
                                                                );
                                                                
                                                                return slots.map((slotIndex) => {
                                                                    const choiceKey = `${category}_${anyOption}_${slotIndex}`;
                                                                    const currentSelection = (values.proficiencyChoices || {})[choiceKey] || '';
                                                                    
                                                                    // Filter options to exclude already selected values
                                                                    const availableOptions = dropdownOptions.filter(opt => 
                                                                        !selectedValues.has(opt) || opt === currentSelection
                                                                    );
                                                                    
                                                                    return (
                                                                        <div key={choiceKey} className="flex items-center gap-2">
                                                                            <span className="text-xs text-website-default-300">
                                                                                {(() => {
                                                                                    if (choiceData.amount > 1) return `Choice ${slotIndex + 1}`;
                                                                                    const cleaned = toTitleCase(anyOption.replace(/any/i, '').trim());
                                                                                    return cleaned || 'Language';
                                                                                })()} :
                                                                            </span>
                                                                            <select
                                                                                className='flex-1 rounded border border-website-specials-500 bg-website-default-900 px-2 py-1 text-xs text-white focus:outline-none'
                                                                                value={currentSelection}
                                                                                onChange={(e) => handleAnyProficiencySelection(category, anyOption, slotIndex, e.target.value)}
                                                                            >
                                                                                <option value='' disabled>Select {toTitleCase(anyOption.replace(/any/i, '').trim())}</option>
                                                                                {availableOptions.map(opt => (
                                                                                    <option key={opt} value={opt}>{toTitleCase(opt)}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            
                                            {/* Tool Proficiency Choices - Render separately */}
                                            {selectedBackground.choices?.proficiencies?.tools && (
                                                <div className="bg-website-specials-900/20 border border-website-specials-700/30 p-3 rounded-lg">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h4 className="text-website-specials-400 text-[10px] uppercase">Tool Proficiency Choices</h4>
                                                        <span className="text-[10px] text-white bg-website-specials-600 px-2 py-0.5 rounded-full">
                                                            Picked {Object.keys(values.proficiencyChoices || {}).filter(k => k.startsWith('tools_')).length} / {selectedBackground.choices.proficiencies.tools.amount}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {selectedBackground.choices.proficiencies.tools.options.map((option) => {
                                                            const choiceKey = `tools_${option}`;
                                                            const isSelected = (values.proficiencyChoices || {})[choiceKey];
                                                            const isAny = isAnyOption(option);
                                                            
                                                            if (isAny) {
                                                                return null;
                                                            }
                                                            
                                                            return (
                                                                <button
                                                                    key={option}
                                                                    onClick={() => handleProficiencyToggle('tools', option)}
                                                                    className={`text-[11px] flex items-center gap-1.5 capitalize p-1.5 rounded border transition-all ${
                                                                        isSelected 
                                                                        ? 'border-website-specials-500 bg-website-specials-900/40 text-white' 
                                                                        : 'border-website-default-700 text-website-default-400 hover:border-website-default-500'
                                                                    }`}
                                                                >
                                                                    <div className={`w-1 h-1 rotate-45 ${isSelected ? 'bg-website-specials-400' : 'bg-website-default-600'}`} />
                                                                    {toTitleCase(option)}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    
                                                    {/* Dropdowns for "any" tool proficiencies */}
                                                    {selectedBackground.choices.proficiencies.tools.options.some(isAnyOption) && (
                                                        <div className="mt-3 space-y-2 p-3 bg-website-default-900/50 rounded border border-website-default-700">
                                                            {(() => {
                                                                // Create slots based on amount
                                                                const slots = Array.from({ length: selectedBackground.choices.proficiencies.tools.amount }, (_, idx) => idx);
                                                                const anyOption = selectedBackground.choices.proficiencies.tools.options.find(isAnyOption);
                                                                if (!anyOption) return null;
                                                                
                                                                const dropdownOptions = getAnyOptions(anyOption);
                                                                // Get already selected values for tools
                                                                const selectedValues = new Set(
                                                                    Object.entries(values.proficiencyChoices || {})
                                                                        .filter(([key, value]) => key.startsWith(`tools_${anyOption}_`))
                                                                        .map(([_, value]) => value)
                                                                );
                                                                
                                                                return slots.map((slotIndex) => {
                                                                    const choiceKey = `tools_${anyOption}_${slotIndex}`;
                                                                    const currentSelection = (values.proficiencyChoices || {})[choiceKey] || '';
                                                                    
                                                                    // Filter options to exclude already selected values
                                                                    const availableOptions = dropdownOptions.filter(opt => 
                                                                        !selectedValues.has(opt) || opt === currentSelection
                                                                    );
                                                                    
                                                                    return (
                                                                        <div key={choiceKey} className="flex items-center gap-2">
                                                                            <span className="text-xs text-website-default-300">
                                                                                {(() => {
                                                                                    if (selectedBackground.choices.proficiencies.tools.amount > 1) return `Choice ${slotIndex + 1}`;
                                                                                    const cleaned = toTitleCase(anyOption.replace(/[Aa]ny/, '').trim());
                                                                                    return cleaned || 'Tool';
                                                                                })()} :
                                                                            </span>
                                                                            <select
                                                                                className='flex-1 rounded border border-website-specials-500 bg-website-default-900 px-2 py-1 text-xs text-white focus:outline-none'
                                                                                value={currentSelection}
                                                                                onChange={(e) => handleAnyProficiencySelection('tools', anyOption, slotIndex, e.target.value)}
                                                                            >
                                                                                <option value='' disabled>Select {toTitleCase(anyOption.replace(/any/i, '').trim())}</option>
                                                                                {availableOptions.map(opt => (
                                                                                    <option key={opt} value={opt}>{toTitleCase(opt)}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </Card.Content>
                                    </Card>

                                    {/* Equipment Card */}
                                    {selectedBackground.baseEquipment && selectedBackground.baseEquipment.length > 0 && (
                                        <Card className='bg-website-default-800 border-website-specials-500'>
                                            <Card.Header className="border-b border-website-default-700/50">
                                                <Card.Title className='text-website-default-100'>🎒 Equipment</Card.Title>
                                                <Card.Description className='text-website-default-300'>Your starting gear.</Card.Description>
                                            </Card.Header>
                                            <Card.Content className="pt-6 space-y-6">
                                                {/* Base Equipment */}
                                                <div>
                                                    <h4 className="text-website-highlights-400 text-xs tracking-widest mb-3 uppercase">Base Equipment</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedBackground.baseEquipment.map((item, idx) => {
                                                            const parts = item.split(':');
                                                            const itemName = parts[0];
                                                            const quantity = parts[1] || '1';
                                                            return (
                                                                <div key={idx} className="bg-website-default-900 border border-website-default-700 px-3 py-2 rounded-lg text-sm">
                                                                    <span className="text-website-specials-400 font-bold mr-1">{quantity}x</span>
                                                                    <span className="text-website-default-100">{toTitleCase(itemName)}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Equipment Choices */}
                                                {selectedBackground.choices?.equipment && Object.entries(selectedBackground.choices.equipment).map(([choiceKey, options]) => (
                                                    <div key={choiceKey} className="space-y-3">
                                                        <h4 className="text-website-specials-400 text-xs tracking-widest uppercase">
                                                            {toTitleCase(choiceKey).replace(/choice/i, 'Choice')}
                                                        </h4>
                                                        <div className="flex flex-col gap-3">
                                                            {Object.entries(options).map(([optionKey, items]) => {
                                                                const isActive = values.backgroundEquipmentChoices?.[choiceKey]?.optionKey === optionKey;
                                                                const hasAnyItems = Object.keys(items).some(key => isAnyItem(key));

                                                                // Regular option with button and optional dropdowns
                                                                return (
                                                                    <div key={optionKey} className="space-y-2">
                                                                        <button
                                                                            onClick={() => handleEquipmentChoice(choiceKey, optionKey, items)}
                                                                            className={`w-full p-4 text-left rounded-lg border transition-all ${
                                                                                isActive 
                                                                                ? 'bg-website-specials-900/40 border-website-specials-500' 
                                                                                : 'bg-website-default-900 border-website-default-700 hover:border-website-default-500'
                                                                            }`}
                                                                        >
                                                                            <div className="flex justify-between items-start">
                                                                                <div className="text-sm flex-1">
                                                                                    {Object.entries(items).map(([itemName, quantity], idx) => (
                                                                                        <div key={itemName} className={idx > 0 ? 'mt-2' : ''}>
                                                                                            <span className="text-website-specials-400 font-bold">{quantity}x</span>
                                                                                            {' '}
                                                                                            <span className="text-website-default-100">{toTitleCase(itemName)}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                                {isActive && (
                                                                                    <span className="text-website-specials-400 font-bold text-lg ml-2">✓</span>
                                                                                )}
                                                                            </div>
                                                                        </button>
                                                                        
                                                                        {/* Show dropdowns for "any" items if this option is selected */}
                                                                        {isActive && hasAnyItems && (
                                                                            <div className="ml-4 space-y-2 p-3 bg-website-default-900/50 rounded border border-website-default-700">
                                                                                {Object.entries(items).map(([itemName, quantity]) => {
                                                                                    if (!isAnyItem(itemName)) return null;
                                                                                    
                                                                                    const dropdownOptions = getAnyOptions(itemName);
                                                                                    const selectionKey = `${choiceKey}_${optionKey}_${itemName}`;
                                                                                    const selectionData = values.backgroundAnyItemSelections?.[selectionKey];
                                                                                    const currentSelection = selectionData?.itemId || '';
                                                                                    
                                                                                    return (
                                                                                        <div key={itemName} className="flex items-center gap-2">
                                                                                            <span className="text-xs text-website-default-300">
                                                                                                <span className="text-website-specials-400 font-bold">{quantity}x</span> {toTitleCase(itemName)}:
                                                                                            </span>
                                                                                            <select
                                                                                                className='flex-1 rounded border border-website-specials-500 bg-website-default-900 px-2 py-1 text-xs text-white focus:outline-none'
                                                                                                value={currentSelection}
                                                                                                onChange={(e) => handleAnyItemSelection(choiceKey, optionKey, itemName, e.target.value)}
                                                                                            >
                                                                                                <option value='' disabled>Select {toTitleCase(itemName.replace(/any/i, '').trim())}</option>
                                                                                                {dropdownOptions.map(opt => (
                                                                                                    <option key={opt} value={opt}>{toTitleCase(opt)}</option>
                                                                                                ))}
                                                                                            </select>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </Card.Content>
                                        </Card>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Background;
