import { Outlet } from "react-router-dom";
import "./app.css";
import Navbar from "./components/navbar/navbar";
import RoutePersistence from "./routePersistence";

function App(){
    return(
        <div className="app-div">
          <RoutePersistence />
          <Navbar />
          <div className="page-div">
            <Outlet />
          </div>
        </div>
    )
}

export default App;