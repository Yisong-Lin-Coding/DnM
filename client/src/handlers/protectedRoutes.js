import { Navigate, Outlet } from "react-router-dom";
import useSessionCheck from "./sessionID";

export default function ProtectedLayout() {
  const isSessionValid = useSessionCheck();

  if (!isSessionValid?.success) {
    return <Navigate to={`/login`} />;
  }

  return <Outlet  />;
}