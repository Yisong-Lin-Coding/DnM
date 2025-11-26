
import { useRef, useEffect, useState} from "react"



function Test() {

 const canvasRef = useRef(null);
  const [selectedChar, setSelectedChar] = useState(null);
  
  // Character data
  const characters = useRef([
    { id: 1, x: 200, y: 200, radius: 30, color: '#ef4444', name: 'Fighter' },
    { id: 2, x: 400, y: 300, radius: 30, color: '#3b82f6', name: 'Wizard' },
    { id: 3, x: 600, y: 250, radius: 30, color: '#10b981', name: 'Rogue' }
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    function draw() {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw all characters
      characters.current.forEach(char => {
        // Draw character circle
        ctx.beginPath();
        ctx.arc(char.x, char.y, char.radius, 0, Math.PI * 2);
        ctx.fillStyle = char.color;
        ctx.fill();
        
        // Draw selection box if selected
        if (selectedChar === char.id) {
          ctx.strokeStyle = '#fbbf24'; // Gold color
          ctx.lineWidth = 3;
          ctx.strokeRect(
            char.x - char.radius - 5,
            char.y - char.radius - 5,
            char.radius * 2 + 10,
            char.radius * 2 + 10
          );
        }
        
        // Draw name
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(char.name, char.x, char.y + char.radius + 20);
      });
      
      requestAnimationFrame(draw);
    }
    
    draw();
  }, [selectedChar]);

  // Handle clicks
  const handleClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Check if click is inside any character
    let foundChar = null;
    characters.current.forEach(char => {
      const distance = Math.sqrt(
        (clickX - char.x) ** 2 + (clickY - char.y) ** 2
      );
      
      if (distance <= char.radius) {
        foundChar = char.id;
      }
    });
    
    setSelectedChar(foundChar);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800">
      <h1 className="text-2xl font-bold mb-4 text-white">DnD Character Selection</h1>
      <canvas 
        ref={canvasRef}
        width={800}
        height={600}
        onClick={handleClick}
        className="border-4 border-gray-600 rounded-lg shadow-lg bg-gray-900 cursor-pointer"
      />
      <p className="text-white mt-4">
        {selectedChar ? `Selected: Character ${selectedChar}` : 'Click a character to select'}
      </p>
    </div>
  );
}

export default Test;