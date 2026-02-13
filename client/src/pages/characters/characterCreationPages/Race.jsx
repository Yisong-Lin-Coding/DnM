import React from 'react';
import { Card } from '../../../pageComponents/card';
import { useContext, useEffect, useState, useMemo } from "react";
import { useGameData } from "../../../data/gameDataContext";
import { CircleUser } from 'lucide-react';

// Helper function to convert camelCase to Title Case
const toTitleCase = (str) => {
    return str
        .replace(/([A-Z])/g, ' $1') // Add space before capitals
        .replace(/^./, (char) => char.toUpperCase()) // Capitalize first letter
        .trim();
};

export function Race({ values, onChange }) {
    const { maps } = useGameData();
    const { racesById, subracesById } = maps;

    const selectedRace = values?.race || '';
    const selectedSubrace = values?.subrace || '';
    const selectedSize = values?.model?.size || '';
    const emit = (partial) => {
        if (typeof onChange === 'function') onChange(partial);
    };

    // Memoize the selected race object - get from context maps
    const selectedRaceObj = useMemo(() => {
        return racesById[selectedRace] || null;
    }, [racesById, selectedRace]);

    // Filter races based on selected size
    const filteredRaces = useMemo(() => {
        if (!selectedSize) return []; // Return empty array if no size selected
        // Normalize size for comparison: tiny -> T, small -> S, medium -> M, large -> L, huge -> H, gargantuan -> G
        const sizeMap = {
            'tiny': 'T',
            'small': 'S',
            'medium': 'M',
            'large': 'L',
            'huge': 'H',
            'gargantuan': 'G'
        };
        const normalizedSize = sizeMap[selectedSize.toLowerCase()] || selectedSize.toUpperCase();
        // Convert racesById map to array and filter by size
        return Object.values(racesById).filter(r => r && r.size === normalizedSize);
    }, [racesById, selectedSize]);

    // Memoize available subraces for selected race
    const availableSubraces = useMemo(() => {
        if (!selectedRaceObj) return [];
        const subracesForRace = selectedRaceObj.subraces || [];
        // Match by subraceID - the race object stores subraceID values
        return Object.values(subracesById).filter(sr => 
            sr && subracesForRace.some(sub => sub.subraceID === sr.subraceID)
        );
    }, [selectedRaceObj, subracesById]);

    // Memoize the selected subrace object - get from context maps
    const selectedSubraceObj = useMemo(() => {
        return subracesById[selectedSubrace] || null;
    }, [subracesById, selectedSubrace]);

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
                    {/* RACE SECTION */}
                    <div>
                        <h1 className="text-2xl font-semibold mb-4 text-white">Race</h1>

                        <div className="grid grid-cols-1 gap-6">
                            {/* Size Filter Notice - Always Display */}
                            <Card className={selectedSize ? 'bg-website-highlights-900/20 border-website-highlights-500' : 'bg-website-specials-900/20 border-website-specials-500'}>
                                <Card.Content className='pt-6 pb-6'>
                                    <div className={`flex items-center gap-3 ${selectedSize ? 'text-website-highlights-300' : 'text-website-specials-300'}`}>
                                        {selectedSize ? (
                                            <span className='text-sm'>Showing races matching your selected size: <span className='font-semibold text-website-highlights-400'>{selectedSize.charAt(0).toUpperCase() + selectedSize.slice(1)}</span></span>
                                        ) : (
                                            <span className='text-sm'>💡 <span className='font-semibold'>Tip:</span> Select a size in Customization to filter available races by size.</span>
                                        )}
                                    </div>
                                </Card.Content>
                            </Card>

                            {/* Race Selector - Always show, but filtered by size if selected */}
                            <Card className='bg-website-default-800 border-website-specials-500'>
                                <Card.Header>
                                    <Card.Title className='text-website-default-100'>Race</Card.Title>
                                    <Card.Description className='text-website-default-300'>Choose your character's race.</Card.Description>
                                </Card.Header>
                                <Card.Content>
                                    <div className='flex flex-col'>
                                        <select
                                            className='rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 text-white focus:outline-none'
                                            value={selectedRace}
                                            onChange={(e) => emit({ race: e.target.value, subrace: '' })}
                                        >
                                            <option value='' disabled>Select race</option>
                                            {filteredRaces.length > 0 ? (
                                                filteredRaces.map(r => (
                                                    <option key={r._id} value={r._id}>{r.name}</option>
                                                ))
                                            ) : (
                                                <option disabled>No races match this size</option>
                                            )}
                                        </select>
                                        {selectedRaceObj && (
                                            <div className='mt-4 p-4 border border-website-specials-500 rounded bg-website-default-900/50'>
                                                <div className='text-website-default-300 text-sm'>
                                                    {selectedRaceObj.description}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card.Content>
                            </Card>

                            {/* Ability Score Modifiers Card */}
                            {selectedRaceObj && selectedRaceObj.abilityScoreModifiers && Object.keys(selectedRaceObj.abilityScoreModifiers).length > 0 && (
                                <Card className='bg-website-default-800 border-website-specials-500'>
                                    <Card.Header className="border-b border-website-default-700 pb-4">
                                        <Card.Title className='text-website-default-100'>◈ Ability Score Modifiers</Card.Title>
                                    </Card.Header>
                                    <Card.Content className="pt-6">
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {Object.entries(selectedRaceObj.abilityScoreModifiers).map(([ability, modifier]) => (
                                                <div key={ability} className="bg-website-default-900/50 p-4 rounded-lg border border-website-default-700 text-center">
                                                    <h4 className="text-website-specials-400 text-xs tracking-widest mb-2 uppercase">{toTitleCase(ability)}</h4>
                                                    <p className="text-website-specials-500 font-bold text-lg">+{modifier}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </Card.Content>
                                </Card>
                            )}

                            {/* Race Traits Card */}
                            {selectedRaceObj && selectedRaceObj.traits && selectedRaceObj.traits.length > 0 && (
                                <Card className='bg-website-default-800 border-website-specials-500'>
                                    <Card.Header className="border-b border-website-default-700/50">
                                        <Card.Title className='text-website-default-100'>✨ Racial Traits</Card.Title>
                                    </Card.Header>
                                    <Card.Content className="pt-6 space-y-2">
                                        {selectedRaceObj.traits.map((trait, idx) => (
                                            <div key={idx} className="p-3 bg-website-default-900/50 border border-website-default-700 rounded-lg">
                                                <div className="flex items-start gap-2">
                                                    <span className="text-website-specials-400 font-bold">•</span>
                                                    <span className="text-website-default-100">{toTitleCase(trait)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </Card.Content>
                                </Card>
                            )}

                            {/* Languages Card */}
                            {selectedRaceObj && selectedRaceObj.languages && selectedRaceObj.languages.length > 0 && (
                                <Card className='bg-website-default-800 border-website-specials-500'>
                                    <Card.Header className="border-b border-website-default-700/50">
                                        <Card.Title className='text-website-default-100'>🗣️ Languages</Card.Title>
                                    </Card.Header>
                                    <Card.Content className="pt-6">
                                        <div className="flex flex-wrap gap-2">
                                            {selectedRaceObj.languages.map((lang, idx) => (
                                                <span key={idx} className="px-3 py-2 bg-website-default-900 border border-website-default-700 rounded-lg text-sm text-website-default-100">
                                                    {toTitleCase(lang)}
                                                </span>
                                            ))}
                                        </div>
                                    </Card.Content>
                                </Card>
                            )}

                            {/* Size and Speed Card */}
                            {selectedRaceObj && (
                                <Card className='bg-website-default-800 border-website-specials-500'>
                                    <Card.Header className="border-b border-website-default-700/50">
                                        <Card.Title className='text-website-default-100'>⚡ Physical Traits</Card.Title>
                                    </Card.Header>
                                    <Card.Content className="pt-6 grid grid-cols-2 gap-4">
                                        <div className="bg-website-default-900/50 p-4 rounded-lg border border-website-default-700">
                                            <h4 className="text-website-highlights-400 text-xs tracking-widest mb-2 uppercase">Size</h4>
                                            <p className="text-website-default-100 font-semibold">{selectedRaceObj.size === 'M' ? 'Medium' : toTitleCase(selectedRaceObj.size)}</p>
                                        </div>
                                        <div className="bg-website-default-900/50 p-4 rounded-lg border border-website-default-700">
                                            <h4 className="text-website-highlights-400 text-xs tracking-widest mb-2 uppercase">Speed</h4>
                                            <p className="text-website-default-100 font-semibold">{selectedRaceObj.speed} ft.</p>
                                        </div>
                                    </Card.Content>
                                </Card>
                            )}
                        </div>
                    </div>

                    {/* SUBRACE SECTION */}
                    {selectedRaceObj && availableSubraces.length > 0 && (
                        <div>
                            <h1 className="text-2xl font-semibold mb-4 text-white">Subrace</h1>

                            <div className="grid grid-cols-1 gap-6">
                                {/* Subrace Selector */}
                                <Card className='bg-website-default-800 border-website-highlights-500'>
                                    <Card.Header>
                                        <Card.Title className='text-website-default-100'>Subrace</Card.Title>
                                        <Card.Description className='text-website-default-300'>Choose your subrace specialization (optional).</Card.Description>
                                    </Card.Header>
                                    <Card.Content>
                                        <div className='flex flex-col space-y-4'>
                                            <select
                                                className='rounded border border-website-highlights-500 bg-website-default-900 px-3 py-2 text-white focus:outline-none'
                                                value={selectedSubrace}
                                                onChange={(e) => emit({ subrace: e.target.value })}
                                            >
                                                <option value=''>None (Optional)</option>
                                                {availableSubraces.map(sr => (
                                                    <option key={sr._id} value={sr._id}>{sr.name}</option>
                                                ))}
                                            </select>
                                            {selectedSubraceObj && (
                                                <div className='p-4 border border-website-highlights-500 rounded bg-website-default-900/50'>
                                                    <div className='text-website-default-300 text-sm'>
                                                        {selectedSubraceObj.description}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </Card.Content>
                                </Card>

                                {/* Subrace Ability Modifiers */}
                                {selectedSubraceObj && selectedSubraceObj.abilityScoreModifiers && Object.keys(selectedSubraceObj.abilityScoreModifiers).length > 0 && (
                                    <Card className='bg-website-default-800 border-website-highlights-500'>
                                        <Card.Header className="border-b border-website-default-700 pb-4">
                                            <Card.Title className='text-website-default-100'>◈ Ability Score Modifiers</Card.Title>
                                        </Card.Header>
                                        <Card.Content className="pt-6">
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {Object.entries(selectedSubraceObj.abilityScoreModifiers).map(([ability, modifier]) => (
                                                    <div key={ability} className="bg-website-default-900/50 p-4 rounded-lg border border-website-default-700 text-center">
                                                        <h4 className="text-website-highlights-400 text-xs tracking-widest mb-2 uppercase">{toTitleCase(ability)}</h4>
                                                        <p className="text-website-highlights-500 font-bold text-lg">+{modifier}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card.Content>
                                    </Card>
                                )}

                                {/* Subrace Traits Card */}
                                {selectedSubraceObj && selectedSubraceObj.traits && selectedSubraceObj.traits.length > 0 && (
                                    <Card className='bg-website-default-800 border-website-highlights-500'>
                                        <Card.Header className="border-b border-website-default-700/50">
                                            <Card.Title className='text-website-default-100'>✨ Subrace Traits</Card.Title>
                                        </Card.Header>
                                        <Card.Content className="pt-6 space-y-2">
                                            {selectedSubraceObj.traits.map((trait, idx) => (
                                                <div key={idx} className="p-3 bg-website-default-900/50 border border-website-default-700 rounded-lg">
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-website-highlights-400 font-bold">•</span>
                                                        <span className="text-website-default-100">{toTitleCase(trait)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </Card.Content>
                                    </Card>
                                )}

                                {/* Subrace Languages Card */}
                                {selectedSubraceObj && selectedSubraceObj.languages && selectedSubraceObj.languages.length > 0 && (
                                    <Card className='bg-website-default-800 border-website-highlights-500'>
                                        <Card.Header className="border-b border-website-default-700/50">
                                            <Card.Title className='text-website-default-100'>🗣️ Languages</Card.Title>
                                        </Card.Header>
                                        <Card.Content className="pt-6">
                                            <div className="flex flex-wrap gap-2">
                                                {selectedSubraceObj.languages.map((lang, idx) => (
                                                    <span key={idx} className="px-3 py-2 bg-website-default-900 border border-website-default-700 rounded-lg text-sm text-website-default-100">
                                                        {toTitleCase(lang)}
                                                    </span>
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

export default Race;
