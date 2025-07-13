import React, { useState, useEffect, useRef } from 'react';
// Tone.js is assumed to be loaded globally by the environment.
// If running this code outside of a specific environment, ensure Tone.js is loaded
// via a script tag in your HTML, e.g.:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.min.js"></script>

// Predefined array of distinct colors for words to cycle through.
const WORD_COLORS = [
    '#EF4444', // Red 500
    '#3B82F6', // Blue 500
    '#10B981', // Green 500
    '#F59E0B', // Amber 500
    '#8B5CF6', // Violet 500
    '#EC4899', // Pink 500
    '#06B6D4', // Cyan 500
    '#6B7280', // Gray 500
    '#A855F7', // Purple 500
    '#EAB308', // Yellow 500
    '#F43F5E', // Rose 500
    '#22C55E', // Emerald 500
];

// Helper function to check if two cell coordinates are neighbors (including diagonals).
const isNeighbor = (coords1, coords2) => {
    if (!coords1 || !coords2) return false; // Safety check
    const [r1, c1] = coords1;
    const [r2, c2] = coords2;

    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);

    // Cells are neighbors if the difference in row and column is at most 1,
    // and they are not the same cell (dr !== 0 || dc !== 0).
    return dr <= 1 && dc <= 1 && (dr !== 0 || dc !== 0);
};

