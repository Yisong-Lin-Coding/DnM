import React, { useMemo } from 'react';
import { Card } from '../../../pageComponents/card';
import { CircleUser } from 'lucide-react';
import classFeatures from '../../../data/classfeatures';
import { useGameData } from '../../../data/gameDataContext';
import {
    toTitleCase,
    startingPacks,
    isStartingPack,
    isAnyItem,
    addItemsToInventory,
    getAnyItemOptions
} from '../utils/inventory';

export function Class({ values, onChange, classes = [], subclasses = [] }) {
    // Get game data from context (items, maps, selectors)
    const { maps } = useGameData();

    const selected = values?.class || '';
    const selectedSubclass = values?.subclass || '';
    const emit = (partial) => { 
        if (typeof onChange === 'function') onChange(partial); 
    };

    // Memoize the selected class object
    const selectedClass = useMemo(() => {
        return classes.find(c => c._id === selected);
    }, [classes, selected]);

    // Memoize available subclasses for selected class
    const availableSubclasses = useMemo(() => {
        if (!selectedClass) return [];
        return subclasses.filter(sc => sc.parentClass === selectedClass.name);
    }, [selectedClass, subclasses]);

    // Memoize the selected subclass object
    const selectedSubclassObj = useMemo(() => {
        return subclasses.find(sc => sc._id === selectedSubclass);
    }, [subclasses, selectedSubclass]);

    // Note: Inventory helper functions are now imported from shared utility module above
    // This includes: toTitleCase, isStartingPack, isAnyItem, getAnyItemOptions, addItemsToInventory

    // 2. Logic: Handle Class Selection & Auto-populate Base Proficiencies + Resources
    const handleClassChange = (classId) => {
        const fullClassData = classes.find(c => c._id === classId);
        if (!fullClassData) return;
        const previousClassData = classes.find(c => c._id === values?.class);

        const baseMods = fullClassData.baseProficiencies || {};
        const resMods = fullClassData.resourcePoolModifier || { HP: 1, STA: 1, MP: 1 };

        // Parse base equipment items
        const fixedItems = (fullClassData.baseEquipment || []).map(itemStr => {
            const parts = itemStr.split(':');
            const name = parts.length === 3 ? parts[1] : parts[0];
            const qty = parts.length === 3 ? parseInt(parts[2]) : parseInt(parts[1]);
            return { itemId: name, quantity: qty || 1 };
        });

        // Reset subclass when class changes
        const applyUpdate = (inventoryMap) => {
            const previousClassBase = values.classBaseProficiencies || [];
            const previousClassSkillOptions = previousClassData?.choices?.proficiencies?.skills?.options || [];
            const nextClassBase = [
                ...(baseMods.armor || []),
                ...(baseMods.weapons || []),
                ...(baseMods.tools || []),
                ...(baseMods.abilityScore || [])
            ];

            // Start from existing proficiencies so background/manual selections are preserved.
            const proficienciesMap = { ...(values.skills?.proficiencies || {}) };

            // Remove old class base proficiencies and old class-pick skills.
            [...previousClassBase, ...previousClassSkillOptions].forEach((key) => {
                delete proficienciesMap[key];
            });

            // Add new class base proficiencies.
            nextClassBase.forEach((key) => {
                proficienciesMap[key] = 'proficient';
            });

            // Remove all previous class-added items (base + equipment choices + any-item picks)
            const currentItems = { ...(values.inv?.items || {}) };
            const itemIdsToRemove = [
                ...(values.classBaseItemIds || []),
                ...Object.values(values.classEquipmentChoices || {}).flatMap(choice => choice?.addedIds || []),
                ...Object.values(values.classAnyItemSelections || {}).map(selection => selection?.uniqueId).filter(Boolean),
            ];
            itemIdsToRemove.forEach((id) => {
                if (currentItems[id]) delete currentItems[id];
            });
            const updatedItems = { ...currentItems, ...inventoryMap };

            const update = {
                class: classId,
                subclass: '', // Reset subclass when class changes
                // Auto-calculate base resources (Example base: 10 * modifier)
                HP: { ...values.HP, max: Math.floor(10 * (resMods.HP || 1)), current: Math.floor(10 * (resMods.HP || 1)) },
                STA: { ...values.STA, max: Math.floor(10 * (resMods.STA || 1)), current: Math.floor(10 * (resMods.STA || 1)) },
                MP: { ...values.MP, max: Math.floor(10 * (resMods.MP || 1)), current: Math.floor(10 * (resMods.MP || 1)) },
                // Push base proficiencies into character skills as Map
                skills: {
                    ...values.skills,
                    proficiencies: proficienciesMap
                },
                // Set base equipment
                inv: { 
                    gp: values.inv?.gp || 0,
                    items: updatedItems,
                    equipment: values.inv?.equipment || {}
                },
                classBaseItemIds: Object.keys(inventoryMap),
                classBaseProficiencies: nextClassBase,
                // Reset equipment choices
                classEquipmentChoices: {},
                // Reset any item selections
                classAnyItemSelections: {}
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

    // 3. Logic: Handle Skill Choice Toggles (Pick X)
const handleSkillToggle = (skillName) => {
    if (!selectedClass?.choices?.proficiencies?.skills) return;

    const currentProficiencies = values.skills?.proficiencies || {};
    const maxAllowed = selectedClass.choices.proficiencies.skills.amount;

    const skillOptions = selectedClass.choices.proficiencies.skills.options || [];
    const currentSkillCount = Object.keys(currentProficiencies).filter(key => 
        skillOptions.includes(key)
    ).length;

    console.log('=== BEFORE TOGGLE ===');
    console.log('Skill:', skillName);
    console.log('values.skills.proficiencies:', values.skills?.proficiencies);
    console.log('Is selected?', currentProficiencies[skillName]);

    const newProficiencies = { ...currentProficiencies };

    if (newProficiencies[skillName]) {
        delete newProficiencies[skillName];
        console.log('DELETED:', skillName);
    } else {
        if (currentSkillCount < maxAllowed) {
            newProficiencies[skillName] = 'proficient';
            console.log('ADDED:', skillName);
        } else {
            console.log('LIMIT REACHED');
            return;
        }
    }

    console.log('=== EMITTING ===');
    console.log('New proficiencies:', newProficiencies);
    
    const updatePayload = {
        skills: {
            active: values.skills?.active || {},
            passive: values.skills?.passive || {},
            proficiencies: newProficiencies
        }
    };
    
    console.log('Full payload:', updatePayload);
    
    onChange(updatePayload);
    
    // Check after a tick to see if state updated
    setTimeout(() => {
        console.log('=== AFTER UPDATE (next tick) ===');
        console.log('values.skills.proficiencies:', values.skills?.proficiencies);
    }, 0);
};

    // 4. Logic: Handle Equipment Choice Selection
    const handleEquipmentChoice = (choiceKey, optionKey, items) => {
        const currentItems = { ...(values.inv?.items || {}) };
        const previousChoices = values.classEquipmentChoices || {};
        
        // Remove items from previous choice if exists
        if (previousChoices[choiceKey]) {
            const previousOptionKey = previousChoices[choiceKey].optionKey;
            const previousItems = selectedClass.choices.equipment[choiceKey][previousOptionKey];
            
            // Find and remove all items from previous choice
            Object.keys(currentItems).forEach(uniqueId => {
                const shouldRemove = previousChoices[choiceKey].addedIds?.includes(uniqueId);
                if (shouldRemove) {
                    delete currentItems[uniqueId];
                }
            });
        }
        
        // Process items - expand packs, skip "any" items
        const itemsToAdd = [];
        Object.entries(items).forEach(([name, qty]) => {
            if (isAnyItem(name)) {
                // Skip "any" items - they'll be handled by dropdown
                return;
            }
            
            if (isStartingPack(name)) {
                // Add the pack container itself
                itemsToAdd.push({ itemId: name, quantity: qty });
                
                // Add all items from the pack
                const packContents = startingPacks[name].items;
                packContents.forEach(itemStr => {
                    const parts = itemStr.split(':');
                    const itemName = parts[0];
                    const itemQty = parseInt(parts[1]) || 1;
                    itemsToAdd.push({ itemId: itemName, quantity: itemQty * qty });
                });
            } else {
                // Regular item
                itemsToAdd.push({ itemId: name, quantity: qty });
            }
        });
        
        // Convert items to inventory format using context-provided items map
        const newInventoryItems = addItemsToInventory(itemsToAdd, { itemsByItemId: maps.itemsByItemId });
        const addedIds = Object.keys(newInventoryItems);
        const updatedItems = { ...currentItems, ...newInventoryItems };
        
        emit({
            classEquipmentChoices: { 
                ...previousChoices, 
                [choiceKey]: { optionKey, items, addedIds }
            },
            inv: { 
                ...values.inv, 
                items: updatedItems 
            }
        });
    };

    // 5. Logic: Handle "Any" Item Selection (Dropdown)
    const handleAnyItemSelection = (choiceKey, optionKey, anyItemKey, selectedItem) => {
        const currentItems = { ...(values.inv?.items || {}) };
        const previousSelections = values.classAnyItemSelections || {};
        
        // Remove previous "any" selection for this specific key if exists
        const prevSelectionKey = `${choiceKey}_${optionKey}_${anyItemKey}`;
        if (previousSelections[prevSelectionKey]) {
            const oldUniqueId = previousSelections[prevSelectionKey].uniqueId;
            if (oldUniqueId && currentItems[oldUniqueId]) {
                delete currentItems[oldUniqueId];
            }
        }
        
        // Get quantity from the original "any" item
        const originalItems = selectedClass.choices.equipment[choiceKey][optionKey];
        const quantity = originalItems[anyItemKey];
        
        // Add the newly selected item
        const itemsToAdd = [{ itemId: selectedItem, quantity }];
        const newInventoryItems = addItemsToInventory(itemsToAdd, { itemsByItemId: maps.itemsByItemId });
        const uniqueIds = Object.keys(newInventoryItems);
        const updatedItems = { ...currentItems, ...newInventoryItems };
        
        emit({
            classAnyItemSelections: {
                ...previousSelections,
                [prevSelectionKey]: {
                    itemId: selectedItem,
                    uniqueId: uniqueIds[0] // Store the first unique ID for removal later
                }
            },
            inv: { 
                ...values.inv, 
                items: updatedItems 
            }
        });
    };

    return (
        <div className='bg-website-default-900 min-h-screen grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr]'>
            <div className='p-4 space-y-4 md:col-start-2'>

                {/* Name Input */}
                <div className='flex flex-row p-4 space-x-4 border-b border-website-specials-500'>
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
                    {/* BASE CLASS SECTION */}
                    <div>
                        <h1 className="text-2xl font-semibold mb-4 text-white">Base Class</h1>

                        <div className="grid grid-cols-1 gap-6">
                            {/* Class Selector */}
                            <Card className='bg-website-default-800 border-website-specials-500'>
                                <Card.Header>
                                    <Card.Title className='text-website-default-100'>Class</Card.Title>
                                    <Card.Description className='text-website-default-300'>Choose your base class.</Card.Description>
                                </Card.Header>
                                <Card.Content>
                                    <div className='flex flex-col'>
                                        <select
                                            className='rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 text-white focus:outline-none'
                                            value={selected}
                                            onChange={(e) => handleClassChange(e.target.value)}
                                        >
                                            <option value='' disabled>Select class</option>
                                            {classes.map(c => (
                                                <option key={c._id} value={c._id}>{c.name}</option>
                                            ))}
                                        </select>
                                        {selectedClass && (
                                            <div className='mt-4 p-4 border border-website-specials-500 rounded bg-website-default-900/50'>
                                                <div className='text-website-default-300 text-sm'>
                                                    {selectedClass.description}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card.Content>
                            </Card>

                            {selectedClass && (
                                <>
                                    {/* Modifiers Card */}
                                    <Card className='bg-website-default-800 border-website-specials-500'>
                                        <Card.Header className="border-b border-website-default-700 pb-4">
                                            <Card.Title className='text-website-default-100'>◈ Class Modifiers</Card.Title>
                                        </Card.Header>
                                        <Card.Content className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-website-default-900/50 p-4 rounded-lg border border-website-default-700">
                                                <h4 className="text-website-specials-400 text-xs tracking-widest mb-3 uppercase">Stat Increases</h4>
                                                <ul className='space-y-2'>
                                                    {Object.entries(selectedClass.baseStatModifier || {}).map(([stat, val]) => (
                                                        <li key={stat} className="flex justify-between text-sm">
                                                            <span className="text-website-default-100 font-bold">{stat}</span>
                                                            <span className="text-website-specials-500">+{val}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="bg-website-default-900/50 p-4 rounded-lg border border-website-default-700">
                                                <h4 className="text-website-highlights-400 text-xs tracking-widest mb-3 uppercase">Resource Multipliers</h4>
                                                <ul className='space-y-2'>
                                                    {Object.entries(selectedClass.resourcePoolModifier || {}).map(([res, val]) => (
                                                        <li key={res} className="flex justify-between text-sm">
                                                            <span className="text-website-default-100 font-bold">{res}</span>
                                                            <span className="text-website-highlights-500">x{val.toFixed(1)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </Card.Content>
                                    </Card>

                                    {/* Proficiencies Card */}
                                    <Card className='bg-website-default-800 border-website-specials-500'>
                                        <Card.Header className="border-b border-website-default-700/50">
                                            <Card.Title className='text-website-default-100'>🛡️ Proficiencies</Card.Title>
                                        </Card.Header>
                                        <Card.Content className="space-y-4">
                                            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                                                {Object.entries(selectedClass.baseProficiencies || {}).map(([cat, items]) => (
                                                    Array.isArray(items) && items.length > 0 && (
                                                        <div key={cat} className="bg-website-default-900/60 p-3 rounded-lg border border-website-default-700">
                                                            <h4 className="text-website-highlights-400 text-[10px] uppercase mb-2">{cat}</h4>
                                                            <div className="flex flex-wrap gap-1">
                                                                {items.map(item => (
                                                                    <span key={item} className="px-2 py-0.5 bg-website-default-700 text-white text-[10px] rounded border border-website-default-600">
                                                                        {toTitleCase(item)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                ))}
                                            </div>

                                            {/* Skill Choices */}
                                            {selectedClass.choices?.proficiencies?.skills && (
                                                <div className="bg-website-specials-900/20 border border-website-specials-700/30 p-3 rounded-lg">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h4 className="text-website-specials-400 text-[10px] uppercase">Skill Choices</h4>
                                                        <span className="text-[10px] text-white bg-website-specials-600 px-2 py-0.5 rounded-full">
                                                            Picked {(() => {
                                                                const proficiencies = values.skills?.proficiencies || {};
                                                                const skillOptions = selectedClass.choices.proficiencies.skills.options || [];
                                                                return Object.keys(proficiencies).filter(key => skillOptions.includes(key)).length;
                                                            })()} / {selectedClass.choices.proficiencies.skills.amount}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {selectedClass.choices.proficiencies.skills.options?.map((skill) => {
                                                            const proficiencies = values.skills?.proficiencies || {};
                                                            const isSelected = proficiencies.hasOwnProperty(skill);
                                                            
                                                            // Add this console log to debug
                                                            
                                                            
                                                            return (
                                                                <button
                                                                    key={skill}
                                                                    onClick={() => handleSkillToggle(skill)}
                                                                    className={`text-[11px] flex items-center gap-1.5 capitalize p-1.5 rounded border transition-all ${
                                                                        isSelected 
                                                                        ? 'border-website-specials-500 bg-website-specials-900/40 text-white' 
                                                                        : 'border-website-default-700 text-website-default-400 hover:border-website-default-500'
                                                                    }`}
                                                                >
                                                                    <div className={`w-1 h-1 rotate-45 ${isSelected ? 'bg-website-specials-400' : 'bg-website-default-600'}`} />
                                                                    {toTitleCase(skill)}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </Card.Content>
                                    </Card>

                                    {/* Equipment Card */}
                                    <Card className='bg-website-default-800 border-website-specials-500'>
                                        <Card.Header className="border-b border-website-default-700/50">
                                            <Card.Title className='text-website-default-100'>🎒 Equipment</Card.Title>
                                            <Card.Description className='text-website-default-300'>Your starting gear and equipment choices.</Card.Description>
                                        </Card.Header>
                                        <Card.Content className="pt-6 space-y-6">
                                            {/* Base Equipment */}
                                            {selectedClass.baseEquipment && selectedClass.baseEquipment.length > 0 && (
                                                <div>
                                                    <h4 className="text-website-highlights-400 text-xs tracking-widest mb-3 uppercase">Base Equipment</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedClass.baseEquipment.map((item, idx) => {
                                                            const parts = item.split(':');
                                                            const itemName = parts.length === 3 ? parts[1] : parts[0];
                                                            const quantity = parts.length === 3 ? parts[2] : parts[1] || '1';
                                                            return (
                                                                <div key={idx} className="bg-website-default-900 border border-website-default-700 px-3 py-2 rounded-lg text-sm">
                                                                    <span className="text-website-specials-400 font-bold mr-1">{quantity}x</span>
                                                                    <span className="text-website-default-100">{toTitleCase(itemName)}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Equipment Choices */}
                                            {selectedClass.choices?.equipment && Object.entries(selectedClass.choices.equipment).map(([choiceKey, options]) => (
                                                <div key={choiceKey} className="space-y-3">
                                                    <h4 className="text-website-specials-400 text-xs tracking-widest uppercase">
                                                        {toTitleCase(choiceKey).replace(/choice/i, 'Choice')}
                                                    </h4>
                                                    <div className="flex flex-col gap-3">
                                                        {Object.entries(options).map(([optionKey, items]) => {
                                                            const isActive = values.classEquipmentChoices?.[choiceKey]?.optionKey === optionKey;
                                                            const hasAnyItems = Object.keys(items).some(key => isAnyItem(key));
                                                            const onlyAnyItems = Object.keys(items).every(key => isAnyItem(key));
                                                            
                                                            // If option only has "any" items, show dropdowns directly
                                                            if (onlyAnyItems) {
                                                                return (
                                                                    <div key={optionKey} className="space-y-2 p-3 bg-website-default-900 rounded border border-website-default-700">
                                                                        {Object.entries(items).map(([itemName, quantity]) => {
                                                                            const dropdownOptions = getAnyItemOptions(itemName);
                                                                            const selectionKey = `${choiceKey}_${optionKey}_${itemName}`;
                                                                            const selectionData = values.classAnyItemSelections?.[selectionKey];
                                                                            const currentSelection = selectionData?.itemId || '';
                                                                            
                                                                            return (
                                                                                <div key={itemName} className="flex items-center gap-2">
                                                                                    <span className="text-xs text-website-default-300">
                                                                                        <span className="text-website-specials-400 font-bold">{quantity}x</span> {toTitleCase(itemName)}:
                                                                                    </span>
                                                                                    <select
                                                                                        className='flex-1 rounded border border-website-specials-500 bg-website-default-900 px-2 py-1 text-xs text-white focus:outline-none'
                                                                                        value={currentSelection}
                                                                                        onChange={(e) => {
                                                                                            handleAnyItemSelection(choiceKey, optionKey, itemName, e.target.value);
                                                                                            // Auto-select this option when making a selection
                                                                                            if (e.target.value && !isActive) {
                                                                                                handleEquipmentChoice(choiceKey, optionKey, items);
                                                                                            }
                                                                                        }}
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
                                                                );
                                                            }
                                                            
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
                                                                                {Object.entries(items).map(([itemName, quantity], idx) => {
                                                                                    const isPack = isStartingPack(itemName);
                                                                                    
                                                                                    return (
                                                                                        <div key={itemName} className={idx > 0 ? 'mt-2' : ''}>
                                                                                            <div>
                                                                                                <span className="text-website-specials-400 font-bold">{quantity}x</span>
                                                                                                {' '}
                                                                                                <span className="text-website-default-100">{toTitleCase(itemName)}</span>
                                                                                            </div>
                                                                                            
                                                                                            {/* Show pack contents */}
                                                                                            {isPack && (
                                                                                                <div className="ml-4 mt-1 text-xs text-website-default-400">
                                                                                                    <div className="italic mb-1">Contains:</div>
                                                                                                    <div className="flex flex-wrap gap-1">
                                                                                                        {startingPacks[itemName].items.map((packItem, pIdx) => {
                                                                                                            const [pName, pQty] = packItem.split(':');
                                                                                                            return (
                                                                                                                <span key={pIdx} className="bg-website-default-800/50 px-1.5 py-0.5 rounded">
                                                                                                                    {pQty}x {toTitleCase(pName)}
                                                                                                                </span>
                                                                                                            );
                                                                                                        })}
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
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
                                                                                
                                                                                const dropdownOptions = getAnyItemOptions(itemName);
                                                                                const selectionKey = `${choiceKey}_${optionKey}_${itemName}`;
                                                                                const selectionData = values.classAnyItemSelections?.[selectionKey];
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

                                    {/* Abilities Card */}
                                    {selectedClass.featuresByLevel && Object.keys(selectedClass.featuresByLevel).length > 0 && (
                                        <Card className='bg-website-default-800 border-website-specials-500'>
                                            <Card.Header className="border-b border-website-default-700/50">
                                                <Card.Title className='text-website-default-100'>⚡ Class Features</Card.Title>
                                                <Card.Description className='text-website-default-300'>All features and abilities by level.</Card.Description>
                                            </Card.Header>
                                            <Card.Content className="pt-6">
                                                <div className="space-y-4">
                                                    {Object.entries(selectedClass.featuresByLevel)
                                                        .filter(([level, features]) => features && features.length > 0)
                                                        .sort((a, b) => {
                                                            const aNum = parseInt(a[0].replace('level', ''));
                                                            const bNum = parseInt(b[0].replace('level', ''));
                                                            return aNum - bNum;
                                                        })
                                                        .map(([level, features]) => (
                                                            <div key={level} className="space-y-2">
                                                                <h4 className="text-website-specials-400 text-xs tracking-widest uppercase font-bold">
                                                                    Level {level.replace('level', '')}
                                                                </h4>
                                                                <div className="space-y-2 ml-2">
                                                                    {features.map((featureId, idx) => {
                                                                        const feature = classFeatures[featureId];
                                                                        if (!feature) {
                                                                            return (
                                                                                <div key={idx} className="text-website-default-400 text-sm">
                                                                                    <span className="text-website-specials-400 font-bold">•</span> {toTitleCase(featureId)} (No data)
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return (
                                                                            <div 
                                                                                key={idx} 
                                                                                className="p-3 bg-website-default-900/50 border border-website-default-700 rounded-lg hover:border-website-specials-500/50 transition-colors"
                                                                            >
                                                                                <div className="flex items-start gap-2">
                                                                                    <span className="text-website-specials-400 font-bold mt-1">✦</span>
                                                                                    <div className="flex-1">
                                                                                        <h5 className="text-website-default-100 font-semibold text-sm">
                                                                                            {feature.name}
                                                                                        </h5>
                                                                                        <p className="text-website-default-300 text-xs mt-1 leading-relaxed">
                                                                                            {feature.description}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </Card.Content>
                                        </Card>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* SUBCLASS SECTION */}
                    {selectedClass && availableSubclasses.length > 0 && (
                        <div>
                            <h1 className="text-2xl font-semibold mb-4 text-white">Subclass</h1>

                            <div className="grid grid-cols-1 gap-6">
                                {/* Subclass Selector */}
                                <Card className='bg-website-default-800 border-website-highlights-500'>
                                    <Card.Header>
                                        <Card.Title className='text-website-default-100'>Subclass</Card.Title>
                                        <Card.Description className='text-website-default-300'>Choose your specialization.</Card.Description>
                                    </Card.Header>
                                    <Card.Content>
                                        <div className='flex flex-col space-y-4'>
                                            <select
                                                className='rounded border border-website-highlights-500 bg-website-default-900 px-3 py-2 text-white focus:outline-none'
                                                value={selectedSubclass}
                                                onChange={(e) => emit({ subclass: e.target.value })}
                                            >
                                                <option value='' disabled>Select subclass (optional)</option>
                                                {availableSubclasses.map(sc => (
                                                    <option key={sc._id} value={sc._id}>{sc.name}</option>
                                                ))}
                                            </select>
                                            {selectedSubclassObj && (
                                                <div className='p-4 border border-website-highlights-500 rounded bg-website-default-900/50'>
                                                    <div className='text-website-default-300 text-sm'>
                                                        {selectedSubclassObj.description}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </Card.Content>
                                </Card>

                                {/* Subclass Features Card */}
                                {selectedSubclassObj && selectedSubclassObj.featuresByLevel && Object.keys(selectedSubclassObj.featuresByLevel).length > 0 && (
                                    <Card className='bg-website-default-800 border-website-highlights-500'>
                                        <Card.Header className="border-b border-website-default-700/50">
                                            <Card.Title className='text-website-default-100'>✨ Subclass Features</Card.Title>
                                            <Card.Description className='text-website-default-300'>Features from {selectedSubclassObj.name}</Card.Description>
                                        </Card.Header>
                                        <Card.Content className="pt-6">
                                            <div className="space-y-4">
                                                {Object.entries(selectedSubclassObj.featuresByLevel)
                                                    .filter(([level, features]) => features && features.length > 0)
                                                    .sort((a, b) => {
                                                        const aNum = parseInt(a[0].replace('level', ''));
                                                        const bNum = parseInt(b[0].replace('level', ''));
                                                        return aNum - bNum;
                                                    })
                                                    .map(([level, features]) => (
                                                        <div key={level} className="space-y-2">
                                                            <h4 className="text-website-highlights-400 text-xs tracking-widest uppercase font-bold">
                                                                Level {level.replace('level', '')}
                                                            </h4>
                                                            <div className="space-y-2 ml-2">
                                                                {features.map((featureId, idx) => {
                                                                    const feature = classFeatures[featureId];
                                                                    if (!feature) {
                                                                        return (
                                                                            <div key={idx} className="text-website-default-400 text-sm">
                                                                                <span className="text-website-highlights-400 font-bold">•</span> {toTitleCase(featureId)} (No data)
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return (
                                                                        <div 
                                                                            key={idx} 
                                                                            className="p-3 bg-website-default-900/50 border border-website-default-700 rounded-lg hover:border-website-highlights-500/50 transition-colors"
                                                                        >
                                                                            <div className="flex items-start gap-2">
                                                                                <span className="text-website-highlights-400 font-bold mt-1">✦</span>
                                                                                <div className="flex-1">
                                                                                    <h5 className="text-website-default-100 font-semibold text-sm">
                                                                                        {feature.name}
                                                                                    </h5>
                                                                                    <p className="text-website-default-300 text-xs mt-1 leading-relaxed">
                                                                                        {feature.description}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </Card.Content>
                                    </Card>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Class;
