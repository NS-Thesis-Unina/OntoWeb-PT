import { Outlet } from "react-router-dom";
import "./app.css";
import Navbar from "./components/navbar/navbar";

function App(){
    return(
        <div className="app-div">
            <h1>App</h1>
            <Navbar />
            <Outlet />
        </div>
    )
}

export default App;