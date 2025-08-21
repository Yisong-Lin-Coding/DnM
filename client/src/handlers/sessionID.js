import { useParams } from 'react-router-dom';

export default function useSessionCheck() {
    const { sessionID } = useParams();

    const sessionIDstore = sessionStorage.getItem("session_ID");
    if (!sessionIDstore) {
        console.error("Session ID not found in sessionStorage");
        return {success: false, message: "Session ID not found"};
    }

    if (sessionIDstore !== sessionID) {
        console.error("Session ID mismatch");
        return {success: false, message: "Session ID mismatch"};
    }
    else{
        console.log("Session ID matches");
        return {success: true, message: "Session ID matches"};
    }


}