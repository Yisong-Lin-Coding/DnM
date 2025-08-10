import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter } from 'react-router-dom';
function HomePage() {
  const navigate = useNavigate();

  chacterSelect = () => {
    navigate('/characterSelection'); 
}

  return (
    <div className="App">
      <h1></h1>
      <button>Add New Chacter</button>
      <button onClick={chacterSelect}>Chacter Selection</button>
      <button>Exit</button>
    </div>
  );
}

export default HomePage;