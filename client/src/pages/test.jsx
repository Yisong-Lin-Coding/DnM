import { BrowserRouter as Router, Routes, Route, Link, useNavigate, HashRouter, useLocation } from 'react-router-dom';
import { useState } from "react";
import Skeleton from "../pageComponents/skeleton";
import CC_Header  from '../pageComponents/CC_header'; 
import BodySkeleton from '../pageComponents/bodySkeleton';

function StartScreen() {


  return (
    <Skeleton>
      <CC_Header />
      
        <BodySkeleton>
          <div className='bg-blue-100'>
            HEELO
          </div>
          <div className='bg-red-100'>
            YE
          </div>
          <div className='bg-green-100'>
          HS
          </div>
        </BodySkeleton>

    </Skeleton>
  );
}

export default StartScreen;