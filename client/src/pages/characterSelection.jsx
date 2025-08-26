import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter } from 'react-router-dom';
function StartScreen() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/login'); // Use route path, not file path
  };

  return (
    <div>
      <div>
        top div
      </div>

      <div>
        Mid dev
      </div>

      <div>
        Optional lower Div
      </div>

    </div>
  );
}

export default StartScreen;