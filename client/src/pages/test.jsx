import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter, useLocation } from 'react-router-dom';
import { useState } from "react";
import Skeleton from "../pageComponents/skeleton";

function StartScreen() {


  return (
    <Skeleton>
      <div className='bg-red-300 min-h-screen w-screen'>
      
      </div>

    </Skeleton>
  );
}

export default StartScreen;