// Main App component for our Word List Editor with a Clickable Grid.
const App = () => {
    // State to hold the word currently being typed into the input field.
    const [currentWord, setCurrentWord] = useState('');
    // State to hold the list of all words entered by the user.
    // Each word is an object: { id: uniqueString, text: string, color: string }.
    const [enteredWords, setEnteredWords] = useState([]);
    // State to store the ID of the word currently in edit mode. Null if no word is being edited.
    const [editMode, setEditMode] = useState(null);
    // State to store the text of the word being edited in the input field.
    const [editedWordText, setEditedWordText] = useState('');
    // State to store the total letter count across all entered words.
    const [totalLetterCount, setTotalLetterCount] = useState(0);

    // State for the currently selected word's data for placement.
    // Includes id, full text, color, current letter index, and coordinates of the last placed letter.
    // { id: null, text: null, color: null, letterIndex: 0, lastPlacedCoords: null }
    const [selectedWordData, setSelectedWordData] = useState({ id: null, text: null, color: null, letterIndex: 0, lastPlacedCoords: null });

    // State for the clickable grid cells.
    // Each cell can be null (empty) or hold an object:
    // { letter: 'A', wordId: 'someId', color: '#hexColor', sequenceIndex: 0, row: number, col: number }
    // Initializes an 8x6 array with all cells set to null.
    const [gridCells, setGridCells] = useState(
        Array(8).fill(null).map(() => Array(6).fill(null))
    );

    // State to track which words have letters placed on the grid
    const [placedWordIds, setPlacedWordIds] = useState(new Set());

    // State for Theme and Hint inputs
    const [themeText, setThemeText] = useState('');
    const [hintText, setHintText] = useState('');

    // Ref to keep track of the next color index to assign to new words.
    // Using useRef to ensure it doesn't reset on re-renders.
    const nextColorIndex = useRef(0);

    // Ref for the Tone.js synth
    const synthRef = useRef(null);

    // Initialize Tone.js synth on component mount
    useEffect(() => {
        // Ensure Tone.js is available before trying to use it
        if (typeof Tone !== 'undefined' && !synthRef.current) {
            // Tone.start() is necessary to enable audio on user interaction
            // Add a one-time event listener to start audio context on first user interaction
            document.documentElement.addEventListener('click', () => {
                if (Tone.context.state !== 'running') {
                    Tone.start().then(() => {
                        console.log("Tone.js audio context started.");
                    }).catch(e => console.error("Failed to start Tone.js audio context:", e));
                }
            }, { once: true });

            // Create a simple synth
            synthRef.current = new Tone.Synth().toDestination();
        }
    }, []); // Empty dependency array ensures this runs once on mount

    // Function to calculate the letter count for a given string.
    // This helper function now counts all characters, assuming they are "letters" for total count.
    const calculateLetters = (text) => {
        return text.length; // Simply return the length of the string
    };

    // Event handler for when the main input field's value changes.
    const handleInputChange = (event) => {
        setCurrentWord(event.target.value);
    };

    // Event handler for adding the current word to the list.
    const handleAddWord = () => {
        // Only add the word if it's not empty after trimming whitespace.
        if (currentWord.trim() !== '') {
            // Get the next unique color for the new word.
            const newWordColor = WORD_COLORS[nextColorIndex.current % WORD_COLORS.length];
            nextColorIndex.current++; // Increment for the next word.

            // Create a new word object with a unique ID, trimmed text, and assigned color.
            const newWord = {
                id: crypto.randomUUID(), // Generates a unique ID for the word.
                text: currentWord.trim(),
                color: newWordColor,
            };
            // Add the new word to the 'enteredWords' array, maintaining immutability.
            setEnteredWords([...enteredWords, newWord]);
            setCurrentWord(''); // Clear the input field after adding.
        }
    };

    // Event handler for clicking the 'Edit' button on a list item.
    const handleEditClick = (wordId, currentText) => {
        setEditMode(wordId); // Set the edit mode to the ID of the word being edited.
        setEditedWordText(currentText); // Populate the edit input field with the current text.
        setSelectedWordData({ id: null, text: null, color: null, letterIndex: 0, lastPlacedCoords: null }); // Deselect any word when editing.
    };

    // Event handler for changing the text in the edit input field.
    const handleEditInputChange = (event) => {
        setEditedWordText(event.target.value);
    };

    // Function to clear all cells marked by a specific word ID from the grid.
    const clearCellsForWord = (wordIdToClear) => {
        setGridCells(prevGridCells => {
            const updatedGrid = prevGridCells.map(row =>
                row.map(cell => {
                    if (cell && cell.wordId === wordIdToClear) {
                        return null; // Clear the cell
                    }
                    return cell;
                })
            );
            return updatedGrid;
        });

        // If cells were cleared and the word was selected, reset its placement progress.
        if (selectedWordData.id === wordIdToClear) {
             // Use functional update for selectedWordData to ensure it sees the latest state
            setSelectedWordData(prevSelected => ({
                ...prevSelected,
                letterIndex: 0,
                lastPlacedCoords: null
            }));
        }
    };

    // Event handler for saving the edited word.
    const handleSaveEdit = (wordId) => {
        // Find the original word object to compare its text
        const originalWord = enteredWords.find(word => word.id === wordId);

        // Only save if the edited text is not empty.
        if (editedWordText.trim() !== '') {
            // Clear any existing marks for this word on the grid ONLY if the text has changed.
            if (originalWord && originalWord.text !== editedWordText.trim()) {
                clearCellsForWord(wordId); // This also resets selectedWordData.letterIndex/lastPlacedCoords if selected
            }

            // Map over the enteredWords array to find and update the specific word's text.
            const updatedWords = enteredWords.map((word) =>
                word.id === wordId ? { ...word, text: editedWordText.trim() } : word
            );
            setEnteredWords(updatedWords); // Update the state with the modified list.
            setEditMode(null); // Exit edit mode.
            setEditedWordText(''); // Clear the edited word text state.
        } else {
            // If the user tries to save an empty word, cancel the edit instead.
            console.log("Cannot save an empty word. Edit canceled.");
            setEditMode(null);
            setEditedWordText('');
        }
    };

    // Event handler for canceling the edit operation.
    const handleCancelEdit = () => {
        setEditMode(null); // Exit edit mode.
        setEditedWordText(''); // Clear the edited word text state.
    };

    // Event handler for clearing cells marked by a specific word, but not removing the word itself.
    const handleClearWordCellsButton = (wordId) => {
        clearCellsForWord(wordId);
        // clearCellsForWord now handles deselecting and resetting placement data if needed.
    };

    // Event handler for selecting a word.
    const handleSelectWord = (wordId, wordText, wordColor) => {
        // If the word is already selected, deselect it and clear its letters from the grid.
        if (selectedWordData.id === wordId) {
            setSelectedWordData({ id: null, text: null, color: null, letterIndex: 0, lastPlacedCoords: null });
            // Do not clear cells here, as clearCellsForWord will handle it when needed (e.g., on deselect)
        } else {
            // Select the new word.
            // When a word is selected, we need to find its current letter index and last placed coordinates on the grid.
            // This allows resuming a sequence if the word was partially placed.
            let maxSequenceIndex = -1; // Max index of letter from this word already on grid
            let currentLastPlacedCoords = null;

            // Iterate through the grid to find any existing letters from this word
            // and determine the highest index placed and its coordinates.
            for (let r = 0; r < gridCells.length; r++) {
                for (let c = 0; c < gridCells[r].length; c++) {
                    const cell = gridCells[r][c];
                    if (cell && cell.wordId === wordId) {
                        // Use the sequenceIndex stored in the cell content
                        if (cell.sequenceIndex > maxSequenceIndex) {
                            maxSequenceIndex = cell.sequenceIndex;
                            currentLastPlacedCoords = [r, c];
                        }
                    }
                }
            }

            // If no letters of this word are currently on the grid, start from index 0.
            // Otherwise, start from the next letter after the highest sequence index found.
            const newLetterIndex = maxSequenceIndex === -1 ? 0 : maxSequenceIndex + 1;

            setSelectedWordData({
                id: wordId,
                text: wordText.trim(),
                color: wordColor,
                letterIndex: newLetterIndex,
                lastPlacedCoords: currentLastPlacedCoords
            });
            // Do not update gridCells here, only when placing/clearing.
        }
        setEditMode(null); // Exit edit mode if a word is selected.
    };

    // Event handler for clicking a grid cell.
    const handleCellClick = (rowIndex, colIndex) => {
        // Create a deep copy of the gridCells array to ensure immutability.
        const newGridCells = gridCells.map(row => [...row]);
        const currentCellContent = newGridCells[rowIndex][colIndex];
        const { id: selectedWordId, text: selectedWordText, color: selectedColor, letterIndex: currentLetterIndex, lastPlacedCoords } = selectedWordData;

        // Only proceed if a word is currently selected.
        if (selectedWordId && selectedWordText && selectedColor) {
            // Check if there are letters left to place.
            if (currentLetterIndex >= selectedWordText.length) {
                // All letters placed, deselect word automatically.
                setSelectedWordData({ id: null, text: null, color: null, letterIndex: 0, lastPlacedCoords: null });
                return;
            }

            const letterToPlace = selectedWordText.charAt(currentLetterIndex).toUpperCase();

            // Case 1: Cell is currently occupied.
            if (currentCellContent) {
                // If the cell is occupied by the CURRENTLY SELECTED word's letter, then clear it (toggle off).
                if (currentCellContent.wordId === selectedWordId) {
                    newGridCells[rowIndex][colIndex] = null;
                    setGridCells(newGridCells); // Update grid immediately after clearing.

                    // Recalculate lastPlacedCoords and letterIndex after clearing.
                    let newLastCoords = null;
                    let highestSequenceIndex = -1;
                    // Find the last placed letter with the highest sequence index for this word.
                    for (let r = 0; r < newGridCells.length; r++) {
                        for (let c = 0; c < newGridCells[r].length; c++) {
                            const cell = newGridCells[r][c];
                            if (cell && cell.wordId === selectedWordId) {
                                if (cell.sequenceIndex > highestSequenceIndex) {
                                    highestSequenceIndex = cell.sequenceIndex;
                                    newLastCoords = [r, c];
                                }
                            }
                        }
                    }

                    setSelectedWordData(prevData => ({
                        ...prevData,
                        letterIndex: Math.max(0, highestSequenceIndex + 1), // Next letter in sequence
                        lastPlacedCoords: newLastCoords
                    }));
                }
                // Else (cell is occupied by a DIFFERENT word's letter), DO NOT OVERWRITE. Do nothing.
                return;
            }
            // Case 2: Cell is empty. Attempt to place the letter.
            else {
                // Check if it's the very first letter or a valid neighbor.
                const isFirstLetter = currentLetterIndex === 0;
                const isValidPlacement = isFirstLetter || isNeighbor(lastPlacedCoords, [rowIndex, colIndex]);

                if (isValidPlacement) { // letterIndex checked at the very beginning of function
                    newGridCells[rowIndex][colIndex] = {
                        letter: letterToPlace,
                        wordId: selectedWordId,
                        color: selectedColor,
                        sequenceIndex: currentLetterIndex, // Store the letter's index in the sequence
                        row: rowIndex, // Store row index
                        col: colIndex  // Store column index
                    };
                    setGridCells(newGridCells); // Update the gridCells state.

                    // Update the letter index and last placed coordinates for the next placement.
                    const nextLetterIndex = currentLetterIndex + 1;
                    const newLastPlacedCoords = [rowIndex, colIndex];

                    // If all letters have been placed, deselect the word and play sound.
                    if (nextLetterIndex >= selectedWordText.length) {
                        setSelectedWordData({ id: null, text: null, color: null, letterIndex: 0, lastPlacedCoords: null });
                        // Play a confirmation sound when the last letter is placed
                        if (synthRef.current && typeof Tone !== 'undefined' && Tone.context.state === 'running') {
                            synthRef.current.triggerAttackRelease("C5", "8n"); // C5 note for an 8th note duration
                        }
                    } else {
                        // Otherwise, just update the letter index and last placed coords for the next click.
                        setSelectedWordData(prevData => ({
                            ...prevData,
                            letterIndex: nextLetterIndex,
                            lastPlacedCoords: newLastPlacedCoords
                        }));
                    }
                }
                // If not a valid placement (not first letter and not a neighbor), do nothing.
            }
        }
        // If no word is selected or no letters left, clicking a cell does not place or remove letters.
    };

    // Function to handle the export button click
    const handleExport = () => {
        // UTF-8 BOM (Byte Order Mark) for better compatibility with Excel and other spreadsheet software.
        const BOM = "\uFEFF"; // Unicode BOM character

        // Theme and Hint lines without prefixes
        const themeLine = `${themeText}`;
        const hintLine = `${hintText}`;

        // Line for comma-separated list of word texts
        const wordsLine = enteredWords.map(word => word.text).join(',');

        // Line for semicolon-separated list of second-row text from marked cells
        const gridDataLine = gridCells.flat() // Flatten the 2D array into a 1D array
            .filter(cellContent => cellContent !== null) // Keep only marked cells
            .map(cellContent => {
                // Find the word object to get its original index
                const wordObj = enteredWords.find(w => w.id === cellContent.wordId);
                const wordIndex = wordObj ? enteredWords.indexOf(wordObj) : -1;
                // Reconstruct the second-line text for each cell using stored row and col
                return `${wordIndex};${cellContent.sequenceIndex};${cellContent.row};${cellContent.col}`;
            })
            .join(',');

        // Combine all lines for the file content
        const fileContent = `${BOM}${themeLine}\n${hintLine}\n${wordsLine}\n${gridDataLine}`;

        const blob = new Blob([fileContent], { type: 'text/csv;charset=utf-8' }); // Specify UTF-8 charset
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'strands_layout.csv'; // Changed to strands_layout.csv
        document.body.appendChild(a);
        a.click(); // Programmatically click the link to trigger download
        document.body.removeChild(a); // Clean up the DOM
        URL.revokeObjectURL(url); // Release the object URL
    };

    // useEffect hook to update placedWordIds whenever gridCells change
    useEffect(() => {
        const currentPlacedIds = new Set();
        gridCells.forEach(row => {
            row.forEach(cell => {
                if (cell && cell.wordId) {
                    currentPlacedIds.add(cell.wordId);
                }
            });
        });
        setPlacedWordIds(currentPlacedIds);
    }, [gridCells]);

    // useEffect hook to re-calculate the total letter count whenever 'enteredWords' changes.
    useEffect(() => {
        // Iterate through all entered words and sum up their letter counts using the helper function.
        const newTotal = enteredWords.reduce((sum, word) => sum + calculateLetters(word.text), 0);
        setTotalLetterCount(newTotal); // Update the 'totalLetterCount' state.
    }, [enteredWords]); // This effect runs only when 'enteredWords' array changes.

    return (
        <>
            {/* Global Styles */}
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

                body {
                    margin: 0;
                    font-family: 'Inter', sans-serif;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                }

                .app-container {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background-color: #f3f4f6; /* bg-gray-100 */
                    padding: 1rem; /* p-4 */
                }

                @media (min-width: 1024px) { /* lg breakpoint */
                    .app-container {
                        flex-direction: row;
                        align-items: flex-start;
                        justify-content: center;
                        gap: 2rem; /* space-x-8 */
                    }
                }

                .panel {
                    background-color: #ffffff; /* bg-white */
                    padding: 2rem; /* p-8 */
                    border-radius: 0.75rem; /* rounded-xl */
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); /* shadow-lg */
                    width: 100%; /* w-full */
                    max-width: 28rem; /* max-w-md */
                    margin-bottom: 2rem; /* space-y-8 on small screens */
                }

                @media (min-width: 1024px) { /* lg breakpoint */
                    .panel {
                        width: 50%; /* lg:w-1/2 */
                        margin-bottom: 0; /* remove margin-bottom on large screens */
                    }
                }

                .title {
                    font-size: 0.9375rem; /* 50% of 1.875rem (text-3xl) */
                    font-weight: 700; /* font-bold */
                    text-align: center; /* text-center */
                    color: #1f2937; /* text-gray-800 */
                    margin-bottom: 0.75rem; /* Reduced from 1.5rem */
                }

                .input-group {
                    margin-bottom: 0.75rem; /* Reduced from 1.5rem */
                }

                .label {
                    display: block; /* block */
                    color: #374151; /* text-gray-700 */
                    font-size: 0.875rem; /* text-sm */
                    font-weight: 600; /* font-semibold */
                    margin-bottom: 0.25rem; /* Reduced from 0.5rem */
                }

                .input-flex-container {
                    display: flex; /* flex */
                    gap: 0.5rem; /* space-x-2 */
                }

                .input-field {
                    flex-grow: 1; /* flex-grow */
                    padding: 0.5rem; /* Reduced from 0.75rem */
                    border: 1px solid #d1d5db; /* border border-gray-300 */
                    border-radius: 0.5rem; /* rounded-lg */
                    outline: none; /* focus:outline-none */
                    transition: all 0.2s ease-in-out; /* transition duration-200 */
                }

                .input-field:focus {
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5); /* focus:ring-2 focus:ring-blue-500 */
                    border-color: transparent; /* focus:border-transparent */
                }

                .rtl-input-field {
                    direction: rtl;
                    text-align: right;
                }

                .button {
                    font-weight: 700; /* font-bold */
                    padding: 0.75rem 1.25rem; /* py-3 px-5 */
                    border-radius: 0.5rem; /* rounded-lg */
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); /* shadow-md */
                    transition: all 0.3s ease-in-out; /* transition duration-300 ease-in-out */
                    transform: scale(1); /* initial transform */
                    outline: none; /* focus:outline-none */
                }

                .button:hover {
                    transform: scale(1.05); /* hover:scale-105 */
                }

                .button:focus {
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5), 0 0 0 4px rgba(59, 130, 246, 0.5); /* focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 */
                }

                .button-blue {
                    background-color: #2563eb; /* bg-blue-600 */
                    color: #ffffff; /* text-white */
                }
                .button-blue:hover {
                    background-color: #1d4ed8; /* hover:bg-blue-700 */
                }

                .button-purple {
                    background-color: #9333ea; /* bg-purple-600 */
                    color: #ffffff; /* text-white */
                }
                .button-purple:hover {
                    background-color: #7e22ce; /* hover:bg-purple-700 */
                }

                .button-gray {
                    background-color: #9ca3af; /* bg-gray-400 */
                    color: #ffffff; /* text-white */
                }
                .button-gray:hover {
                    background-color: #6b7280; /* hover:bg-gray-500 */
                }

                .button-red {
                    background-color: #ef4444; /* bg-red-500 */
                    color: #ffffff; /* text-white */
                }
                .button-red:hover {
                    background-color: #dc2626; /* hover:bg-red-600 */
                }

                .button-green {
                    background-color: #16a34a; /* bg-green-600 */
                    color: #ffffff; /* text-white */
                }
                .button-green:hover {
                    background-color: #15803d; /* hover:bg-green-700 */
                }

                .info-box {
                    padding: 0.75rem; /* Reduced from 1rem */
                    border-left: 4px solid; /* border-l-4 */
                    border-radius: 0.375rem; /* rounded-md */
                    margin-bottom: 0.75rem; /* Reduced from 1rem */
                }

                .info-box-yellow {
                    background-color: #fffbeb; /* bg-yellow-50 */
                    border-color: #f59e0b; /* border-yellow-500 */
                    color: #b45309; /* text-yellow-800 */
                }

                .info-box-green {
                    background-color: #f0fdf4; /* bg-green-50 */
                    border-color: #22c55e; /* border-green-500 */
                    color: #166534; /* text-green-800 */
                }

                .info-box-blue {
                    background-color: #eff6ff; /* bg-blue-50 */
                    border-color: #3b82f6; /* border-blue-500 */
                    color: #1e40af; /* text-blue-800 */
                }

                .info-box-text {
                    font-size: 1rem; /* Reduced from 1.125rem */
                    font-weight: 500; /* font-medium */
                }

                .info-box-text span {
                    font-weight: 700; /* font-bold */
                    color: inherit; /* text-blue-700, text-green-700 */
                }

                .word-list-container {
                    background-color: #f9fafb; /* bg-gray-50 */
                    border: 1px solid #e5e7eb; /* border border-gray-200 */
                    border-radius: 0.375rem; /* rounded-md */
                    padding: 1rem; /* p-4 */
                    margin-top: 1rem; /* mt-4 */
                }

                .word-list-title {
                    font-size: 1.25rem; /* text-xl */
                    font-weight: 600; /* font-semibold */
                    color: #1f2937; /* text-gray-800 */
                    margin-bottom: 0.75rem; /* mb-3 */
                }

                .word-list {
                    list-style: disc; /* list-disc */
                    padding-left: 1.25rem; /* pl-5 */
                    color: #374151; /* text-gray-700 */
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem; /* space-y-2 */
                }

                .word-list-item {
                    display: flex; /* flex */
                    align-items: center; /* items-center */
                    justify-content: space-between; /* justify-between */
                    background-color: #ffffff; /* bg-white */
                    padding: 0.75rem; /* p-3 */
                    border-radius: 0.5rem; /* rounded-lg */
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
                    border: 1px solid #f3f4f6; /* border border-gray-100 */
                }

                .word-list-item.selected {
                    border-color: #22c55e; /* border-green-500 */
                    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3); /* ring-2 ring-green-300 */
                }

                .word-text-display {
                    font-weight: 500; /* font-medium */
                    font-size: 1.125rem; /* text-lg */
                    display: flex;
                    align-items: center;
                }

                .word-placed-indicator {
                    margin-right: 0.5rem; /* mr-2 */
                    color: #16a34a; /* text-green-600 */
                    font-size: 1.5rem; /* text-xl */
                    font-weight: 700; /* font-bold */
                }

                .word-actions {
                    display: flex; /* flex */
                    gap: 0.5rem; /* space-x-2 */
                }

                .edit-input-field {
                    flex-grow: 1; /* flex-grow */
                    padding: 0.5rem; /* p-2 */
                    border: 1px solid #d1d5db; /* border border-gray-300 */
                    border-radius: 0.5rem; /* rounded-lg */
                    outline: none; /* focus:outline-none */
                    transition: all 0.2s ease-in-out;
                }
                .edit-input-field:focus {
                    box-shadow: 0 0 0 1px rgba(147, 51, 234, 0.5); /* focus:ring-1 focus:ring-purple-500 */
                }

                .grid-info-box {
                    margin-bottom: 1rem; /* mb-4 */
                    padding: 0.75rem; /* p-3 */
                    border-radius: 0.375rem; /* rounded-md */
                    text-align: center; /* text-center */
                    font-size: 1.125rem; /* text-lg */
                    font-weight: 500; /* font-medium */
                    transition: all 0.3s; /* transition-colors duration-300 */
                }

                .grid-info-box.active {
                    background-color: #f0fdf4; /* bg-green-100 */
                    color: #166534; /* text-green-800 */
                    border: 1px solid #22c55e; /* border border-green-300 */
                }

                .grid-info-box.inactive {
                    background-color: #f3f4f6; /* bg-gray-100 */
                    color: #4b5563; /* text-gray-600 */
                    border: 1px solid #e5e7eb; /* border border-gray-200 */
                }


                .grid-container {
                    display: grid; /* grid */
                    grid-template-columns: repeat(6, minmax(0, 1fr)); /* grid-cols-6 */
                    gap: 0.25rem; /* gap-1 */
                    padding: 0.5rem; /* p-2 */
                    border: 1px solid #d1d5db; /* border border-gray-300 */
                    border-radius: 0.5rem; /* rounded-lg */
                }

                .grid-cell {
                    width: 3rem; /* w-12 */
                    height: 3rem; /* h-12 */
                    display: flex; /* flex */
                    flex-direction: column; /* flex-col */
                    align-items: center; /* items-center */
                    justify-content: center; /* justify-center */
                    font-size: 1.125rem; /* text-lg */
                    font-weight: 700; /* font-bold */
                    border: 1px solid #d1d5db; /* border border-gray-300 */
                    border-radius: 0.375rem; /* rounded-md */
                    cursor: pointer; /* cursor-pointer */
                    user-select: none; /* select-none */
                    transition: background-color 0.2s ease-in-out, filter 0.2s ease-in-out; /* transition-colors duration-200 ease-in-out */
                    color: #4b5563; /* text-gray-700 default */
                    background-color: #e2e8f0; /* Default gray-200 */
                }

                .grid-cell.marked {
                    color: #ffffff; /* text-white */
                }

                .grid-cell:hover {
                    filter: brightness(0.9); /* hover:brightness-90 */
                }

                .grid-cell-second-line {
                    font-size: 0.75rem; /* text-xs */
                    font-weight: 400; /* font-normal */
                    opacity: 0.8; /* opacity-80 */
                    white-space: nowrap; /* whitespace-nowrap */
                }

                .export-button {
                    margin-top: 1.5rem; /* mt-6 */
                    width: 100%; /* w-full */
                    background-color: #4f46e5; /* bg-indigo-600 */
                    color: #ffffff; /* text-white */
                    font-weight: 700; /* font-bold */
                    padding: 0.75rem 1.25rem; /* py-3 px-5 */
                    border-radius: 0.5rem; /* rounded-lg */
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); /* shadow-md */
                    transition: all 0.3s ease-in-out; /* transition duration-300 ease-in-out */
                    transform: scale(1); /* initial transform */
                    outline: none; /* focus:outline-none */
                }

                .export-button:hover {
                    background-color: #4338ca; /* hover:bg-indigo-700 */
                    transform: scale(1.05); /* hover:scale-105 */
                }

                .export-button:focus {
                    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.5), 0 0 0 4px rgba(79, 70, 229, 0.5); /* focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 */
                }
                `}
            </style>

            {/* Main container div */}
            <div className="app-container">
                {/* Left section: Word List Editor */}
                <div className="panel">
                    <h1 className="title">
                        Word List Editor
                    </h1>

                    {/* Theme Input */}
                    <div className="input-group">
                        <label htmlFor="themeInput" className="label">
                            Theme:
                        </label>
                        <input
                            type="text"
                            id="themeInput"
                            className="input-field rtl-input-field"
                            placeholder="Enter theme..."
                            value={themeText}
                            onChange={(e) => setThemeText(e.target.value)}
                        />
                    </div>

                    {/* Hint Input */}
                    <div className="input-group">
                        <label htmlFor="hintInput" className="label">
                            Hint:
                        </label>
                        <input
                            type="text"
                            id="hintInput"
                            className="input-field rtl-input-field"
                            placeholder="Enter hint..."
                            value={hintText}
                            onChange={(e) => setHintText(e.target.value)}
                        />
                    </div>

                    {/* Display area for total letter count across all words. */}
                    <div className="info-box info-box-blue" style={{ marginTop: '0', marginBottom: '0.5rem', padding: '0.5rem' }}>
                        <p className="info-box-text" style={{ fontSize: '0.875rem' }}>
                            Total letters across all words: <span style={{ fontWeight: 'bold', color: '#1c4d8f' }}>{totalLetterCount} / 48</span>
                        </p>
                    </div>

                    {/* Input group for adding new words. */}
                    <div className="input-group">
                        <label htmlFor="wordInput" className="label">
                            Add a new word:
                        </label>
                        <div className="input-flex-container">
                            <input
                                type="text"
                                id="wordInput"
                                className="input-field"
                                placeholder="Type a word..."
                                value={currentWord}
                                onChange={handleInputChange}
                                onKeyPress={(event) => {
                                    if (event.key === 'Enter') {
                                        handleAddWord();
                                    }
                                }}
                            />
                            <button
                                onClick={handleAddWord}
                                className="button button-blue"
                                title="Add the current word to the list"
                            >
                                Add Word
                            </button>
                        </div>
                    </div>

                    {/* Display area for the list of entered words. */}
                    {enteredWords.length === 0 ? (
                        <div className="info-box info-box-yellow" style={{ marginTop: '0.75rem' }}>
                            <p className="info-box-text">No words added yet. Start typing!</p>
                        </div>
                    ) : (
                        <div className="word-list-container">
                            <h2 className="word-list-title">Your Words:</h2>
                            <ul className="word-list">
                                {enteredWords.map((word) => (
                                    <li
                                        key={word.id}
                                        className={`word-list-item ${selectedWordData.id === word.id ? 'selected' : ''}`}
                                    >
                                        {editMode === word.id ? (
                                            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <input
                                                    type="text"
                                                    className="edit-input-field"
                                                    value={editedWordText}
                                                    onChange={handleEditInputChange}
                                                    onKeyPress={(event) => {
                                                        if (event.key === 'Enter') {
                                                            handleSaveEdit(word.id);
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleSaveEdit(word.id)}
                                                    className="button button-purple"
                                                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                                    title="Save changes"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="button button-gray"
                                                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                                    title="Cancel editing"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="word-text-display">
                                                    {placedWordIds.has(word.id) && (
                                                        <span className="word-placed-indicator" title="Word used on grid">V</span>
                                                    )}
                                                    <span>{word.text}</span>
                                                </span>
                                                <div className="word-actions">
                                                    <button
                                                        onClick={() => handleSelectWord(word.id, word.text, word.color)}
                                                        className={`button ${selectedWordData.id === word.id ? 'button-green' : 'button-blue'}`}
                                                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                                        title={selectedWordData.id === word.id ? "Deselect this word" : "Select this word to place its letters"}
                                                    >
                                                        {selectedWordData.id === word.id ? "Selected" : "Select"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditClick(word.id, word.text)}
                                                        className="button button-purple"
                                                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                                        title="Edit this word"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleClearWordCellsButton(word.id)}
                                                        className="button button-gray"
                                                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                                        title="Clear marked cells for this word"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Right section: Clickable Grid */}
                <div className="panel">
                    <h1 className="title">
                        Clickable Grid (8x6)
                    </h1>
                    {/* Information about selected word for placing letters */}
                    <div className={`grid-info-box ${selectedWordData.id ? 'active' : 'inactive'}`}>
                        {selectedWordData.id ?
                            `Selected for grid: "${selectedWordData.text}" (Next Letter: ${selectedWordData.text.charAt(selectedWordData.letterIndex).toUpperCase()})` :
                            "Select a word to place its letters on the grid."}
                    </div>
                    {/* Grid container */}
                    <div className="grid-container">
                        {gridCells.map((row, rowIndex) => (
                            row.map((cellContent, colIndex) => {
                                // Find the word object to get its original index for display
                                const wordObj = enteredWords.find(w => w.id === cellContent?.wordId);
                                const wordIndex = wordObj ? enteredWords.indexOf(wordObj) : -1;

                                return (
                                    <div
                                        key={`${rowIndex}-${colIndex}`}
                                        style={{ backgroundColor: cellContent ? cellContent.color : '#e2e8f0' }}
                                        className="grid-cell"
                                        onClick={() => handleCellClick(rowIndex, colIndex)}
                                        title={`Cell (${rowIndex + 1}, ${colIndex + 1})`}
                                    >
                                        {/* First line: The letter */}
                                        <span>{cellContent ? cellContent.letter : ''}</span>
                                        {/* Second line: Word index, letter index, row, column coordinates, only if cell is marked */}
                                        {cellContent && (
                                            <span className="grid-cell-second-line">
                                                {wordIndex};{cellContent.sequenceIndex};{cellContent.row};{cellContent.col}
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        ))}
                    </div>
                    {/* Export Button moved here */}
                    <button
                        onClick={handleExport}
                        className="export-button"
                        title="Export grid data to strands_layout.csv"
                    >
                        Export Grid Data to strands_layout.csv
                    </button>
                </div>
            </div>
        </>
    );
};

export default App;
