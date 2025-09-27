import { Outlet, useNavigate } from "react-router-dom";
import "./techstack.css";

function TechStack() {
  const navigate = useNavigate();

  return (
    <div className="analyzer-div">
      <h1>TachStack Section</h1>
      <div className="navigation-div">
        <button onClick={() => navigate("/techstack")}>TackStack Scan</button>
        <button onClick={() => navigate("/techstack/archive")}>Archive</button>
      </div>
      <Outlet />
    </div>
  );
}

export default TechStack;