
import React, { useState, createContext, useContext } from 'react';

childrenConext = createContext();

export function Page({ children, className="" }){

    

    return(
        <div className="w-screen h-screen bg-website-default-900 text-website-default-100 overflow-hidden grid grid-rows-[auto_1fr_auto]">
            {children}
        </div>
    )
}

Page.Header = function PageHeader({ children, className="" }){

    return(
        <div className="w-full p-4 border-b border-website-default-700">
            {children}
        </div>
    )

}

Page.Body = function PageBody({ children, className="" }){

}

    Page.Body.Left = function PageBodyLeft({ children, className="" }){

    }


    Page.Body.Center = function PageBodyCenter({children, className=""}){

    }

    Page.Body.Right = function PageBodyRight({children, className=""}){

    }


Page.Footer = function PageFooter({children, className=""}){

}
