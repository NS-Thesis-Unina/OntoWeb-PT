import { useNavigate } from "react-router-dom";
import "./navbar.css";

function Navbar(){

    const navigate = useNavigate();

    return(
        <div className="navbar-div">
            <button onClick={() => navigate("/home")}>Home</button>
            <button onClick={() => navigate("/techstack")}>Technology Stack</button>
            <button onClick={() => navigate("/analyzer")}>Analyzer</button>
        </div>
    )
}

export default Navbar;