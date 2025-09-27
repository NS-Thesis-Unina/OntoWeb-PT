import { Outlet } from "react-router-dom";
import "./app.css";
import Navbar from "./components/navbar/navbar";
import RoutePersistence from "./routePersistence";

function App(){
    return(
        <div className="app-div">
            <RoutePersistence />
            <h1>App</h1>
            <Navbar />
            <Outlet />
        </div>
    )
}

export default App;