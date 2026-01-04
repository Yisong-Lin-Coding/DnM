import { Navigate, Outlet, useLocation  } from "react-router-dom";

import { useEffect, useRef, useState } from "react";
import useSessionCheck from "./sessionID";

export default function ProtectedLayout() {

  const location = useLocation(); // <-- call the hook
  const [currentLocation, setCurrentLocation] = useState(location);

  useEffect(() => {
    if (location.pathname !== currentLocation.pathname) {


    const locationFormatted = location.pathname.split("/").slice(3).join("/")

      setCurrentLocation(location);
      sessionStorage.setItem("lastLocation", locationFormatted);
    }
  }, [location, currentLocation]);



  const isSessionValid = useSessionCheck();


  if (!isSessionValid?.success) {
    return <Navigate to={`/login`} />;
  }

  return <Outlet  />;
}